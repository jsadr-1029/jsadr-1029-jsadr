import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/pagos/conciliacion v4.0 — OLA 2
// Conciliación bancaria: importa movimientos de banco (CSV texto)
// y los matchea con pagos PENDIENTE por referencia.
//
// POST body:
//   { accion: 'previsualizar', movimientos: Movimiento[] }
//   { accion: 'aplicar', movimientos: Movimiento[], seleccionados: string[] }
//
// Movimiento = { fecha, monto, referencia, descripcion }
// =====================================================

interface MovimientoBanco {
  fecha: string
  monto: number
  referencia: string
  descripcion?: string
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion, movimientos } = body

    if (!Array.isArray(movimientos) || movimientos.length === 0) {
      return NextResponse.json({ success: false, error: 'movimientos debe ser un array no vacío' }, { status: 400 })
    }
    if (movimientos.length > 500) {
      return NextResponse.json({ success: false, error: 'Máximo 500 movimientos por lote' }, { status: 400 })
    }

    if (accion === 'previsualizar') return await previsualizar(movimientos)
    if (accion === 'aplicar') return await aplicar(movimientos, body.seleccionados, user, req)
    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

async function previsualizar(movimientos: MovimientoBanco[]) {
  // Para cada movimiento, buscar un pago PENDIENTE por referencia
  const resultados: any[] = []
  for (const m of movimientos) {
    if (!m.referencia) {
      resultados.push({ ...m, matched: false, motivo: 'Sin referencia' })
      continue
    }
    // Buscar por referencia exacta o por código
    const pago = await db.pago.findFirst({
      where: {
        OR: [
          { referencia: m.referencia },
          { codigo: m.referencia },
        ],
        estado: 'PENDIENTE',
      },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (pago) {
      const montoMatch = Math.abs(pago.montoTotal - m.monto) < 1 // tolerancia 1 COP
      resultados.push({
        ...m,
        matched: true,
        pagoId: pago.id,
        codigoPago: pago.codigo,
        prestamo: pago.prestamo.codigo,
        cliente: pago.prestamo.cliente.nombre,
        montoEsperado: pago.montoTotal,
        montoDiferencia: m.monto - pago.montoTotal,
        montoMatch,
      })
    } else {
      resultados.push({ ...m, matched: false, motivo: 'No se encontró pago PENDIENTE con esa referencia' })
    }
  }
  const matched = resultados.filter((r) => r.matched)
  const montoMatched = matched.reduce((s, r) => s + r.monto, 0)
  const noMatched = resultados.filter((r) => !r.matched)
  return NextResponse.json({
    success: true,
    data: {
      totalMovimientos: resultados.length,
      matched: matched.length,
      noMatched: noMatched.length,
      montoTotalMatched: montoMatched,
      movimientos: resultados,
    },
  })
}

async function aplicar(movimientos: MovimientoBanco[], seleccionados: string[] | undefined, user: any, req: NextRequest) {
  const clientInfo = getClientInfo(req)
  // Si se pasa seleccionados, solo aplicar esos; si no, todos los matched
  const movsAAplicar = seleccionados && seleccionados.length > 0
    ? movimientos.filter((m) => seleccionados.includes(m.referencia))
    : movimientos

  const aplicados: any[] = []
  const errores: any[] = []

  for (const m of movsAAplicar) {
    if (!m.referencia) {
      errores.push({ movimiento: m, error: 'Sin referencia' })
      continue
    }
    const pago = await db.pago.findFirst({
      where: {
        OR: [{ referencia: m.referencia }, { codigo: m.referencia }],
        estado: 'PENDIENTE',
      },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (!pago) {
      errores.push({ movimiento: m, error: 'Pago no encontrado o ya aplicado' })
      continue
    }
    const montoMatch = Math.abs(pago.montoTotal - m.monto) < 1
    if (!montoMatch) {
      errores.push({
        movimiento: m,
        error: `Monto no coincide. Esperado ${pago.montoTotal}, recibido ${m.monto}`,
        pagoId: pago.id,
      })
      continue
    }
    // Aplicar el pago
    await db.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'APLICADO',
        fechaPago: new Date(m.fecha),
        referencia: m.referencia,
        notas: `${pago.notas || ''}\n[Conciliación bancaria] Aplicado desde movimiento del ${m.fecha}. Descripción: ${m.descripcion || ''}`.trim(),
      },
    })
    await recalcularSaldosPrestamo(pago.prestamoId)
    aplicados.push({
      pagoId: pago.id,
      codigo: pago.codigo,
      prestamo: pago.prestamo.codigo,
      cliente: pago.prestamo.cliente.nombre,
      monto: m.monto,
      fecha: m.fecha,
    })
  }

  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'CONCILIACION_BANCARIA', modulo: 'pagos',
    entidadNombre: `Conciliación ${new Date().toISOString()}`,
    detalles: JSON.stringify({
      totalMovimientos: movsAAplicar.length,
      aplicados: aplicados.length,
      errores: errores.length,
    }),
    ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
  })

  return NextResponse.json({
    success: true,
    data: {
      totalProcesados: movsAAplicar.length,
      aplicados: aplicados.length,
      errores: errores.length,
      aplicadosDetalle: aplicados,
      erroresDetalle: errores,
    },
  })
}
