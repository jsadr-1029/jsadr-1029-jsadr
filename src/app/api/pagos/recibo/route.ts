import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import {
  calcularPrestamo,
  formatearMoneda,
  formatearFecha,
} from '@/lib/finanzas'
import crypto from 'crypto'

// =====================================================
// /api/pagos/recibo v4.1 — RECIBO RE-DISEÑADO
// -----------------------------------------------------
// Genera un recibo de pago firmado criptográficamente con:
//   • Datos completos del pago y el préstamo
//   • Número de cuotas pendientes después de este pago
//   • Flag esUltimaCuota → habilita mensaje de fidelización
//   • Información de cuenta de recaudo y firma institucional
// POST body: { pagoId: string }
// GET ?pagoId=...  → devuelve datos del recibo (sin regenerar hash)
// GET ?verificar=<hash>  → verificación pública
// =====================================================

function generarHashRecibo(contenido: string): string {
  return crypto.createHash('sha256').update(contenido).digest('hex')
}

function construirContenidoRecibo(pago: any): string {
  return [
    `RECIBO-${pago.id}`,
    `PAGO-${pago.codigo || pago.id}`,
    `PRESTAMO-${pago.prestamo.codigo}`,
    `CLIENTE-${pago.prestamo.cliente.nombre}`,
    `CEDULA-${pago.prestamo.cliente.cedula}`,
    `CUOTA-${pago.numeroCuota}`,
    `CAPITAL-${pago.montoCapital}`,
    `INTERES-${pago.montoInteres}`,
    `MORA-${pago.montoMora}`,
    `TOTAL-${pago.montoTotal}`,
    `METODO-${pago.metodoPago}`,
    `FECHA-${pago.fechaPago?.toISOString() || ''}`,
    `ESTADO-${pago.estado}`,
  ].join('|')
}

// Calcula cuotas pendientes y esUltimaCuota en base al estado del préstamo
// después de aplicar este pago.
function calcularCuotasPendientes(pago: any, prestamo: any): {
  cuotasPendientes: number
  totalCuotas: number
  cuotaActual: number
  esUltimaCuota: boolean
  saldoRestante: number
  porcentajeAvance: number
} {
  const totalCuotas = prestamo.numeroCuotas
  // Contar cuotas completamente pagadas (excluyendo pagos de solo intereses)
  const cuotasPagadasSet = new Set(
    prestamo.pagos
      .filter((p: any) => p.estado === 'APLICADO' && !p.esSoloIntereses)
      .map((p: any) => p.numeroCuota)
  )
  // Sumar la cuota de este pago si está APLICADO (porque se incluye en el set ya)
  const cuotaActual = pago.numeroCuota
  const cuotasPagadas = cuotasPagadasSet.size
  const cuotasPendientes = Math.max(0, totalCuotas - cuotasPagadas)
  const esUltimaCuota = cuotasPendientes === 0 && pago.estado === 'APLICADO'
  const saldoRestante = Math.max(0, prestamo.saldoTotal)
  const porcentajeAvance = totalCuotas > 0 ? Math.round((cuotasPagadas / totalCuotas) * 100) : 0
  return { cuotasPendientes, totalCuotas, cuotaActual, esUltimaCuota, saldoRestante, porcentajeAvance }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const pagoId = searchParams.get('pagoId')
    const verificar = searchParams.get('verificar')

    // === Modo verificación pública ===
    if (verificar) {
      const pago = await db.pago.findFirst({
        where: { reciboHash: verificar },
        include: {
          prestamo: { include: { cliente: true, pagos: true } },
          cuentaRecaudo: true,
        },
      })
      if (!pago) {
        return NextResponse.json({ success: false, error: 'Recibo no encontrado o hash inválido' }, { status: 404 })
      }
      const contenido = construirContenidoRecibo(pago)
      const hashActual = generarHashRecibo(contenido)
      if (hashActual !== pago.reciboHash) {
        return NextResponse.json({ success: false, error: 'Recibo alterado — hash no coincide' }, { status: 400 })
      }
      const cuotasInfo = calcularCuotasPendientes(pago, pago.prestamo)
      return NextResponse.json({
        success: true,
        data: {
          valido: true,
          pagoId: pago.id,
          codigo: pago.codigo,
          fechaPago: pago.fechaPago,
          estado: pago.estado,
          prestamo: pago.prestamo.codigo,
          cliente: pago.prestamo.cliente.nombre,
          cedula: pago.prestamo.cliente.cedula,
          cuota: pago.numeroCuota,
          montoCapital: pago.montoCapital,
          montoInteres: pago.montoInteres,
          montoMora: pago.montoMora,
          montoTotal: pago.montoTotal,
          metodoPago: pago.metodoPago,
          referencia: pago.referencia,
          reciboHash: pago.reciboHash,
          reciboFechaEmision: pago.reciboFechaEmision,
          ...cuotasInfo,
        },
      })
    }

    // === Modo consulta normal ===
    if (!pagoId) {
      return NextResponse.json({ success: false, error: 'pagoId requerido' }, { status: 400 })
    }
    const pago = await db.pago.findUnique({
      where: { id: pagoId },
      include: {
        prestamo: { include: { cliente: true, pagos: true, categoria: { include: { cuentaRecaudo: true } } } },
        cuentaRecaudo: true,
      },
    })
    if (!pago) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })

    const cuotasInfo = calcularCuotasPendientes(pago, pago.prestamo)
    return NextResponse.json({
      success: true,
      data: {
        pagoId: pago.id,
        codigo: pago.codigo,
        fechaPago: pago.fechaPago,
        estado: pago.estado,
        prestamo: pago.prestamo,
        cliente: pago.prestamo.cliente,
        cuota: pago.numeroCuota,
        montoCapital: pago.montoCapital,
        montoInteres: pago.montoInteres,
        montoMora: pago.montoMora,
        montoTotal: pago.montoTotal,
        metodoPago: pago.metodoPago,
        referencia: pago.referencia,
        cuentaRecaudo: pago.cuentaRecaudo,
        reciboHash: pago.reciboHash,
        reciboFechaEmision: pago.reciboFechaEmision,
        esSoloIntereses: pago.esSoloIntereses,
        notas: pago.notas,
        ...cuotasInfo,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - emitir recibo (genera hash + lo guarda)
export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { pagoId } = body
    if (!pagoId) {
      return NextResponse.json({ success: false, error: 'pagoId requerido' }, { status: 400 })
    }

    const pago = await db.pago.findUnique({
      where: { id: pagoId },
      include: {
        prestamo: { include: { cliente: true, pagos: true, categoria: { include: { cuentaRecaudo: true } } } },
        cuentaRecaudo: true,
      },
    })
    if (!pago) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })

    if (pago.estado !== 'APLICADO' && pago.estado !== 'PAGO_PARCIAL') {
      return NextResponse.json(
        { success: false, error: `No se puede emitir recibo de un pago en estado ${pago.estado}` },
        { status: 400 }
      )
    }

    const contenido = construirContenidoRecibo(pago)
    const hash = generarHashRecibo(contenido)
    const fechaEmision = new Date()

    await db.pago.update({
      where: { id: pagoId },
      data: { reciboHash: hash, reciboFechaEmision: fechaEmision },
    })

    const clientInfo = getClientInfo(req)
    await registrarAuditLog({
      usuarioId: user.id, usuarioNombre: user.nombre,
      accion: 'RECIBO_EMITIDO', modulo: 'pagos',
      entidadId: pagoId, entidadNombre: `Recibo ${pago.codigo || pagoId}`,
      detalles: JSON.stringify({ hash, fechaEmision, montoTotal: pago.montoTotal }),
      ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const urlVerificacion = `${baseUrl}/?recibo=${hash}`

    const cuotasInfo = calcularCuotasPendientes(pago, pago.prestamo)

    return NextResponse.json({
      success: true,
      data: {
        pagoId: pago.id,
        codigo: pago.codigo,
        reciboHash: hash,
        reciboFechaEmision: fechaEmision,
        urlVerificacion,
        pago: {
          fecha: pago.fechaPago,
          estado: pago.estado,
          cliente: pago.prestamo.cliente,
          prestamo: pago.prestamo,
          cuota: pago.numeroCuota,
          montoCapital: pago.montoCapital,
          montoInteres: pago.montoInteres,
          montoMora: pago.montoMora,
          montoTotal: pago.montoTotal,
          metodoPago: pago.metodoPago,
          referencia: pago.referencia,
          cuentaRecaudo: pago.cuentaRecaudo,
          esSoloIntereses: pago.esSoloIntereses,
          notas: pago.notas,
        },
        ...cuotasInfo,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
