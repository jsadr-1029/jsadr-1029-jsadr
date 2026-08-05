import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import {
  calcularPrestamo,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraAnual,
  calcularFechaVencimiento,
  generarCodigoPago,
  formatearFecha,
  formatearMoneda,
} from '@/lib/finanzas'
import { enviarWhatsApp, mensajePagoAplicado, mensajePrestamoCancelado, mensajeLinkPago, guardarNotificacion } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole, getAuthUser } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// /api/pagos v4.0 — OLA 1 + Solo Intereses
// -----------------------------------------------------
// GET  - listar pagos (con filtros prestamoId, fecha)
// POST - acciones:
//   accion=aplicar           → aplica pago normal (mora→interés→capital)
//   accion=generar_link      → crea link PENDIENTE + WhatsApp
//   accion=solo_intereses    → NUEVO: paga solo intereses, difiere capital
//                              (corre la cuota a la siguiente fecha)
// =====================================================

// GET - listar pagos
export async function GET(req: NextRequest) {
  try {
    // Auth: cualquier rol autenticado puede consultar
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const prestamoId = searchParams.get('prestamoId')
    const fecha = searchParams.get('fecha')
    const estado = searchParams.get('estado')

    const where: any = {}
    if (prestamoId && prestamoId !== 'all') where.prestamoId = prestamoId
    if (estado) where.estado = estado
    if (fecha) {
      const inicio = new Date(fecha)
      inicio.setHours(0, 0, 0, 0)
      const fin = new Date(fecha)
      fin.setHours(23, 59, 59, 999)
      where.fechaPago = { gte: inicio, lte: fin }
    }
    // No mostrar ANULADOS por defecto (soft-delete)
    if (!estado) {
      where.estado = { not: 'ANULADO' }
    }

    const pagos = await db.pago.findMany({
      where,
      include: {
        prestamo: { include: { cliente: true } },
        cuentaRecaudo: true,
      },
      orderBy: { fechaPago: 'desc' },
    })

    return NextResponse.json({ success: true, data: pagos })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// POST - registrar pago, generar link o aplicar solo intereses
export async function POST(req: NextRequest) {
  try {
    // Auth: GESTOR o ADMIN para escribir pagos
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const body = await req.json()
    const { accion } = body

    if (accion === 'generar_link') return await generarLinkPago(body, user)
    if (accion === 'solo_intereses') return await aplicarSoloIntereses(body, user)
    return await aplicarPago(body, user)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}

// =====================================================
// ACCIÓN: Generar link de pago
// =====================================================
async function generarLinkPago(body: any, user: any) {
  const { prestamoId, numeroCuota } = body
  if (!prestamoId || !numeroCuota) {
    return NextResponse.json(
      { success: false, error: 'prestamoId y numeroCuota son obligatorios' },
      { status: 400 }
    )
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cliente: true, pagos: true },
  })
  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: prestamo.fechaDesembolso || undefined,
  })

  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota))
  if (!cuota) {
    return NextResponse.json({ success: false, error: 'Cuota no encontrada' }, { status: 400 })
  }

  const codigo = generarCodigoPago()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const linkPago = `${baseUrl}/?pay=${codigo}`
  const linkExpira = new Date()
  linkExpira.setDate(linkExpira.getDate() + 7)

  const pago = await db.pago.create({
    data: {
      codigo,
      prestamoId,
      numeroCuota: parseInt(numeroCuota),
      montoCapital: cuota.capital,
      montoInteres: cuota.interes,
      montoTotal: cuota.montoCuota,
      fechaVencimiento: cuota.fechaVencimiento,
      estado: 'PENDIENTE',
      linkPago,
      linkExpira,
    },
  })

  const mensaje = mensajeLinkPago({
    nombreCliente: prestamo.cliente.nombre,
    codigoPrestamo: prestamo.codigo,
    cuotaNumero: parseInt(numeroCuota),
    monto: cuota.montoCuota,
    linkPago,
    fechaVencimiento: formatearFecha(cuota.fechaVencimiento),
  })
  const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
  await guardarNotificacion({
    db, prestamoId,
    telefono: prestamo.cliente.telefono,
    tipo: 'PAGO', mensaje, envio,
  })

  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'PAGO_LINK_GENERADO', modulo: 'pagos',
    entidadId: pago.id, entidadNombre: `Pago ${codigo}`,
    detalles: JSON.stringify({ prestamoId, numeroCuota, monto: cuota.montoCuota }),
    ipOrigen: '', userAgent: '',
  })

  return NextResponse.json({ success: true, data: pago, linkPago, whatsapp: envio })
}

// =====================================================
// ACCIÓN: Aplicar pago normal (con transacción)
// =====================================================
async function aplicarPago(body: any, user: any) {
  const { prestamoId, numeroCuota, montoTotal, metodoPago, referencia, cuentaRecaudoId, codigo } = body

  if (!prestamoId || !numeroCuota || !montoTotal) {
    return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: {
        include: {
          cuentaRecaudo: true,
          categoria: { include: { cuentaRecaudo: true } },
        },
      },
      pagos: true,
    },
  })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })

  // === VALIDACIÓN DE CUENTA ASIGNADA AL CLIENTE (v3.7 — v4.0.1 fix) ===
  // Prioridad de cuenta asignada:
  //   1. Instrucción temporal activa del cliente
  //   2. Cuenta asignada directamente al cliente (cliente.cuentaRecaudoId)
  //   3. Cuenta de la categoría del cliente (cliente.categoria.cuentaRecaudoId)
  //   4. Cuenta de la categoría del préstamo (prestamo.categoria.cuentaRecaudoId)
  //
  // BUG PREVIO: si el frontend enviaba una cuenta distinta (p.ej. la de la
  // categoría del préstamo cuando el cliente tiene su propia cuenta), el
  // sistema RECHAZABA el pago con 400. Esto bloqueaba al usuario.
  // FIX v4.0.1: si la cuenta enviada no coincide con la asignada, se
  // AUTO-CORRIGE silenciosamente a la cuenta asignada. El pago se aplica
  // a la cuenta correcta sin bloquear al usuario.
  const cliente = prestamo.cliente
  const instruccionActiva = cliente.instruccionCuentaId &&
    (!cliente.instruccionCuentaExpira || new Date(cliente.instruccionCuentaExpira) > new Date())
  const cuentaAsignada = instruccionActiva
    ? cliente.instruccionCuentaId
    : (cliente.cuentaRecaudoId || cliente.categoria?.cuentaRecaudoId || null)
  const cuentaObjAsignada = instruccionActiva
    ? null
    : (cliente.cuentaRecaudo || cliente.categoria?.cuentaRecaudo || null)

  // Si hay cuenta asignada Y el frontend envió una diferente, auto-corregir
  // (antes: rechazo 400. Ahora: silenciosamente usa la asignada).
  let cuentaFinalPago: string | null
  if (cuentaAsignada && cuentaRecaudoId && cuentaRecaudoId !== cuentaAsignada) {
    // Auto-corrección: usar la cuenta asignada (prioridad correcta)
    cuentaFinalPago = cuentaAsignada
  } else {
    cuentaFinalPago = cuentaRecaudoId || cuentaAsignada || null
  }

  let pagoExistente: Awaited<ReturnType<typeof db.pago.findFirst>> = null
  if (codigo) {
    pagoExistente = await db.pago.findFirst({ where: { codigo, prestamoId } })
  } else {
    const existenteCompleto = prestamo.pagos.find(
      (p) => p.numeroCuota === parseInt(numeroCuota) && p.estado === 'APLICADO'
    )
    if (existenteCompleto) {
      return NextResponse.json(
        { success: false, error: 'Esta cuota ya fue completamente pagada. Usa la siguiente cuota.' },
        { status: 400 }
      )
    }
  }

  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: prestamo.fechaDesembolso || undefined,
  })

  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota))
  if (!cuota) return NextResponse.json({ success: false, error: 'Cuota no encontrada' }, { status: 400 })

  const tasaMoraEfectiva = getTasaMoraAnual(prestamo)
  const diasMora = calcularDiasMora(cuota.fechaVencimiento)

  // === Mora renegociada tiene prioridad sobre el cálculo automático ===
  // Si el gestor negoció o anuló la mora (POST /api/pagos/renegociar-mora),
  // ese valor fijo reemplaza el cálculo compuesto diario para la cuota vencida.
  const moraRenegociadaActiva =
    prestamo.moraRenegociadaAccion &&
    prestamo.moraRenegociadaFecha &&
    prestamo.moraRenegociada !== null &&
    prestamo.moraRenegociada !== undefined

  let moraGenerada: number
  let moraEsRenegociada = false
  if (moraRenegociadaActiva) {
    // Mora renegociada: valor fijo acordado con el cliente
    moraGenerada = Number(prestamo.moraRenegociada) || 0
    moraEsRenegociada = true
  } else if (diasMora > 0) {
    // Mora automática: interés compuesto diario sobre el saldo de la cuota vencida
    moraGenerada = calcularMoraCompuesta(cuota.montoCuota, tasaMoraEfectiva, diasMora)
  } else {
    moraGenerada = 0
  }

  const montoTotalNum = parseFloat(montoTotal)
  const totalCuotaConMora = cuota.montoCuota + moraGenerada

  // === DISTRIBUCIÓN PROPORCIONAL: mora → interés → capital ===
  let montoMoraPagada = 0
  let montoInteresPagado = 0
  let montoCapitalPagado = 0
  let resto = montoTotalNum

  const pagosParcialesPrevios = prestamo.pagos.filter(
    (p) => p.numeroCuota === parseInt(numeroCuota) && p.estado === 'PAGO_PARCIAL'
  )
  const interesPagadoAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoInteres, 0)
  const capitalPagadoAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoCapital, 0)
  const moraPagadaAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoMora, 0)
  const moraPendienteCuota = Math.max(0, moraGenerada - moraPagadaAnterior)
  const interesPendienteCuota = Math.max(0, cuota.interes - interesPagadoAnterior)
  const capitalPendienteCuota = Math.max(0, cuota.capital - capitalPagadoAnterior)

  if (moraPendienteCuota > 0) {
    montoMoraPagada = Math.min(resto, moraPendienteCuota)
    resto = Math.max(0, resto - montoMoraPagada)
  }
  if (resto > 0 && interesPendienteCuota > 0) {
    montoInteresPagado = Math.min(resto, interesPendienteCuota)
    resto = Math.max(0, resto - montoInteresPagado)
  }
  if (resto > 0 && capitalPendienteCuota > 0) {
    montoCapitalPagado = Math.min(resto, capitalPendienteCuota)
    resto = Math.max(0, resto - montoCapitalPagado)
  }

  // === Overpayment detection ===
  // Si después de distribuir sobre mora+interés+capital de ESTA cuota todavía queda saldo,
  // significa que el cliente pagó de más. Lo registramos en notas para auditoría.
  // (No se acredita automáticamente a cuotas futuras — el gestor decide.)
  let excedente = 0
  if (resto > 0) {
    excedente = resto
    resto = 0
  }

  const totalPagadoEnCuota = montoMoraPagada + montoInteresPagado + montoCapitalPagado
  const montoPagadoAnteriorEnCuota = pagosParcialesPrevios.reduce((s, p) => s + p.montoTotal, 0)
  const montoTotalAcumuladoCuota = montoPagadoAnteriorEnCuota + totalPagadoEnCuota

  let estadoPago: string
  let cuotaCompleta = false
  let esPagoParcial: boolean
  if (montoTotalAcumuladoCuota < totalCuotaConMora) {
    estadoPago = 'PAGO_PARCIAL'
    esPagoParcial = true
  } else {
    estadoPago = 'APLICADO'
    cuotaCompleta = true
    esPagoParcial = false
  }

  const notasPagoBase = excedente > 0
    ? `Pago con excedente de ${formatearMoneda(excedente)}. ` +
      `Recibido: ${formatearMoneda(montoTotalNum)}, distribuido: mora ${formatearMoneda(montoMoraPagada)} + interés ${formatearMoneda(montoInteresPagado)} + capital ${formatearMoneda(montoCapitalPagado)}. ` +
      `El gestor debe decidir: reembolsar o aplicar a cuota siguiente.`
    : esPagoParcial
    ? `Pago parcial de ${formatearMoneda(montoTotalNum)}. Total cuota: ${formatearMoneda(totalCuotaConMora)}. Acumulado: ${formatearMoneda(montoTotalAcumuladoCuota)}. Faltan: ${formatearMoneda(totalCuotaConMora - montoTotalAcumuladoCuota)}`
    : montoPagadoAnteriorEnCuota > 0
    ? `Pago final de ${formatearMoneda(montoTotalNum)}. Cuota completada con pagos parciales previos de ${formatearMoneda(montoPagadoAnteriorEnCuota)}. Total cuota: ${formatearMoneda(totalCuotaConMora)}.`
    : null

  // Añadir nota de mora renegociada si aplica
  const notaMoraRenegociada = moraEsRenegociada
    ? `[MORA RENEGOCIADA] Se utilizó el valor acordado de ${formatearMoneda(moraGenerada)} ` +
      `(acción: ${prestamo.moraRenegociadaAccion}) en lugar del cálculo compuesto diario. `
    : diasMora > 0
    ? `[MORA COMPUESTA DIARIA] ${diasMora} días de atraso × tasa ${(tasaMoraEfectiva / 360).toFixed(6)}% diario = ${formatearMoneda(moraGenerada)}. `
    : null

  const notasPago = notaMoraRenegociada
    ? (notasPagoBase ? notaMoraRenegociada + notasPagoBase : notaMoraRenegociada)
    : notasPagoBase

  // === TRANSACCIÓN atómica v4.0 ===
  // Pago create → caja movimiento → recálculo saldos son atómicos.
  // Si algo falla a mitad, todo se revierte y la BD queda consistente.
  const resultado = await db.$transaction(async (tx) => {
    // 1. Crear o actualizar pago
    const pago = pagoExistente
      ? await tx.pago.update({
          where: { id: pagoExistente.id },
          data: {
            montoCapital: montoCapitalPagado,
            montoInteres: montoInteresPagado,
            montoMora: montoMoraPagada,
            montoTotal: montoTotalNum,
            fechaPago: new Date(),
            metodoPago: metodoPago || 'EFECTIVO',
            referencia: referencia || null,
            cuentaRecaudoId: cuentaFinalPago,
            estado: estadoPago,
            notas: notasPago,
          },
        })
      : await tx.pago.create({
          data: {
            prestamoId,
            numeroCuota: parseInt(numeroCuota),
            montoCapital: montoCapitalPagado,
            montoInteres: montoInteresPagado,
            montoMora: montoMoraPagada,
            montoTotal: montoTotalNum,
            fechaPago: new Date(),
            fechaVencimiento: cuota.fechaVencimiento,
            metodoPago: metodoPago || 'EFECTIVO',
            referencia: referencia || null,
            cuentaRecaudoId: cuentaFinalPago,
            estado: estadoPago,
            notas: notasPago,
          },
        })

    // 2. Recalcular saldos del préstamo (también dentro de la transacción)
    //    Lo hacemos manualmente para mantener tx
    const prestamoCompleto = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: { pagos: true },
    })
    if (prestamoCompleto) {
      const pagosValidos = prestamoCompleto.pagos.filter(
        (p) => p.estado === 'APLICADO' || p.estado === 'PAGO_PARCIAL'
      )
      const montoPagado = pagosValidos.reduce((s, p) => s + p.montoTotal, 0)
      const montoCapitalPagadoSum = pagosValidos.reduce((s, p) => s + p.montoCapital, 0)
      const montoInteresPagadoSum = pagosValidos.reduce((s, p) => s + p.montoInteres, 0)
      const montoMoraPagadoSum = pagosValidos.reduce((s, p) => s + p.montoMora, 0)
      const saldoCapital = Math.max(0, prestamoCompleto.montoPrincipal - montoCapitalPagadoSum)
      const saldoInteres = Math.max(0, prestamoCompleto.totalInteres - montoInteresPagadoSum)
      const saldoTotal = Math.max(0, prestamoCompleto.totalPagar - montoPagado)
      const cuotasPagadas = new Set(
        prestamoCompleto.pagos.filter((p) => p.estado === 'APLICADO').map((p) => p.numeroCuota)
      ).size

      let nuevoEstado = prestamoCompleto.estado
      if (cuotasPagadas >= prestamoCompleto.numeroCuotas || saldoTotal <= 0) {
        nuevoEstado = 'CANCELADO'
      } else if (prestamoCompleto.estado === 'EN_MORA' && pagosValidos.length > 0) {
        nuevoEstado = 'ACTIVO'
      } else if (prestamoCompleto.estado === 'CANCELADO' && saldoTotal > 0) {
        nuevoEstado = 'ACTIVO'
      }

      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          montoPagado, saldoCapital, saldoInteres, saldoTotal,
          cuotasPagadas, montoMora: Math.max(0, prestamoCompleto.montoMora - montoMoraPagadoSum),
          estado: nuevoEstado,
        },
      })
    }

    // 3. Movimiento de caja por mora cobrada
    if (montoMoraPagada > 0) {
      const cajaMora = await tx.cajaMenor.findUnique({ where: { codigo: 'CAJA-MORA' } })
      if (cajaMora) {
        await tx.movimientoCaja.create({
          data: {
            cajaId: cajaMora.id,
            tipo: 'INGRESO',
            monto: montoMoraPagada,
            concepto: `Mora cobrada - Préstamo ${prestamo.codigo} - Cuota ${numeroCuota}`,
            referencia: prestamo.codigo,
            prestamoId,
            usuarioId: user.id,
          },
        })
        await tx.cajaMenor.update({
          where: { id: cajaMora.id },
          data: {
            saldoActual: { increment: montoMoraPagada },
            totalIngresos: { increment: montoMoraPagada },
          },
        })
      }
    }

    return { pago, estadisticas: { saldoTotal: prestamoCompleto?.saldoTotal || 0 } }
  })

  const { pago } = resultado
  // Recalcular saldos fuera de la tx para devolver estadísticas frescas
  const { prestamo: prestamoActualizado, estadisticas } = await recalcularSaldosPrestamo(prestamoId)

  // WhatsApp (fuera de la tx — no es crítico para consistencia)
  const proximaCuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota) + 1)
  const estadoFinal = estadisticas.nuevoEstado
  const mensaje = estadoFinal === 'CANCELADO'
    ? mensajePrestamoCancelado({
        nombreCliente: prestamo.cliente.nombre,
        codigoPrestamo: prestamo.codigo,
        montoTotal: estadisticas.montoPagado,
        fechaCancelacion: formatearFecha(new Date()),
      })
    : mensajePagoAplicado({
        nombreCliente: prestamo.cliente.nombre,
        codigoPrestamo: prestamo.codigo,
        montoPagado: montoTotalNum,
        cuotaNumero: parseInt(numeroCuota),
        totalCuotas: prestamo.numeroCuotas,
        saldoRestante: estadisticas.saldoTotal,
        proximoPago: proximaCuota ? formatearFecha(proximaCuota.fechaVencimiento) : '—',
        proximoMonto: proximaCuota?.montoCuota || 0,
      })

  const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
  await guardarNotificacion({
    db, prestamoId,
    telefono: prestamo.cliente.telefono,
    tipo: estadoFinal === 'CANCELADO' ? 'CANCELACION' : 'PAGO',
    mensaje, envio,
  })

  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'PAGO_APLICADO', modulo: 'pagos',
    entidadId: pago.id, entidadNombre: `Pago ${pago.codigo || pago.id} - Cuota ${numeroCuota}`,
    detalles: JSON.stringify({
      prestamoId, numeroCuota, monto: montoTotalNum, metodo: metodoPago || 'EFECTIVO',
      estado: estadoPago, capital: montoCapitalPagado, interes: montoInteresPagado, mora: montoMoraPagada,
    }),
    ipOrigen: '', userAgent: '',
  })

  // Bitácora del préstamo (pago aplicado / pago parcial / pago con excedente)
  try {
    const tituloBit = excedente > 0
      ? `Pago con excedente aplicado — cuota ${numeroCuota}`
      : esPagoParcial
      ? `Pago parcial aplicado — cuota ${numeroCuota}`
      : `Pago aplicado — cuota ${numeroCuota}`
    const descBit = `Monto recibido: ${formatearMoneda(montoTotalNum)}. ` +
      `Distribuido: mora ${formatearMoneda(montoMoraPagada)} + interés ${formatearMoneda(montoInteresPagado)} + capital ${formatearMoneda(montoCapitalPagado)}. ` +
      `Método: ${metodoPago || 'EFECTIVO'}. Referencia: ${referencia || 'sin referencia'}. ` +
      (excedente > 0 ? `EXCEDENTE de ${formatearMoneda(excedente)} pendiente de decisión del gestor. ` : '') +
      `Estado del pago: ${estadoPago}. Nuevo saldo del préstamo: ${formatearMoneda(prestamoActualizado?.saldoTotal ?? 0)}.`
    await db.bitacoraPrestamo.create({
      data: {
        prestamoId,
        prestamoCodigo: prestamo.codigo,
        usuarioNombre: user?.nombre || 'Sistema',
        tipo: 'PAGO',
        titulo: tituloBit,
        descripcion: descBit,
        resultado: `Pago ${pago.id} registrado; préstamo en estado ${prestamoActualizado?.estado ?? '?'}`,
      },
    })
  } catch (e) {
    console.error('[pagos] bitácora falló:', e)
  }

  return NextResponse.json({
    success: true,
    data: pago,
    prestamo: prestamoActualizado,
    whatsapp: envio,
    moraCobrada: montoMoraPagada,
    esPagoParcial,
    excedente,
    montoFaltanteCuota: esPagoParcial ? (totalCuotaConMora - montoTotalAcumuladoCuota) : 0,
  })
}

// =====================================================
// ACCIÓN: Aplicar SOLO INTERESES (v4.0 — NUEVO)
// -----------------------------------------------------
// El cliente paga únicamente los intereses de la cuota pendiente.
// El capital de esa cuota NO se paga; en su lugar, la cuota se
// "aplaza" (se corre a la siguiente fecha de vencimiento) y NO
// genera mora mientras tanto, porque el cliente al menos pagó
// los intereses.
//
// Lógica:
//   1. Identificar la cuota pendiente actual (proximaCuotaNum).
//   2. Calcular intereses pendientes de esa cuota (descontando
//      intereses ya pagados en pagos parciales previos).
//   3. Validar que el monto recibido cubra esos intereses.
//   4. Crear pago con:
//        - estado = APLICADO (los intereses sí están pagados)
//        - esSoloIntereses = true
//        - montoCapital = 0
//        - montoInteres = intereses de la cuota
//        - montoMora = 0 (no aplica mora en este modo)
//        - montoTotal = monto recibido
//        - cuotaAplazadaDe = numero de cuota original
//        - fechaOriginalVencimiento = vencimiento original
//   5. Recalcular la fecha de vencimiento de esa cuota, corriendo
//      un periodo (según frecuencia: +1 mes, +15 días, +1 semana).
//      Implementación: crear un registro PagoProgramado con estado
//      APLAZADO y fechaVencimiento nueva, para que la próxima
//      consulta de "próximos pagos" lo muestre en la nueva fecha.
//   6. NO contar esta cuota como "pagada" para fines de avance
//      (porque el capital sigue pendiente).
//   7. El préstamo no entra en mora por esa cuota mientras tenga
//      el aplazamiento activo.
// =====================================================
async function aplicarSoloIntereses(body: any, user: any) {
  const { prestamoId, montoTotal, metodoPago, referencia, cuentaRecaudoId, observacion } = body

  if (!prestamoId || !montoTotal) {
    return NextResponse.json(
      { success: false, error: 'prestamoId y montoTotal son obligatorios' },
      { status: 400 }
    )
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: {
        include: {
          cuentaRecaudo: true,
          categoria: { include: { cuentaRecaudo: true } },
        },
      },
      pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } },
      pagosProgramados: true,
    },
  })
  if (!prestamo) return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })

  // Validación de cuenta asignada (igual que pago normal — auto-corrección v4.0.1)
  const cliente = prestamo.cliente
  const instruccionActiva = cliente.instruccionCuentaId &&
    (!cliente.instruccionCuentaExpira || new Date(cliente.instruccionCuentaExpira) > new Date())
  const cuentaAsignada = instruccionActiva
    ? cliente.instruccionCuentaId
    : (cliente.cuentaRecaudoId || cliente.categoria?.cuentaRecaudoId || null)
  const cuentaFinalPago =
    cuentaAsignada && cuentaRecaudoId && cuentaRecaudoId !== cuentaAsignada
      ? cuentaAsignada
      : (cuentaRecaudoId || cuentaAsignada || null)

  // === Calcular tabla de amortización ===
  const calculo = calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraAnual(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: prestamo.fechaDesembolso || undefined,
  })

  // === Identificar la cuota pendiente actual ===
  const cuotasPagadasCompletamente = new Set(
    prestamo.pagos
      .filter((p) => p.estado === 'APLICADO' && !p.esSoloIntereses)
      .map((p) => p.numeroCuota)
  )
  const proximaCuotaNum = Array.from(cuotasPagadasCompletamente).length + 1
  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuotaNum)
  if (!cuota) {
    return NextResponse.json(
      { success: false, error: 'No hay cuota pendiente para aplicar solo intereses.' },
      { status: 400 }
    )
  }

  // === Calcular intereses pendientes de esa cuota ===
  const pagosPreviosCuota = prestamo.pagos.filter(
    (p) => p.numeroCuota === proximaCuotaNum && !p.esSoloIntereses
  )
  const interesPagadoAnterior = pagosPreviosCuota.reduce((s, p) => s + p.montoInteres, 0)
  const interesPendienteCuota = Math.max(0, cuota.interes - interesPagadoAnterior)

  if (interesPendienteCuota <= 0) {
    return NextResponse.json(
      { success: false, error: 'Esta cuota no tiene intereses pendientes (ya fueron pagados).' },
      { status: 400 }
    )
  }

  const montoRecibidoNum = parseFloat(montoTotal)

  // Verificar si ya existe un aplazamiento activo para esta cuota
  const aplazamientoExistente = prestamo.pagosProgramados.find(
    (pp) => pp.numeroCuota === proximaCuotaNum && pp.aplazado && pp.estado === 'APLAZADO'
  )
  if (aplazamientoExistente) {
    return NextResponse.json(
      {
        success: false,
        error: `Esta cuota ya tiene un aplazamiento activo (vence el ${formatearFecha(aplazamientoExistente.fechaVencimiento)}). Aplica el pago normal para cerrarla.`,
      },
      { status: 400 }
    )
  }

  // === Calcular nueva fecha de vencimiento (un periodo después) ===
  const fechaOriginal = cuota.fechaVencimiento
  const fechaNueva = calcularFechaVencimiento(fechaOriginal, 1, prestamo.frecuencia as any)

  // === TRANSACCIÓN atómica ===
  const resultado = await db.$transaction(async (tx) => {
    // 1. Crear el pago de solo intereses
    const pago = await tx.pago.create({
      data: {
        prestamoId,
        numeroCuota: proximaCuotaNum,
        montoCapital: 0,
        montoInteres: montoRecibidoNum,
        montoMora: 0,
        montoTotal: montoRecibidoNum,
        fechaPago: new Date(),
        fechaVencimiento: cuota.fechaVencimiento,
        metodoPago: metodoPago || 'EFECTIVO',
        referencia: referencia || null,
        cuentaRecaudoId: cuentaFinalPago,
        estado: 'APLICADO',
        esSoloIntereses: true,
        cuotaAplazadaDe: proximaCuotaNum,
        fechaOriginalVencimiento: fechaOriginal,
        notas: `Pago de SOLO INTERESES de la cuota ${proximaCuotaNum}. Capital aplazado. ` +
               `Vencimiento original: ${formatearFecha(fechaOriginal)} → nuevo vencimiento: ${formatearFecha(fechaNueva)}.` +
               (observacion ? ` Observación: ${observacion}` : ''),
      },
    })

    // 2. Crear/actualizar registro de PagoProgramado con estado APLAZADO
    //    Esto es lo que "corre" la cuota a la siguiente fecha.
    const ppExistente = await tx.pagoProgramado.findUnique({
      where: { prestamoId_numeroCuota: { prestamoId, numeroCuota: proximaCuotaNum } },
    })
    if (ppExistente) {
      await tx.pagoProgramado.update({
        where: { id: ppExistente.id },
        data: {
          estado: 'APLAZADO',
          aplazado: true,
          fechaOriginalVencimiento: fechaOriginal,
          fechaVencimiento: fechaNueva,
          fechaUltimaActualizacion: new Date(),
        },
      })
    } else {
      await tx.pagoProgramado.create({
        data: {
          prestamoId,
          numeroCuota: proximaCuotaNum,
          fechaVencimiento: fechaNueva,
          fechaOriginalVencimiento: fechaOriginal,
          montoCapital: cuota.capital,
          montoInteres: 0, // ya se pagaron los intereses
          montoCuota: cuota.capital, // solo queda el capital por pagar
          saldoCapitalDespues: cuota.saldoCapital,
          estado: 'APLAZADO',
          aplazado: true,
          montoPagado: montoRecibidoNum,
        },
      })
    }

    // 3. Actualizar saldos del préstamo
    //    NOTA: NO incrementamos cuotasPagadas porque el capital sigue pendiente.
    //    El saldoTotal NO cambia porque el capital sigue debiéndose.
    //    Solo actualizamos montoPagado y montoInteresPagado implícitamente
    //    vía recalcularSaldosPrestamo.
    return { pago, fechaNueva, fechaOriginal }
  })

  // Recalcular saldos (el pago SÍ cuenta como pago aplicado para montoPagado,
  // pero como montoCapital=0, el saldoCapital no baja)
  const { prestamo: prestamoActualizado, estadisticas } = await recalcularSaldosPrestamo(prestamoId)

  // WhatsApp
  const mensaje =
    `Hola ${prestamo.cliente.nombre}, registraste un pago de SOLO INTERESES por ${formatearMoneda(montoRecibidoNum)} ` +
    `correspondiente a la cuota ${proximaCuotaNum} del préstamo ${prestamo.codigo}. ` +
    `El capital de esta cuota fue aplazado y tu nuevo vencimiento es el ${formatearFecha(resultado.fechaNueva)}. ` +
    `Gracias por mantener tus intereses al día.`
  const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
  await guardarNotificacion({
    db, prestamoId,
    telefono: prestamo.cliente.telefono,
    tipo: 'PAGO', mensaje, envio,
  })

  // Auditoría
  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'PAGO_SOLO_INTERESES', modulo: 'pagos',
    entidadId: resultado.pago.id,
    entidadNombre: `Pago solo intereses - Cuota ${proximaCuotaNum} - Préstamo ${prestamo.codigo}`,
    detalles: JSON.stringify({
      prestamoId, numeroCuota: proximaCuotaNum,
      montoInteres: montoRecibidoNum,
      fechaOriginal: resultado.fechaOriginal,
      fechaNueva: resultado.fechaNueva,
      observacion: observacion || null,
    }),
    ipOrigen: '', userAgent: '',
  })

  return NextResponse.json({
    success: true,
    data: resultado.pago,
    prestamo: prestamoActualizado,
    whatsapp: envio,
    esSoloIntereses: true,
    cuotaAplazada: proximaCuotaNum,
    fechaOriginalVencimiento: resultado.fechaOriginal,
    nuevaFechaVencimiento: resultado.fechaNueva,
    mensaje: `Pago de solo intereses aplicado. Cuota ${proximaCuotaNum} aplazada al ${formatearFecha(resultado.fechaNueva)}.`,
  })
}
