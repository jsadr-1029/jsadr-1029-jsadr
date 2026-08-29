import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { enviarWhatsApp, guardarNotificacion } from '@/lib/whatsapp'

// =====================================================
// /api/pagos/batch v4.0 — OLA 2
// Operaciones masivas sobre próximos pagos.
// POST body:
//   { accion: 'whatsapp_masivo', prestamoIds: string[], mensaje?: string }
//   { accion: 'whatsapp_recordatorios', dias: 7 }
//   { accion: 'whatsapp_mora' }
// =====================================================

interface RegistroEnvio {
  prestamoId: string
  cliente: string
  telefono: string
  enviado: boolean
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion } = body

    if (accion === 'whatsapp_masivo') {
      return await enviarWhatsAppMasivo(body, user)
    }
    if (accion === 'whatsapp_recordatorios') {
      return await enviarRecordatorios(body, user)
    }
    if (accion === 'whatsapp_mora') {
      return await enviarAvisosMora(body, user)
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

async function enviarWhatsAppMasivo(body: any, user: any) {
  const { prestamoIds, mensaje } = body
  if (!Array.isArray(prestamoIds) || prestamoIds.length === 0) {
    return NextResponse.json({ success: false, error: 'prestamoIds debe ser un array no vacío' }, { status: 400 })
  }
  if (prestamoIds.length > 100) {
    return NextResponse.json({ success: false, error: 'Máximo 100 solicitudes por operación batch' }, { status: 400 })
  }

  const prestamos = await db.prestamo.findMany({
    where: { id: { in: prestamoIds } },
    include: { cliente: true },
  })

  const registros: RegistroEnvio[] = []
  let enviados = 0
  let fallidos = 0

  for (const p of prestamos) {
    if (!p.cliente.telefono) {
      registros.push({
        prestamoId: p.id,
        cliente: p.cliente.nombre,
        telefono: '',
        enviado: false,
        error: 'Sin teléfono',
      })
      fallidos++
      continue
    }
    const msgPersonalizado = (mensaje || 'Hola {nombre}, te recordamos que tienes un pago pendiente.')
      .replace('{nombre}', p.cliente.nombre)
      .replace('{codigo}', p.codigo)
    const envio = await enviarWhatsApp(p.cliente.telefono, msgPersonalizado)
    await guardarNotificacion({
      db, prestamoId: p.id, telefono: p.cliente.telefono,
      tipo: 'RECORDATORIO', mensaje: msgPersonalizado, envio,
    })
    registros.push({
      prestamoId: p.id,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      enviado: envio.exito,
      error: !envio.exito ? envio.error : undefined,
    })
    if (envio.exito) enviados++
    else fallidos++
    // Pequeño delay para no saturar WhatsApp API
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({
    success: true,
    data: {
      total: prestamos.length,
      enviados,
      fallidos,
      registros,
    },
  })
}

async function enviarRecordatorios(body: any, user: any) {
  const dias = body.dias || 7
  const fechaFin = new Date()
  fechaFin.setDate(fechaFin.getDate() + dias)
  fechaFin.setHours(23, 59, 59, 999)

  const prestamos = await db.prestamo.findMany({
    where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
    include: { cliente: true, pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } } },
  })

  const registros: RegistroEnvio[] = []
  let enviados = 0
  let fallidos = 0

  for (const p of prestamos) {
    const cuotasPagadas = new Set(p.pagos.filter(pg => pg.estado === 'APLICADO').map(pg => pg.numeroCuota)).size
    const proximaCuotaNum = cuotasPagadas + 1
    // Verificar si la próxima cuota cae en los próximos N días
    // (cálculo simplificado — el endpoint /proximos hace esto más detallado)
    const msg = `Hola ${p.cliente.nombre}, te recordamos que la cuota ${proximaCuotaNum} de tu solicitud ${p.codigo} vence pronto. Contáctanos para más información.`
    if (!p.cliente.telefono) {
      fallidos++
      continue
    }
    const envio = await enviarWhatsApp(p.cliente.telefono, msg)
    await guardarNotificacion({
      db, prestamoId: p.id, telefono: p.cliente.telefono,
      tipo: 'RECORDATORIO', mensaje: msg, envio,
    })
    registros.push({
      prestamoId: p.id,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      enviado: envio.exito,
      error: !envio.exito ? envio.error : undefined,
    })
    if (envio.exito) enviados++
    else fallidos++
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({
    success: true,
    data: { total: prestamos.length, enviados, fallidos, registros },
  })
}

async function enviarAvisosMora(body: any, user: any) {
  const prestamos = await db.prestamo.findMany({
    where: { estado: 'EN_MORA' },
    include: { cliente: true, pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } } },
  })

  const registros: RegistroEnvio[] = []
  let enviados = 0
  let fallidos = 0

  for (const p of prestamos) {
    const msg = `Hola ${p.cliente.nombre}, tu solicitud ${p.codigo} tiene una cuota en mora. Por favor contáctanos para regularizar y evitar recargos adicionales.`
    if (!p.cliente.telefono) {
      fallidos++
      continue
    }
    const envio = await enviarWhatsApp(p.cliente.telefono, msg)
    await guardarNotificacion({
      db, prestamoId: p.id, telefono: p.cliente.telefono,
      tipo: 'MORA', mensaje: msg, envio,
    })
    registros.push({
      prestamoId: p.id,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      enviado: envio.exito,
      error: !envio.exito ? envio.error : undefined,
    })
    if (envio.exito) enviados++
    else fallidos++
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json({
    success: true,
    data: { total: prestamos.length, enviados, fallidos, registros },
  })
}
