import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/pagos/conciliacion v5.0
// Conciliación bancaria por PRÉSTAMO.
//
// Flujos soportados:
//   1) { accion: 'buscar-prestamos', codigo?: string, cedula?: string }
//      Devuelve los préstamos activos que coincidan con el código exacto
//      o con la cédula del cliente. Sirve para que el modal seleccione
//      el préstamo al que se aplicarán los movimientos del banco.
//
//   2) { accion: 'previsualizar', prestamoId, movimientos: Movimiento[] }
//      Para cada movimiento del banco, busca la cuota PENDIENTE del préstamo
//      cuyo montoTotal coincida (tolerancia 1 COP). Si hay varias con el
//      mismo monto, elige la más cercana a la fecha del movimiento.
//      NO aplica nada, solo devuelve el match.
//
//   3) { accion: 'aplicar', prestamoId, movimientos, seleccionados }
//      Aplica los movimientos seleccionados a las cuotas PENDIENTE
//      correspondientes.
//
// Movimiento = { fecha, monto, descripcion? }
// =====================================================

interface MovimientoBanco {
  fecha: string
  monto: number
  referencia?: string
  descripcion?: string
}

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
}

export async function POST(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion } = body

    if (accion === 'buscar-prestamos') return await buscarPrestamos(body)
    if (accion === 'previsualizar') return await previsualizar(body)
    if (accion === 'aplicar') return await aplicar(body, user, req)
    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// ---------------------------------------------------------
// Acción: buscar-prestamos
// Recibe { codigo? } o { cedula? } y devuelve préstamos activos
// (con al menos una cuota PENDIENTE) para que el usuario seleccione.
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
    // Búsqueda exacta por código (case-insensitive)
    where.codigo = { equals: codigo, mode: 'insensitive' }
  } else if (cedula) {
    where.cliente = { cedula: { equals: cedula, mode: 'insensitive' } }
  }

  const prestamos = await db.prestamo.findMany({
    where,
    include: {
      cliente: true,
      pagos: {
        where: { estado: 'PENDIENTE' },
        orderBy: { numeroCuota: 'asc' },
        select: {
          numeroCuota: true,
          montoTotal: true,
          fechaVencimiento: true,
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
    const proxima = p.pagos[0] // ya viene ordenado asc por numeroCuota
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
    }
  })

  return NextResponse.json({
    success: true,
    data: { prestamos: resumen },
  })
}

// ---------------------------------------------------------
// Acción: previsualizar
// Recibe { prestamoId, movimientos: Movimiento[] }
// Para cada movimiento, busca la cuota PENDIENTE cuyo montoTotal
// coincida (tolerancia 1 COP). Si hay varias con el mismo monto,
// elige la más cercana a la fecha del movimiento.
// ---------------------------------------------------------
async function previsualizar(body: { prestamoId?: string; movimientos?: MovimientoBanco[] }) {
  const { prestamoId, movimientos } = body

  if (!prestamoId) {
    return NextResponse.json({ success: false, error: 'prestamoId es requerido' }, { status: 400 })
  }
  if (!Array.isArray(movimientos) || movimientos.length === 0) {
    return NextResponse.json({ success: false, error: 'movimientos debe ser un array no vacío' }, { status: 400 })
  }
  if (movimientos.length > 500) {
    return NextResponse.json({ success: false, error: 'Máximo 500 movimientos por lote' }, { status: 400 })
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: true,
      pagos: {
        where: { estado: 'PENDIENTE' },
        orderBy: { numeroCuota: 'asc' },
      },
    },
  })

  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // Pool mutable de pagos PENDIENTE disponibles para matchear
  const pool = prestamo.pagos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    numeroCuota: p.numeroCuota,
    montoTotal: p.montoTotal,
    fechaVencimiento: p.fechaVencimiento,
    usado: false,
  }))

  const resultados: any[] = []
  for (const m of movimientos) {
    if (!m.monto || m.monto <= 0) {
      resultados.push({ ...m, matched: false, motivo: 'Monto inválido o cero' })
      continue
    }

    // 1) Buscar cuotas PENDIENTE con monto exacto (tolerancia 1 COP)
    const candidatos = pool.filter(
      (p) => !p.usado && Math.abs(p.montoTotal - m.monto) < 1
    )

    let elegido: typeof pool[number] | null = null

    if (candidatos.length === 1) {
      elegido = candidatos[0]
    } else if (candidatos.length > 1) {
      // Si hay varias con el mismo monto, elegir la de fechaVencimiento
      // más cercana a la fecha del movimiento del banco.
      const fechaMov = m.fecha ? new Date(m.fecha).getTime() : Date.now()
      elegido = candidatos.reduce((mejor, actual) => {
        const distActual = Math.abs(actual.fechaVencimiento.getTime() - fechaMov)
        const distMejor = Math.abs(mejor.fechaVencimiento.getTime() - fechaMov)
        return distActual < distMejor ? actual : mejor
      })
    }

    if (elegido) {
      elegido.usado = true
      const montoMatch = Math.abs(elegido.montoTotal - m.monto) < 1
      resultados.push({
        ...m,
        matched: true,
        pagoId: elegido.id,
        codigoPago: elegido.codigo,
        numeroCuota: elegido.numeroCuota,
        prestamo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
        montoEsperado: elegido.montoTotal,
        montoDiferencia: m.monto - elegido.montoTotal,
        montoMatch,
        fechaVencimiento: elegido.fechaVencimiento.toISOString(),
      })
    } else {
      // No se encontró cuota con ese monto
      const pendientesRestantes = pool.filter((p) => !p.usado)
      const sugerencia = pendientesRestantes[0]
      const motivo = sugerencia
        ? `No hay cuota pendiente por ${m.monto}. Próxima cuota esperada: ${sugerencia.montoTotal} (cuota #${sugerencia.numeroCuota})`
        : `No quedan cuotas PENDIENTE en este préstamo`
      resultados.push({ ...m, matched: false, motivo })
    }
  }

  const matched = resultados.filter((r) => r.matched)
  const montoMatched = matched.reduce((s, r) => s + r.monto, 0)
  const noMatched = resultados.filter((r) => !r.matched)

  return NextResponse.json({
    success: true,
    data: {
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
        cedula: prestamo.cliente.cedula,
      },
      totalMovimientos: resultados.length,
      matched: matched.length,
      noMatched: noMatched.length,
      montoTotalMatched: montoMatched,
      cuotasPendientesAntes: pool.length,
      movimientos: resultados,
    },
  })
}

// ---------------------------------------------------------
// Acción: aplicar
// Recibe { prestamoId, movimientos, seleccionados }
// Aplica los movimientos seleccionados (por referencia al index/clave)
// a las cuotas PENDIENTE correspondientes.
// ---------------------------------------------------------
async function aplicar(
  body: { prestamoId?: string; movimientos?: MovimientoBanco[]; seleccionados?: string[] },
  user: any,
  req: NextRequest
) {
  const { prestamoId, movimientos, seleccionados } = body

  if (!prestamoId) {
    return NextResponse.json({ success: false, error: 'prestamoId es requerido' }, { status: 400 })
  }
  if (!Array.isArray(movimientos) || movimientos.length === 0) {
    return NextResponse.json({ success: false, error: 'movimientos debe ser un array no vacío' }, { status: 400 })
  }

  const clientInfo = getClientInfo(req)

  // Filtrar movimientos a aplicar: si hay seleccionados, solo esos;
  // si no, todos los que estén marcados como matched en el preview.
  // La clave de selección es `referencia` (que en el nuevo flujo es el
  // texto del movimiento del banco + monto+fecha — lo seteamos en el modal).
  const movsAAplicar = seleccionados && seleccionados.length > 0
    ? movimientos.filter((m) =>
        seleccionados.includes(m.referencia || `${m.fecha}|${m.monto}|${m.descripcion || ''}`)
      )
    : movimientos

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: true,
      pagos: { where: { estado: 'PENDIENTE' }, orderBy: { numeroCuota: 'asc' } },
    },
  })

  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  const pool = prestamo.pagos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    numeroCuota: p.numeroCuota,
    montoTotal: p.montoTotal,
    fechaVencimiento: p.fechaVencimiento,
    usado: false,
  }))

  const aplicados: any[] = []
  const errores: any[] = []

  for (const m of movsAAplicar) {
    if (!m.monto || m.monto <= 0) {
      errores.push({ movimiento: m, error: 'Monto inválido o cero' })
      continue
    }

    const candidatos = pool.filter((p) => !p.usado && Math.abs(p.montoTotal - m.monto) < 1)

    let elegido: typeof pool[number] | null = null
    if (candidatos.length === 1) {
      elegido = candidatos[0]
    } else if (candidatos.length > 1) {
      const fechaMov = m.fecha ? new Date(m.fecha).getTime() : Date.now()
      elegido = candidatos.reduce((mejor, actual) => {
        const distActual = Math.abs(actual.fechaVencimiento.getTime() - fechaMov)
        const distMejor = Math.abs(mejor.fechaVencimiento.getTime() - fechaMov)
        return distActual < distMejor ? actual : mejor
      })
    }

    if (!elegido) {
      errores.push({
        movimiento: m,
        error: 'No hay cuota PENDIENTE por ese monto en este préstamo',
      })
      continue
    }

    const montoMatch = Math.abs(elegido.montoTotal - m.monto) < 1
    if (!montoMatch) {
      errores.push({
        movimiento: m,
        error: `Monto no coincide. Esperado ${elegido.montoTotal}, recibido ${m.monto}`,
        pagoId: elegido.id,
      })
      continue
    }

    // Aplicar el pago
    const refMov = m.referencia || `${m.fecha}|${m.monto}`
    await db.pago.update({
      where: { id: elegido.id },
      data: {
        estado: 'APLICADO',
        fechaPago: new Date(m.fecha),
        metodoPago: 'CONCILIACION_BANCARIA',
        referencia: refMov,
        notas: `${''}\n[Conciliación bancaria] Aplicado desde movimiento del ${m.fecha} por ${m.monto}. Descripción: ${m.descripcion || ''}`.trim(),
      },
    })
    await recalcularSaldosPrestamo(prestamo.id)
    elegido.usado = true

    aplicados.push({
      pagoId: elegido.id,
      codigo: elegido.codigo,
      numeroCuota: elegido.numeroCuota,
      prestamo: prestamo.codigo,
      cliente: prestamo.cliente.nombre,
      monto: m.monto,
      fecha: m.fecha,
    })
  }

  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'CONCILIACION_BANCARIA', modulo: 'pagos',
    entidadNombre: `Préstamo ${prestamo.codigo} — ${new Date().toISOString()}`,
    detalles: JSON.stringify({
      prestamoId: prestamo.id,
      prestamoCodigo: prestamo.codigo,
      cliente: prestamo.cliente.nombre,
      cedula: prestamo.cliente.cedula,
      totalMovimientos: movsAAplicar.length,
      aplicados: aplicados.length,
      errores: errores.length,
    }),
    ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
  })

  return NextResponse.json({
    success: true,
    data: {
      prestamo: {
        id: prestamo.id,
        codigo: prestamo.codigo,
        cliente: prestamo.cliente.nombre,
      },
      totalProcesados: movsAAplicar.length,
      aplicados: aplicados.length,
      errores: errores.length,
      aplicadosDetalle: aplicados,
      erroresDetalle: errores,
    },
  })
}
