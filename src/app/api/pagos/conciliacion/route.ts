import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/pagos/conciliacion v6.0
// Conciliación bancaria por PRÉSTAMO — flujo simplificado.
//
// Flujos soportados:
//   1) { accion: 'buscar-prestamos', codigo?: string, cedula?: string }
//      Devuelve los préstamos activos con cuotas pendientes
//      (PENDIENTE + VENCIDO) y la lista completa de esas cuotas.
//
//   2) { accion: 'aplicar-pagos', prestamoId, pagoIds: string[] }
//      Marca como APLICADO cada cuota seleccionada, registra
//      método CONCILIACION_BANCARIA, recalcula saldos del préstamo
//      y devuelve el resumen de la operación.
//
// No hay paso de "pegar CSV": las cuotas pendientes se obtienen
// directamente desde la base de datos y el usuario simplemente
// selecciona cuáles aplicar.
// =====================================================

interface PrestamoResumen {
  id: string
  codigo: string
  estado: string
  montoPrincipal: number
  saldoTotal: number
  numeroCuotas: number
  cuotasPagadas: number
  frecuencia: string
  cliente: { nombre: string; cedula: string; telefono?: string | null }
  cuotasPendientes: number
  proximaCuota: {
    numeroCuota: number
    montoTotal: number
    fechaVencimiento: string
  } | null
  pagosPendientes: Array<{
    id: string
    codigo: string | null
    numeroCuota: number
    montoTotal: number
    fechaVencimiento: string
    estado: string
  }>
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion } = body

    if (accion === 'buscar-prestamos') return await buscarPrestamos(body)
    if (accion === 'aplicar-pagos') return await aplicarPagos(body, user, req)
    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// ---------------------------------------------------------
// Acción: buscar-prestamos
// Recibe { codigo? } o { cedula? } y devuelve préstamos activos
// (con al menos una cuota PENDIENTE o VENCIDA) para que el
// usuario seleccione cuáles pagos aplicar.
// ---------------------------------------------------------
async function buscarPrestamos(body: { codigo?: string; cedula?: string }) {
  const codigo = (body.codigo || '').trim()
  const cedula = (body.cedula || '').trim()

  if (!codigo && !cedula) {
    return NextResponse.json(
      { success: false, error: 'Debe ingresar un código de préstamo o una cédula' },
      { status: 400 }
    )
  }

  // Préstamos "activos" (no en estado SOLICITUD/RECHAZADO/CANCELADO)
  const where: any = {
    estado: { notIn: ['SOLICITUD', 'RECHAZADO', 'CANCELADO'] },
  }

  if (codigo) {
    where.codigo = { equals: codigo, mode: 'insensitive' }
  } else if (cedula) {
    where.cliente = { cedula: { equals: cedula, mode: 'insensitive' } }
  }

  // Pagos "pendientes de conciliar" = PENDIENTE + VENCIDO.
  const ESTADOS_CONCILIABLES = ['PENDIENTE', 'VENCIDO']

  const prestamos = await db.prestamo.findMany({
    where,
    include: {
      cliente: true,
      pagos: {
        where: { estado: { in: ESTADOS_CONCILIABLES } },
        orderBy: { numeroCuota: 'asc' },
        select: {
          id: true,
          codigo: true,
          numeroCuota: true,
          montoTotal: true,
          fechaVencimiento: true,
          estado: true,
        },
      },
    },
    orderBy: { fechaSolicitud: 'desc' },
  })

  if (prestamos.length === 0) {
    return NextResponse.json({
      success: true,
      data: { prestamos: [], mensaje: 'No se encontraron préstamos activos con cuotas pendientes para ese criterio' },
    })
  }

  const resumen: PrestamoResumen[] = prestamos.map((p) => {
    const proxima = p.pagos[0]
    return {
      id: p.id,
      codigo: p.codigo,
      estado: p.estado,
      montoPrincipal: p.montoPrincipal,
      saldoTotal: p.saldoTotal,
      numeroCuotas: p.numeroCuotas,
      cuotasPagadas: p.cuotasPagadas,
      frecuencia: p.frecuencia,
      cliente: {
        nombre: p.cliente.nombre,
        cedula: p.cliente.cedula,
        telefono: p.cliente.telefono,
      },
      cuotasPendientes: p.pagos.length,
      proximaCuota: proxima
        ? {
            numeroCuota: proxima.numeroCuota,
            montoTotal: proxima.montoTotal,
            fechaVencimiento: proxima.fechaVencimiento.toISOString(),
          }
        : null,
      pagosPendientes: p.pagos.map((cuota) => ({
        id: cuota.id,
        codigo: cuota.codigo,
        numeroCuota: cuota.numeroCuota,
        montoTotal: cuota.montoTotal,
        fechaVencimiento: cuota.fechaVencimiento.toISOString(),
        estado: cuota.estado,
      })),
    }
  })

  return NextResponse.json({
    success: true,
    data: { prestamos: resumen },
  })
}

// ---------------------------------------------------------
// Acción: aplicar-pagos
// Recibe { prestamoId, pagoIds: string[] }
// Marca cada pago seleccionado como APLICADO, registra el método
// CONCILIACION_BANCARIA con la fecha actual, recalcula saldos
// del préstamo y devuelve el resumen de la operación.
// ---------------------------------------------------------
async function aplicarPagos(
  body: { prestamoId?: string; pagoIds?: string[] },
  user: any,
  req: NextRequest
) {
  const { prestamoId, pagoIds } = body

  if (!prestamoId) {
    return NextResponse.json({ success: false, error: 'prestamoId es requerido' }, { status: 400 })
  }
  if (!Array.isArray(pagoIds) || pagoIds.length === 0) {
    return NextResponse.json({ success: false, error: 'Debe seleccionar al menos un pago para aplicar' }, { status: 400 })
  }
  if (pagoIds.length > 500) {
    return NextResponse.json({ success: false, error: 'Máximo 500 pagos por lote' }, { status: 400 })
  }

  const clientInfo = getClientInfo(req)

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cliente: true },
  })

  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // Traer todos los pagos seleccionados y validar que pertenezcan al préstamo
  // y sigan pendientes (PENDIENTE o VENCIDO).
  const pagos = await db.pago.findMany({
    where: { id: { in: pagoIds } },
    include: { prestamo: { select: { id: true, codigo: true } } },
  })

  const aplicados: any[] = []
  const errores: any[] = []
  const ahora = new Date()

  for (const pago of pagos) {
    if (pago.prestamoId !== prestamo.id) {
      errores.push({
        pagoId: pago.id,
        codigo: pago.codigo,
        numeroCuota: pago.numeroCuota,
        error: 'El pago no pertenece al préstamo seleccionado',
      })
      continue
    }
    if (!['PENDIENTE', 'VENCIDO'].includes(pago.estado)) {
      errores.push({
        pagoId: pago.id,
        codigo: pago.codigo,
        numeroCuota: pago.numeroCuota,
        error: `El pago ya está ${pago.estado}, no se puede volver a aplicar`,
      })
      continue
    }

    await db.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'APLICADO',
        fechaPago: ahora,
        metodoPago: 'CONCILIACION_BANCARIA',
        referencia: `CONC-${prestamo.codigo}-${pago.numeroCuota}`,
        notas: `[Conciliación bancaria] Aplicado manualmente desde conciliación por ${user.nombre} el ${ahora.toISOString()}`,
      },
    })
    await recalcularSaldosPrestamo(prestamo.id)

    aplicados.push({
      pagoId: pago.id,
      codigo: pago.codigo,
      numeroCuota: pago.numeroCuota,
      monto: pago.montoTotal,
      fecha: ahora.toISOString().slice(0, 10),
    })
  }

  // Si se aplicó al menos uno, registrar audit log
  if (aplicados.length > 0) {
    await registrarAuditLog({
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      accion: 'CONCILIACION_BANCARIA',
      modulo: 'pagos',
      entidadNombre: `Préstamo ${prestamo.codigo} — ${ahora.toISOString()}`,
      detalles: JSON.stringify({
        prestamoId: prestamo.id,
        prestamoCodigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
        cedula: prestamo.cliente.cedula,
        totalSeleccionados: pagoIds.length,
        aplicados: aplicados.length,
        errores: errores.length,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
      },
      totalProcesados: pagoIds.length,
      aplicados: aplicados.length,
      errores: errores.length,
      aplicadosDetalle: aplicados,
      erroresDetalle: errores,
    },
  })
}
