// =====================================================
// /api/pagos/bancolombia-webhook — Webhook de Bancolombia v3.0
// POST: recibe notificaciones asíncronas de Bancolombia.
// Verifica HMAC SHA-256 con el secreto compartido.
// Esta ruta es PÚBLICA (whitelist en proxy) pero valida HMAC.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, logError } from '@/lib/error-handler'
import crypto from 'crypto'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'

export async function POST(req: NextRequest) {
  try {
    // === VERIFICACIÓN HMAC ===
    const configBancolombia = await db.conexionAPI.findFirst({
      where: { tipo: 'BANCOLOMBIA_BOTON_PAGO', activa: true },
    })

    if (!configBancolombia || !configBancolombia.apiSecret) {
      logError('/api/pagos/bancolombia-webhook', new Error('Config Bancolombia no encontrada'))
      return NextResponse.json(
        { success: false, error: 'Servicio no configurado' },
        { status: 503 }
      )
    }

    // Obtener firma del header (Bancolombia usa X-Signature o类似)
    const signatureHeader =
      req.headers.get('x-signature') ||
      req.headers.get('x-hub-signature-256') ||
      req.headers.get('signature') ||
      ''

    // El raw body ya fue consumido por Next.js; usar el body como texto
    const rawBody = await req.text()

    // Verificar HMAC SHA-256
    // Formato esperado: "t=timestamp,v1=hash"
    let esValido = false
    const secret = configBancolombia.apiSecret

    if (signatureHeader.startsWith('t=')) {
      // Formato Stripe-like: t=timestamp,v1=hash
      const parts = signatureHeader.split(',')
      const tPart = parts.find((p) => p.startsWith('t='))
      const v1Part = parts.find((p) => p.startsWith('v1='))
      if (tPart && v1Part) {
        const timestamp = tPart.split('=')[1]
        const signature = v1Part.split('=')[1]
        const payload = `${timestamp}.${rawBody}`
        const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
        esValido = crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        )
      }
    } else if (signatureHeader.startsWith('sha256=')) {
      // Formato GitHub-like: sha256=hash
      const signature = signatureHeader.slice(7)
      const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
      esValido = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } else {
      // Sin header de firma o formato desconocido - en producción denegar
      // Para desarrollo/testing permitir solo si la IP proviene de Bancolombia
      const forwarded = req.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0].trim() : ''
      // === CIDR validation real v4.0 ===
      const ipsConfianza = ['190.131.0.0/16', '190.131.223.0/24']
      esValido = process.env.NODE_ENV !== 'production' && ipEstaEnRangos(ip, ipsConfianza)
    }

    if (!esValido) {
      logError(
        '/api/pagos/bancolombia-webhook',
        new Error(`HMAC inválido. Header: ${signatureHeader.slice(0, 50)}...`)
      )
      return NextResponse.json(
        { success: false, error: 'Firma inválida' },
        { status: 401 }
      )
    }

    // === PROCESAR WEBHOOK ===
    const evento = JSON.parse(rawBody)

    // Estructura esperada del evento de Bancolombia:
    // {
    //   "event": "payment.approved" | "payment.declined" | "payment.pending",
    //   "data": {
    //     "id": "transaction-id",
    //     "reference": "PAGO-COD-...",
    //     "status": "APPROVED",
    //     "amount": { "total": 100000, "currency": "COP" },
    //     "customer": { "email": "...", "phone": "..." },
    //     "paymentMethod": "PSE" | "CARD" | "NEQUI"
    //   },
    //   "timestamp": "2025-..."
    // }

    const eventType: string = evento.event || evento.type || ''
    const data = evento.data || evento
    const transactionId: string = data.id || data.transactionId || ''
    const referencia: string = data.reference || data.referencia || ''
    const estadoBancolombia: string = (data.status || data.estado || '').toUpperCase()
    const monto: number = data.amount?.total || data.monto || 0
    const metodoPago: string = data.paymentMethod || data.metodoPago || 'BANCOLOMBIA'

    // Buscar el pago por referencia o por transactionId
    type PagoConPrestamo = Awaited<ReturnType<typeof db.pago.findFirst<{ include: { prestamo: true } }>>>
    let pago: PagoConPrestamo = null
    if (referencia) {
      pago = await db.pago.findFirst({
        where: {
          OR: [
            { referencia },
            { codigo: referencia },
          ],
        },
        include: { prestamo: true },
      })
    }

    if (!pago && transactionId) {
      // Por transactionId guardado en notas o referencia
      pago = await db.pago.findFirst({
        where: { referencia: transactionId },
        include: { prestamo: true },
      })
    }

    if (!pago) {
      logError(
        '/api/pagos/bancolombia-webhook',
        new Error(`Pago no encontrado. ref=${referencia}, txId=${transactionId}`)
      )
      // Responder 200 para que Bancolombia no reintente indefinidamente
      return NextResponse.json({
        success: true,
        message: 'Evento recibido pero pago no encontrado',
        ignored: true,
      })
    }

    // Si el pago ya está APLICADO, ignorar (idempotencia)
    if (pago.estado === 'APLICADO') {
      return NextResponse.json({
        success: true,
        message: 'Pago ya estaba aplicado',
        pagoId: pago.id,
      })
    }

    // Mapear estado de Bancolombia
    let nuevoEstado = pago.estado
    switch (estadoBancolombia) {
      case 'APPROVED':
      case 'SUCCESS':
        nuevoEstado = 'APLICADO'
        break
      case 'DECLINED':
      case 'REJECTED':
      case 'FAILED':
        nuevoEstado = 'ANULADO'
        break
      case 'PENDING':
        nuevoEstado = 'PENDIENTE'
        break
    }

    // Actualizar pago
    const fechaPago = nuevoEstado === 'APLICADO' ? new Date() : pago.fechaPago
    await db.pago.update({
      where: { id: pago.id },
      data: {
        estado: nuevoEstado,
        fechaPago,
        referencia: transactionId || pago.referencia,
        metodoPago: `BANCOLOMBIA_${metodoPago}`.toUpperCase(),
        notas: `${pago.notas || ''}\n[Webhook ${eventType}] estado=${estadoBancolombia}, monto=${monto}, txId=${transactionId}`,
      },
    })

    // Si fue aprobado, recalcular saldos del préstamo
    if (nuevoEstado === 'APLICADO' && pago.prestamoId) {
      try {
        await recalcularSaldosPrestamo(pago.prestamoId)
      } catch (e) {
        logError('recalcularSaldosPrestamo', e)
      }
    }

    return NextResponse.json({
      success: true,
      evento: eventType,
      pagoId: pago.id,
      nuevoEstado,
    })
  } catch (error) {
    logError('/api/pagos/bancolombia-webhook POST', error)
    return errorResponse('/api/pagos/bancolombia-webhook POST', error)
  }
}

// === Helpers CIDR v4.0 ===
function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10))
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null
  // Usar BigInt para soportar correctamente rango completo (uint32 con signo en JS)
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function ipEstaEnRango(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(range)
  if (ipInt === null || rangeInt === null || isNaN(bits)) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

function ipEstaEnRangos(ip: string, cidrs: string[]): boolean {
  if (!ip) return false
  return cidrs.some((cidr) => ipEstaEnRango(ip, cidr))
}

