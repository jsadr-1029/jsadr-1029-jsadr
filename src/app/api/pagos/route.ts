import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcularSaldosPrestamo } from '@/lib/recalcular-saldos'
import {
  calcularPrestamo,
  calcularPrestamoTasaFijaMensual,
  calcularMoraCompuesta,
  calcularDiasMora, getTasaMoraDiaria,
  calcularFechaVencimiento,
  calcularCargosInicialesPendientes,
  generarCodigoPago,
  formatearFecha,
  formatearMoneda,
} from '@/lib/finanzas'
import { enviarWhatsApp, mensajePagoAplicado, mensajePrestamoCancelado, mensajeLinkPago, guardarNotificacion } from '@/lib/whatsapp'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole, getAuthUser } from '@/lib/auth-guard'
import { buildAbsoluteUrl } from '@/lib/url'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

// =====================================================
// Helper: calcular préstamo según modalidad
// -----------------------------------------------------
// Centraliza el cálculo para que TODAS las funciones de pagos usen la misma
// función según la modalidad del préstamo. Esto garantiza que el monto de
// la cuota mostrado en "Aplicar Pago", "Generar Link", "Solo Intereses" y
// "Usar Flexibilidad" coincida exactamente con el monto mostrado en el
// estado de cuenta.
//
// Antes, todas las funciones usaban calcularPrestamo (Sistema Francés)
// sin importar la modalidad, lo que causaba que para préstamos TASA_FIJA
// el capital e interés por cuota fueran inconsistentes entre vistas.
// =====================================================
function calcularPrestamoSegunModalidad(prestamo: any) {
  // === FIX (2026-08-21): usar fechaInicioAmortizacion si está disponible ===
  // Si el admin definió fechaPrimerCuota al crear el préstamo, la fecha base
  // para la amortización NO es fechaDesembolso sino fechaPrimerCuota - 1 periodo.
  // Esa fecha se guardó en prestamo.fechaInicioAmortizacion al crear el préstamo.
  // Sin esto, las fechas de vencimiento de las cuotas no coincidirían con
  // fechaPrimerCuota (el sistema contaría desde fechaDesembolso).
  const fechaBase = prestamo.fechaInicioAmortizacion || prestamo.fechaDesembolso || undefined
  if (prestamo.modalidadAmortizacion === 'TASA_FIJA') {
    return calcularPrestamoTasaFijaMensual({
      montoPrincipal: prestamo.montoPrincipal,
      tasaMensualFija: prestamo.tasaInteresMensual || prestamo.tasaInteresAnual / 12,
      numeroCuotas: prestamo.numeroCuotas,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: fechaBase,
    })
  }
  if (prestamo.modalidadAmortizacion === 'INTERES_FIJO_SIN_CAPITAL') {
    return {
      numeroCuotas: 0,
      montoCuota: prestamo.interesFijoMensual || 0,
      totalInteres: 0,
      totalPagar: prestamo.montoPrincipal,
      tasaAplicada: 0,
      tablaAmortizacion: [],
      fechaVencimiento: null,
      fondoGarantia: 0,
    }
  }
  return calcularPrestamo({
    montoPrincipal: prestamo.montoPrincipal,
    tasaInteresAnual: prestamo.tasaInteresAnual,
    tasaMoraAnual: getTasaMoraDiaria(prestamo),
    plazoMeses: prestamo.plazoMeses,
    frecuencia: prestamo.frecuencia as any,
    fechaDesembolso: fechaBase,
  })
}

// =====================================================
// /api/pagos v4.0 — OLA 1 + Solo Intereses + Flexibilidad Financiera
// -----------------------------------------------------
// GET  - listar pagos (con filtros prestamoId, fecha)
// POST - acciones:
//   accion=aplicar           → aplica pago normal (mora→interés→capital)
//   accion=generar_link      → crea link PENDIENTE + WhatsApp
//   accion=solo_intereses    → paga solo intereses, difiere capital
//                              (corre la cuota a la siguiente fecha)
//   accion=usar_flexibilidad → NUEVO (Tarea Q): usa el beneficio de
//                              Flexibilidad Financiera para trasladar
//                              la cuota pendiente actual al FINAL del
//                              crédito, junto con los intereses ya
//                              causados, evitando generación de mora.
//                              NO recibe dinero (montoTotal=0) — es
//                              un asiento contable que documenta el uso.
//                              Valida: préstamo con flexibilidad activa,
//                              >=4 cuotas, 1ra cuota paga, cuota actual >=2,
//                              usos disponibles > 0.
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
    // v4.7 (QA M04 TC-PAG-013): flag para incluir pagos ANULADOS en la respuesta.
    // Por defecto los ANULADOS se ocultan (soft-delete), pero el endpoint
    // debe poder retornarlos cuando se solicite explícitamente para auditoría.
    const incluirAnulados = searchParams.get('incluirAnulados') === 'true'

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
    // No mostrar ANULADOS por defecto (soft-delete), salvo que se solicite explícitamente
    if (!estado && !incluirAnulados) {
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
    if (accion === 'usar_flexibilidad') return await usarFlexibilidadFinanciera(body, user)
    if (accion === 'abonar_capital') return await abonarCapitalExtraordinario(body, user)
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

  // === FIX (2026-08-20): usar helper que selecciona la función correcta según modalidad ===
  const calculo = calcularPrestamoSegunModalidad(prestamo)

  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota))
  if (!cuota) {
    return NextResponse.json({ success: false, error: 'Cuota no encontrada' }, { status: 400 })
  }

  const codigo = generarCodigoPago()
  const linkPago = buildAbsoluteUrl(`/?pay=${codigo}`)
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
  const { prestamoId, numeroCuota, montoTotal, metodoPago, referencia, cuentaRecaudoId, codigo, fechaPago } = body

  if (!prestamoId || !numeroCuota || !montoTotal) {
    return NextResponse.json({ success: false, error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // === v4.7 (QA M04 TC-PAG-011/TC-PAG-012): monto debe ser > 0 (no negativo, no cero) ===
  // Antes: la validación `!montoTotal` (truthy) rechazaba 0 con mensaje confuso.
  // Ahora: validación numérica explícita, cubre 0 y negativos con codigo MONTO_INVALIDO.
  const montoTotalNumValidacion = parseFloat(montoTotal)
  if (isNaN(montoTotalNumValidacion) || montoTotalNumValidacion <= 0) {
    return NextResponse.json(
      { success: false, error: `Monto debe ser mayor a 0. Recibido: ${montoTotal}`, codigo: 'MONTO_INVALIDO' },
      { status: 400 }
    )
  }

  // === v4.7 (QA M04 TC-PAG-005): fecha no puede ser futura ===
  // Si el body trae fechaPago explícita, validar que no sea posterior a hoy.
  // (Si no viene, se usa new Date() más abajo, que siempre es válida.)
  if (fechaPago) {
    const fechaRecibida = new Date(fechaPago)
    if (!isNaN(fechaRecibida.getTime()) && fechaRecibida > new Date()) {
      return NextResponse.json(
        { success: false, error: `Fecha no puede ser futura. Recibido: ${fechaPago}`, codigo: 'FECHA_FUTURA_INVALIDA' },
        { status: 400 }
      )
    }
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

  // === v4.7 (QA M04 TC-PAG-004): validar estado del préstamo antes de aplicar pago ===
  // Estados que NO aceptan pagos: ANULADO, RECHAZADO, CANCELADO.
  // (CANCELADO = préstamo saldado; ANULADO/RECHAZADO = préstamo cancelado administrativamente)
  const ESTADOS_NO_ACEPTAN_PAGOS = ['ANULADO', 'RECHAZADO', 'CANCELADO']
  if (ESTADOS_NO_ACEPTAN_PAGOS.includes(prestamo.estado)) {
    return NextResponse.json(
      {
        success: false,
        error: `No se pueden registrar pagos a un préstamo en estado ${prestamo.estado}. Solo préstamos ACTIVO/SOLICITUD/EN_MORA/PENDIENTE_ACEPTACION aceptan pagos.`,
        codigo: 'PRESTAMO_NO_APLICA_PAGOS',
        estadoPrestamo: prestamo.estado,
      },
      { status: 409 }
    )
  }

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

  // === FIX (2026-08-20): usar helper que selecciona la función correcta según modalidad ===
  const calculo = calcularPrestamoSegunModalidad(prestamo)

  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === parseInt(numeroCuota))
  if (!cuota) return NextResponse.json({ success: false, error: 'Cuota no encontrada' }, { status: 400 })

  const tasaMoraEfectiva = getTasaMoraDiaria(prestamo)
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
    // Mora automática: interés compuesto DIARIO sobre el CAPITAL INICIAL PRESTADO
    // (política del usuario: "1% diario sobre el capital inicial prestado")
    moraGenerada = calcularMoraCompuesta(prestamo.montoPrincipal, tasaMoraEfectiva, diasMora)
  } else {
    moraGenerada = 0
  }

  const montoTotalNum = parseFloat(montoTotal)
  const totalCuotaConMora = cuota.montoCuota + moraGenerada

  // === FIX 2026-08-13 (Task 12): Cargos iniciales en cuota 1 ===
  // Los cargos únicos (pagaré + carta, tarifa plataforma, flexibilidad financiera,
  // fondo de garantía) se cobran UNA sola vez al inicio del crédito y deben ir
  // sumados a la PRIMERA CUOTA. Antes estos cargos se mostraban en el estado
  // de cuenta como "incluidos en la primera cuota" pero NUNCA se sumaban al
  // total a pagar, por lo que el cliente los veía en pantalla pero no los pagaba.
  //
  // Ahora: cuando se aplica pago a la cuota 1, calculamos los cargos pendientes
  // (los que aún no tienen flag "cobrado/aplicado") y los sumamos al total de
  // la cuota. La distribución del pago queda: mora → cargosIniciales → interés → capital.
  //
  // Solo se suman a la cuota 1 porque el texto del estado de cuenta dice
  // "Este cargo se aplica una sola vez al inicio del crédito y está incluido
  // en la primera cuota." — coherente con lo que el cliente ve en pantalla.
  const esCuotaInicial = parseInt(numeroCuota) === 1
  const cargosInicialesInfo = esCuotaInicial
    ? calcularCargosInicialesPendientes(prestamo)
    : { cargos: [], totalPendiente: 0, totalConfigurado: 0, totalYaCobrado: 0 }
  const cargosInicialesPendientesMonto = cargosInicialesInfo.totalPendiente
  const totalCuotaConCargos = totalCuotaConMora + cargosInicialesPendientesMonto

  // === DISTRIBUCIÓN PROPORCIONAL: mora → cargosIniciales → interés → capital ===
  let montoMoraPagada = 0
  let montoInteresPagado = 0
  let montoCapitalPagado = 0
  let montoCargosInicialesPagado = 0  // nuevo
  let resto = montoTotalNum

  const pagosParcialesPrevios = prestamo.pagos.filter(
    (p) => p.numeroCuota === parseInt(numeroCuota) && p.estado === 'PAGO_PARCIAL'
  )
  const interesPagadoAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoInteres, 0)
  const capitalPagadoAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoCapital, 0)
  const moraPagadaAnterior = pagosParcialesPrevios.reduce((s, p) => s + p.montoMora, 0)
  // Cargos iniciales ya pagados en pagos parciales previos (van en montoMora
  // en legacy, pero para nuevos pagos usamos un campo aparte en notas).
  // Como no hay campo dedicado, los cargos se registran como "otros" en notas
  // y se acumulan en una variable interna para saber cuánto falta.
  const cargosInicialesPagadosAnterior = pagosParcialesPrevios.reduce((s, p) => {
    // Heurística legacy: si el pago tiene notas que mencionan "CARGOS_INICIALES",
    // extraer el monto. Si no, asumir 0.
    const match = (p.notas || '').match(/CARGOS_INICIALES:(\d+(?:\.\d+)?)/)
    return s + (match ? parseFloat(match[1]) : 0)
  }, 0)
  const moraPendienteCuota = Math.max(0, moraGenerada - moraPagadaAnterior)
  const cargosInicialesPendientesDeEstePago = Math.max(0, cargosInicialesPendientesMonto - cargosInicialesPagadosAnterior)
  const interesPendienteCuota = Math.max(0, cuota.interes - interesPagadoAnterior)
  const capitalPendienteCuota = Math.max(0, cuota.capital - capitalPagadoAnterior)

  if (moraPendienteCuota > 0) {
    montoMoraPagada = Math.min(resto, moraPendienteCuota)
    resto = Math.max(0, resto - montoMoraPagada)
  }
  // === NUEVO: cargar los cargos iniciales después de mora y antes de interés ===
  if (resto > 0 && cargosInicialesPendientesDeEstePago > 0) {
    montoCargosInicialesPagado = Math.min(resto, cargosInicialesPendientesDeEstePago)
    resto = Math.max(0, resto - montoCargosInicialesPagado)
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

  const totalPagadoEnCuota = montoMoraPagada + montoInteresPagado + montoCapitalPagado + montoCargosInicialesPagado
  const montoPagadoAnteriorEnCuota = pagosParcialesPrevios.reduce((s, p) => s + p.montoTotal, 0)
  const montoTotalAcumuladoCuota = montoPagadoAnteriorEnCuota + totalPagadoEnCuota

  let estadoPago: string
  let cuotaCompleta = false
  let esPagoParcial: boolean
  // === FIX Task 12: comparar contra totalCuotaConCargos (no solo totalCuotaConMora) ===
  if (montoTotalAcumuladoCuota < totalCuotaConCargos) {
    estadoPago = 'PAGO_PARCIAL'
    esPagoParcial = true
  } else {
    estadoPago = 'APLICADO'
    cuotaCompleta = true
    esPagoParcial = false
  }

  // === Marca de cargos iniciales en notas (formato parseable: CARGOS_INICIALES:monto) ===
  // Esto permite que futuros pagos parciales sobre la cuota 1 sepan cuánto se ha
  // ido abonando a los cargos iniciales y no los vuelvan a cobrar.
  const marcaCargosIniciales = montoCargosInicialesPagado > 0
    ? `CARGOS_INICIALES:${montoCargosInicialesPagado.toFixed(2)} `
    : ''

  const notasPagoBase = excedente > 0
    ? `Pago con excedente de ${formatearMoneda(excedente)}. ` +
      `Recibido: ${formatearMoneda(montoTotalNum)}, distribuido: mora ${formatearMoneda(montoMoraPagada)} + cargos iniciales ${formatearMoneda(montoCargosInicialesPagado)} + interés ${formatearMoneda(montoInteresPagado)} + capital ${formatearMoneda(montoCapitalPagado)}. ` +
      `El gestor debe decidir: reembolsar o aplicar a cuota siguiente.`
    : esPagoParcial
    ? `Pago parcial de ${formatearMoneda(montoTotalNum)}. Total cuota (con cargos): ${formatearMoneda(totalCuotaConCargos)}. Acumulado: ${formatearMoneda(montoTotalAcumuladoCuota)}. Faltan: ${formatearMoneda(totalCuotaConCargos - montoTotalAcumuladoCuota)}`
    : montoPagadoAnteriorEnCuota > 0
    ? `Pago final de ${formatearMoneda(montoTotalNum)}. Cuota completada con pagos parciales previos de ${formatearMoneda(montoPagadoAnteriorEnCuota)}. Total cuota (con cargos): ${formatearMoneda(totalCuotaConCargos)}.`
    : null

  const notasPagoConMarca = marcaCargosIniciales + (notasPagoBase || '')

  // Añadir nota de mora renegociada si aplica
  const notaMoraRenegociada = moraEsRenegociada
    ? `[MORA RENEGOCIADA] Se utilizó el valor acordado de ${formatearMoneda(moraGenerada)} ` +
      `(acción: ${prestamo.moraRenegociadaAccion}) en lugar del cálculo compuesto diario. `
    : diasMora > 0
    ? `[MORA COMPUESTA DIARIA] ${diasMora} días de atraso × tasa ${tasaMoraEfectiva}% diario sobre capital inicial ${formatearMoneda(prestamo.montoPrincipal)} = ${formatearMoneda(moraGenerada)}. `
    : null

  const notasPago = notaMoraRenegociada
    ? (notasPagoConMarca ? notaMoraRenegociada + notasPagoConMarca : notaMoraRenegociada)
    : notasPagoConMarca

  // === TRANSACCIÓN atómica v4.0 ===
  // Pago create → caja movimiento → recálculo saldos son atómicos.
  // Si algo falla a mitad, todo se revierte y la BD queda consistente.
  // v4.7 (QA M04 TC-PAG-005): si el body trae fechaPago, se usa esa (ya validada
  // que no es futura); si no, se usa new Date() (ahora).
  const fechaPagoFinal = fechaPago ? new Date(fechaPago) : new Date()
  // === FIX Task 12: declarar variables fuera de la transacción para poder
  // usarlas en el log/respuesta después de que la tx se resuelva.
  let cargosRecienCubiertos = false
  let ajusteTotalPagar = 0
  const resultado = await db.$transaction(async (tx) => {
    // 1. Crear o actualizar pago
    // === FIX Task 12: los cargos iniciales se acumulan en `montoMora` para
    // que la suma montoCapital+montoInteres+montoMora = montoTotal (sin
    // excedente). Esto mantiene la consistencia contable del registro de pago
    // y permite que el `montoPagado` acumulado del préstamo incluya los cargos. ===
    const montoMoraConCargos = montoMoraPagada + montoCargosInicialesPagado
    const pago = pagoExistente
      ? await tx.pago.update({
          where: { id: pagoExistente.id },
          data: {
            montoCapital: montoCapitalPagado,
            montoInteres: montoInteresPagado,
            montoMora: montoMoraConCargos,
            montoTotal: montoTotalNum,
            fechaPago: fechaPagoFinal,
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
            montoMora: montoMoraConCargos,
            montoTotal: montoTotalNum,
            fechaPago: fechaPagoFinal,
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

    // === FIX Task 12: ajustar totalPagar/saldoTotal cuando se cobran cargos iniciales ===
    // Los cargos iniciales (pagaré, tarifa plataforma, flexibilidad) NO están
    // incluidos en `totalPagar` (que solo es capital + interés). Cuando el
    // pago de la cuota 1 los cubre completamente, los marcamos como cobrados
    // y ajustamos `totalPagar` para que el saldo refleje correctamente la
    // deuda total pendiente.
    //
    // Sin este ajuste, el `montoPagado` (que incluye los cargos vía montoMora)
    // reduciría el `saldoTotal` por debajo del valor real, porque estaría
    // restando cargos que NO estaban sumados en `totalPagar`.
    cargosRecienCubiertos =
      esCuotaInicial &&
      montoCargosInicialesPagado > 0 &&
      montoCargosInicialesPagado >= cargosInicialesPendientesMonto &&
      cuotaCompleta

    if (cargosRecienCubiertos && prestamoCompleto) {
      ajusteTotalPagar = cargosInicialesPendientesMonto
      // Ajustar totalPagar (y por ende saldoTotal) para incluir los cargos
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          totalPagar: { increment: ajusteTotalPagar },
          // Marcar flags de cargos aplicados
          ...(prestamo.flexibilidadFinanciera && !prestamo.flexibilidadCobroAplicado
            ? { flexibilidadCobroAplicado: true } : {}),
          ...(prestamo.cobroTarifaPlataforma && !prestamo.tarifaPlataformaCargada
            ? { tarifaPlataformaCargada: true } : {}),
        },
      })
      // Recargar préstamo con el nuevo totalPagar
      const prestamoAjustado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: { pagos: true },
      })
      if (prestamoAjustado) prestamoCompleto.totalPagar = prestamoAjustado.totalPagar
    }

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

    // === 4. NUEVO: Movimientos de caja por cargos iniciales (Task 12) ===
    // Los cargos iniciales se contabilizan como ingresos en cajas específicas:
    //   - Pagaré + Carta → CAJA-PAGARE-CARTA (si existe) o CAJA-INGRESOS-VARIOS
    //   - Tarifa Plataforma → CAJA-USO-PLATAFORMA (creada en schema)
    //   - Flexibilidad Financiera → CAJA-FLEXIBILIDAD-FINANCIERA (si existe) o CAJA-INGRESOS-VARIOS
    // Los cargos se abonaron en `montoCargosInicialesPagado` (parte del `montoMora`
    // del pago para mantener compatibilidad legacy). Aquí se registran por separado
    // para trazabilidad contable.
    if (montoCargosInicialesPagado > 0) {
      // Distribuir el monto entre los conceptos pendientes (en orden proporcional)
      let montoCargosRestante = montoCargosInicialesPagado
      for (const cargo of cargosInicialesInfo.cargos.filter(c => !c.yaCobrado)) {
        if (montoCargosRestante <= 0) break
        const montoEsteCargo = Math.min(montoCargosRestante, cargo.monto)
        montoCargosRestante -= montoEsteCargo

        // Determinar caja destino
        let codigoCaja = 'CAJA-INGRESOS-VARIOS'
        let conceptoMov = ''
        if (cargo.concepto === 'TARIFA_PLATAFORMA') {
          codigoCaja = 'CAJA-USO-PLATAFORMA'
          conceptoMov = `Tarifa Plataforma - Préstamo ${prestamo.codigo}`
        } else if (cargo.concepto === 'PAGARE_CARTA') {
          codigoCaja = 'CAJA-PAGARE-CARTA'
          conceptoMov = `Pagaré + Carta - Préstamo ${prestamo.codigo}`
        } else if (cargo.concepto === 'FLEXIBILIDAD') {
          codigoCaja = 'CAJA-FLEXIBILIDAD-FINANCIERA'
          conceptoMov = `Flexibilidad Financiera (${prestamo.flexibilidadModalidad || 'BASICA'}) - Préstamo ${prestamo.codigo}`
        } else if (cargo.concepto === 'FONDO_GARANTIA') {
          codigoCaja = 'CAJA-GARANTIA'
          conceptoMov = `Fondo de Garantía (${(prestamo.fondoGarantiaTasa ? (prestamo.fondoGarantiaTasa * 100).toFixed(2) : '5')}%) - Préstamo ${prestamo.codigo}`
        }

        const cajaCargo = await tx.cajaMenor.findUnique({ where: { codigo: codigoCaja } })
        if (cajaCargo) {
          await tx.movimientoCaja.create({
            data: {
              cajaId: cajaCargo.id,
              tipo: 'INGRESO',
              monto: montoEsteCargo,
              concepto: conceptoMov,
              referencia: prestamo.codigo,
              prestamoId,
              usuarioId: user.id,
            },
          })
          await tx.cajaMenor.update({
            where: { id: cajaCargo.id },
            data: {
              saldoActual: { increment: montoEsteCargo },
              totalIngresos: { increment: montoEsteCargo },
            },
          })
        }
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
      cargosIniciales: montoCargosInicialesPagado,
      cargosInicialesRecienCubiertos: cargosRecienCubiertos,
      ajusteTotalPagar,
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
      `Distribuido: mora ${formatearMoneda(montoMoraPagada)} + cargos iniciales ${formatearMoneda(montoCargosInicialesPagado)} + interés ${formatearMoneda(montoInteresPagado)} + capital ${formatearMoneda(montoCapitalPagado)}. ` +
      `Método: ${metodoPago || 'EFECTIVO'}. Referencia: ${referencia || 'sin referencia'}. ` +
      (excedente > 0 ? `EXCEDENTE de ${formatearMoneda(excedente)} pendiente de decisión del gestor. ` : '') +
      (cargosRecienCubiertos ? `CARGOS INICIALES cobrados por ${formatearMoneda(cargosInicialesPendientesMonto)} (ajuste totalPagar +${formatearMoneda(ajusteTotalPagar)}). ` : '') +
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
    cargosInicialesCobrados: montoCargosInicialesPagado,
    cargosInicialesRecienCubiertos: cargosRecienCubiertos,
    ajusteTotalPagar,
    esPagoParcial,
    excedente,
    montoFaltanteCuota: esPagoParcial ? (totalCuotaConCargos - montoTotalAcumuladoCuota) : 0,
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
  // === FIX (2026-08-20): usar helper que selecciona la función correcta según modalidad ===
  const calculo = calcularPrestamoSegunModalidad(prestamo)

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

// =====================================================
// ACCIÓN: USAR FLEXIBILIDAD FINANCIERA (Tarea Q)
// -----------------------------------------------------
// El cliente ejerce el beneficio de Flexibilidad Financiera que pagó
// al inicio del crédito ($15.000 = 1 uso, $34.900 = 2 usos).
//
// Efecto:
//   1. La cuota pendiente actual (con su capital + interés) se TRASLADA
//      al FINAL del crédito (después de la última cuota programada).
//   2. Los intereses moratorios ya causados (mora acumulada al momento
//      del traslado) también se añaden al monto de la cuota trasladada.
//   3. NO se genera mora futura sobre esta cuota (porque está aplazada).
//   4. NO se interpreta como pago de intereses solo (esSoloIntereses=false).
//   5. Se decrementa flexibilidadUsosDisponibles y se incrementa
//      flexibilidadUsosEjercidos. Se agrega entrada a flexibilidadMovimientos.
//   6. Se crea un OtroSiCambioFecha tipo TRASLADO_CUOTA para documento legal.
//
// Validaciones (reglas de negocio del usuario):
//   - Préstamo tiene flexibilidadActivada = true
//   - numeroCuotas >= 4 (flexibilidad solo para créditos >= 4 cuotas)
//   - cuotasPagadasCompletamente >= 1 (la prima debe estar paga)
//   - proximaCuota >= 2 (no se puede usar desde la prima)
//   - flexibilidadUsosDisponibles > 0
// =====================================================
async function usarFlexibilidadFinanciera(body: any, user: any) {
  const { prestamoId, observacion } = body

  if (!prestamoId) {
    return NextResponse.json(
      { success: false, error: 'prestamoId es obligatorio' },
      { status: 400 }
    )
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: true,
      pagos: { where: { estado: { in: ['APLICADO', 'PAGO_PARCIAL'] } } },
      pagosProgramados: true,
    },
  })
  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // === VALIDACIONES DE NEGOCIO ===
  if (!prestamo.flexibilidadActivada) {
    return NextResponse.json(
      {
        success: false,
        error: 'Este crédito no tiene activado el beneficio de Flexibilidad Financiera.',
        codigo: 'FLEX_NO_ACTIVADA',
      },
      { status: 409 }
    )
  }

  if (prestamo.numeroCuotas < 4) {
    return NextResponse.json(
      {
        success: false,
        error: `La Flexibilidad Financiera solo aplica para créditos con 4 o más cuotas. Este crédito tiene ${prestamo.numeroCuotas}.`,
        codigo: 'FLEX_PLAZO_INSUFICIENTE',
      },
      { status: 409 }
    )
  }

  if (prestamo.flexibilidadUsosDisponibles <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Ya no quedan usos disponibles de Flexibilidad Financiera. Usos ejercidos: ${prestamo.flexibilidadUsosEjercidos}.`,
        codigo: 'FLEX_SIN_USOS',
      },
      { status: 409 }
    )
  }

  // === Calcular tabla de amortización ===
  // === FIX (2026-08-20): usar helper que selecciona la función correcta según modalidad ===
  const calculo = calcularPrestamoSegunModalidad(prestamo)

  // === Identificar la cuota pendiente actual ===
  const cuotasPagadasCompletamenteSet = new Set(
    prestamo.pagos
      .filter((p) => p.estado === 'APLICADO' && !p.esSoloIntereses && !p.esFlexibilidadFinanciera)
      .map((p) => p.numeroCuota)
  )
  const cuotasPagadasCompletamente = cuotasPagadasCompletamenteSet.size

  if (cuotasPagadasCompletamente < 1) {
    return NextResponse.json(
      {
        success: false,
        error: 'La primera cuota (prima) debe estar completamente pagada antes de usar Flexibilidad Financiera. Esta condición garantiza que el cliente tiene capacidad de pago demostrada.',
        codigo: 'FLEX_PRIMA_NO_PAGA',
      },
      { status: 409 }
    )
  }

  const proximaCuotaNum = cuotasPagadasCompletamente + 1
  if (proximaCuotaNum < 2) {
    return NextResponse.json(
      {
        success: false,
        error: 'No se puede usar Flexibilidad Financiera desde la prima (primera cuota). El beneficio se activa desde la segunda cuota en adelante.',
        codigo: 'FLEX_DESDE_PRIMA',
      },
      { status: 409 }
    )
  }

  const cuota = calculo.tablaAmortizacion.find((c) => c.numero === proximaCuotaNum)
  if (!cuota) {
    return NextResponse.json(
      { success: false, error: 'No hay cuota pendiente para trasladar.' },
      { status: 400 }
    )
  }

  // === Calcular intereses moratorios ya causados (si la cuota está vencida) ===
  const tasaMoraEfectiva = getTasaMoraDiaria(prestamo)
  const diasMora = calcularDiasMora(cuota.fechaVencimiento)
  let interesesCausados = 0
  if (diasMora > 0) {
    interesesCausados = calcularMoraCompuesta(prestamo.montoPrincipal, tasaMoraEfectiva, diasMora)
  }

  // === Calcular la nueva fecha de vencimiento al FINAL del crédito ===
  // Tomamos la última cuota de la tabla de amortización y le sumamos 1 periodo
  const ultimaCuota = calculo.tablaAmortizacion[calculo.tablaAmortizacion.length - 1]
  if (!ultimaCuota || !ultimaCuota.fechaVencimiento) {
    return NextResponse.json(
      { success: false, error: 'No se pudo calcular la última cuota del crédito.' },
      { status: 500 }
    )
  }

  // Nueva fecha = última cuota + 1 periodo (según frecuencia)
  const fechaVencimientoOriginal = cuota.fechaVencimiento
  const fechaVencimientoNueva = calcularFechaVencimiento(ultimaCuota.fechaVencimiento, 1, prestamo.frecuencia as any)

  // === TRANSACCIÓN ATÓMICA ===
  const resultado = await db.$transaction(async (tx) => {
    // 1. Crear el registro de "pago" documentando el uso del beneficio
    //    (montoTotal=0 porque no se recibe dinero — el cliente ya pagó el costo al inicio)
    const pago = await tx.pago.create({
      data: {
        prestamoId,
        numeroCuota: proximaCuotaNum,
        montoCapital: 0,
        montoInteres: 0,
        montoMora: 0,
        montoTotal: 0,
        fechaPago: new Date(),
        fechaVencimiento: cuota.fechaVencimiento,
        metodoPago: 'FLEXIBILIDAD_FINANCIERA',
        referencia: `Uso de Flexibilidad Financiera - Cuota ${proximaCuotaNum} trasladada al final`,
        estado: 'APLICADO',
        esFlexibilidadFinanciera: true,
        cuotaMovidaAlFinal: true,
        cuotaTrasladadaNumero: proximaCuotaNum,
        fechaVencimientoOriginalTraslado: fechaVencimientoOriginal,
        fechaVencimientoNuevoTraslado: fechaVencimientoNueva,
        interesesCausadosAlTraslado: interesesCausados,
        flexibilidadModalidadUso: prestamo.flexibilidadModalidad || 'BASICA',
        notas:
          `USO DE FLEXIBILIDAD FINANCIERA (${prestamo.flexibilidadModalidad || 'BASICA'}). ` +
          `Cuota ${proximaCuotaNum} trasladada al FINAL del crédito. ` +
          `Vencimiento original: ${formatearFecha(fechaVencimientoOriginal)} → nuevo vencimiento: ${formatearFecha(fechaVencimientoNueva)}. ` +
          `Intereses moratorios causados al momento del traslado: ${formatearMoneda(interesesCausados)} (incluidos en la cuota trasladada, NO se cobran aparte). ` +
          `Capital de la cuota trasladada: ${formatearMoneda(cuota.capital)}. Interés original: ${formatearMoneda(cuota.interes)}. ` +
          `Total a pagar en la cuota trasladada (al final del crédito): ${formatearMoneda(cuota.capital + cuota.interes + interesesCausados)}. ` +
          `Usos restantes después de este: ${prestamo.flexibilidadUsosDisponibles - 1} de ${prestamo.flexibilidadModalidad === 'PREMIUM' ? 2 : 1}.` +
          (observacion ? ` Observación del gestor: ${observacion}` : ''),
      },
    })

    // 2. Crear/actualizar PagoProgramado de la cuota trasladada
    //    - Si ya existía un PagoProgramado para esta cuota, lo marcamos como TRASLADADA_FLEXIBILIDAD
    //    - Creamos un NUEVO PagoProgramado con numeroCuota aumentado (ej: cuota 3 → cuota 3 + 100 = 103 para que aparezca al final)
    //    Mantener el número original de cuota en PagoProgramado no funcionaría porque
    //    el índice único (prestamoId, numeroCuota) chocaría. Por eso usamos el esquema:
    //    la cuota original se marca TRASLADADA_FLEXIBILIDAD con fechaOriginalVencimiento guardada,
    //    y se crea un NUEVO PagoProgramado con numeroCuota = 1000 + proximaCuotaNum para
    //    indicar que es una cuota "extraíña" (trasladada por flexibilidad).
    const ppExistente = await tx.pagoProgramado.findUnique({
      where: { prestamoId_numeroCuota: { prestamoId, numeroCuota: proximaCuotaNum } },
    })
    if (ppExistente) {
      await tx.pagoProgramado.update({
        where: { id: ppExistente.id },
        data: {
          estado: 'TRASLADADA_FLEXIBILIDAD',
          aplazado: true,
          fechaOriginalVencimiento: fechaVencimientoOriginal,
          fechaUltimaActualizacion: new Date(),
        },
      })
    }

    // Crear el NUEVO PagoProgramado para la cuota trasladada
    // Usamos un numeroCuota alto (9000+proximaCuotaNum) para que aparezca al final
    // en consultas ORDER BY numeroCuota y no choque con cuotas regulares.
    const numeroCuotaNueva = 9000 + proximaCuotaNum
    const montoCapitalTraslado = cuota.capital
    const montoInteresTraslado = cuota.interes + interesesCausados // interés original + mora causada
    const montoCuotaTraslado = montoCapitalTraslado + montoInteresTraslado

    // Borrar si ya existía (idempotencia)
    await tx.pagoProgramado.deleteMany({
      where: { prestamoId, numeroCuota: numeroCuotaNueva }
    })

    await tx.pagoProgramado.create({
      data: {
        prestamoId,
        numeroCuota: numeroCuotaNueva,
        fechaVencimiento: fechaVencimientoNueva,
        montoCapital: montoCapitalTraslado,
        montoInteres: montoInteresTraslado,
        montoCuota: montoCuotaTraslado,
        saldoCapitalDespues: cuota.saldoCapital,
        estado: 'TRASLADADA_FLEXIBILIDAD',
        montoPagado: 0,
        moraCalculada: 0,
        diasMora: 0,
        fechaOriginalVencimiento: fechaVencimientoOriginal,
        aplazado: true,
        fechaUltimaActualizacion: new Date(),
      },
    })

    // 3. Actualizar el préstamo: decrementar usos disponibles, incrementar ejercidos,
    //    agregar movimiento al JSON de bitácora
    const movimientosPrevios: any[] = prestamo.flexibilidadMovimientos
      ? JSON.parse(prestamo.flexibilidadMovimientos)
      : []

    const nuevoMovimiento = {
      fechaUso: new Date().toISOString(),
      cuotaTrasladada: proximaCuotaNum,
      vencimientoOriginal: fechaVencimientoOriginal.toISOString(),
      vencimientoNuevo: fechaVencimientoNueva.toISOString(),
      interesesCausados,
      modalidadUso: prestamo.flexibilidadModalidad || 'BASICA',
      pagoId: pago.id,
      usuarioNombre: user?.nombre || 'Sistema',
      observacion: observacion || null,
    }

    await tx.prestamo.update({
      where: { id: prestamoId },
      data: {
        flexibilidadUsosDisponibles: { decrement: 1 },
        flexibilidadUsosEjercidos: { increment: 1 },
        flexibilidadMovimientos: JSON.stringify([...movimientosPrevios, nuevoMovimiento]),
      },
    })

    // 4. Crear Otro Sí de traslado de cuota (documento legal)
    const codigoOtroSi = `OS-${String(Date.now()).slice(-6)}`
    const fechasArray = [{
      cuota: proximaCuotaNum,
      fechaAnterior: fechaVencimientoOriginal.toISOString().split('T')[0],
      fechaNueva: fechaVencimientoNueva.toISOString().split('T')[0],
    }]
    await tx.otroSiCambioFecha.create({
      data: {
        prestamoId,
        codigo: codigoOtroSi,
        tipoModificacion: 'TRASLADO_CUOTA',
        fechasAnteriores: JSON.stringify(fechasArray),
        fechasNuevas: JSON.stringify(fechasArray),
        descripcion:
          `Mediante el uso del beneficio de Flexibilidad Financiera (${prestamo.flexibilidadModalidad || 'BASICA'}), ` +
          `la cuota ${proximaCuotaNum} con vencimiento original el ${formatearFecha(fechaVencimientoOriginal)} ` +
          `se traslada al final del crédito con nuevo vencimiento el ${formatearFecha(fechaVencimientoNueva)}. ` +
          `Intereses moratorios causados al momento del traslado: ${formatearMoneda(interesesCausados)} (incluidos en la cuota trasladada). ` +
          `Usos disponibles restantes: ${prestamo.flexibilidadUsosDisponibles - 1}.` +
          (observacion ? ` Observación: ${observacion}` : ''),
        estado: 'FIRMADO',
        solicitadoPor: user?.nombre || 'Sistema',
        fechaFirma: new Date(),
      },
    })

    return { pago, fechaVencimientoNueva, fechaVencimientoOriginal, interesesCausados, nuevoMovimiento }
  })

  // Recalcular saldos del préstamo
  const { prestamo: prestamoActualizado } = await recalcularSaldosPrestamo(prestamoId)

  // WhatsApp al cliente
  const mensaje =
    `Hola ${prestamo.cliente.nombre}, registramos el uso de tu beneficio de Flexibilidad Financiera ` +
    `(${prestamo.flexibilidadModalidad || 'BASICA'}) en el préstamo ${prestamo.codigo}. ` +
    `La cuota ${proximaCuotaNum} (vencía el ${formatearFecha(resultado.fechaVencimientoOriginal)}) ` +
    `se trasladó al FINAL de tu crédito con nuevo vencimiento el ${formatearFecha(resultado.fechaVencimientoNueva)}. ` +
    `Los intereses moratorios causados (${formatearMoneda(resultado.interesesCausados)}) se incluyen en esa cuota, ` +
    `NO se te cobran aparte y NO se genera mora adicional por esta cuota. ` +
    `Usos disponibles restantes: ${prestamo.flexibilidadUsosDisponibles - 1}.`
  const envio = await enviarWhatsApp(prestamo.cliente.telefono, mensaje)
  await guardarNotificacion({
    db, prestamoId,
    telefono: prestamo.cliente.telefono,
    tipo: 'PAGO', mensaje, envio,
  })

  // Auditoría
  await registrarAuditLog({
    usuarioId: user.id, usuarioNombre: user.nombre,
    accion: 'FLEXIBILIDAD_FINANCIERA_USO', modulo: 'pagos',
    entidadId: resultado.pago.id,
    entidadNombre: `Uso Flexibilidad - Cuota ${proximaCuotaNum} - Préstamo ${prestamo.codigo}`,
    detalles: JSON.stringify({
      prestamoId, numeroCuota: proximaCuotaNum,
      fechaVencimientoOriginal: resultado.fechaVencimientoOriginal,
      fechaVencimientoNueva: resultado.fechaVencimientoNueva,
      interesesCausados: resultado.interesesCausados,
      modalidad: prestamo.flexibilidadModalidad,
      usosDisponiblesTrasUso: prestamo.flexibilidadUsosDisponibles - 1,
      observacion: observacion || null,
    }),
    ipOrigen: '', userAgent: '',
  })

  // Bitácora del préstamo
  try {
    await db.bitacoraPrestamo.create({
      data: {
        prestamoId,
        prestamoCodigo: prestamo.codigo,
        usuarioNombre: user?.nombre || 'Sistema',
        tipo: 'PAGO',
        titulo: `Uso de Flexibilidad Financiera — cuota ${proximaCuotaNum} trasladada al final`,
        descripcion:
          `Beneficio ejercido (${prestamo.flexibilidadModalidad || 'BASICA'}). ` +
          `Cuota ${proximaCuotaNum} trasladada del ${formatearFecha(resultado.fechaVencimientoOriginal)} ` +
          `al ${formatearFecha(resultado.fechaVencimientoNueva)}. ` +
          `Intereses moratorios causados al traslado: ${formatearMoneda(resultado.interesesCausados)} (incluidos en la cuota, no se cobran aparte). ` +
          `Usos disponibles restantes: ${prestamo.flexibilidadUsosDisponibles - 1}.`,
        resultado: `Préstamo sigue activo. Cuota ${proximaCuotaNum} reprogramada al final del crédito.`,
      },
    })
  } catch (e) {
    console.error('[pagos] bitácora flexibilidad falló:', e)
  }

  return NextResponse.json({
    success: true,
    data: resultado.pago,
    prestamo: prestamoActualizado,
    whatsapp: envio,
    esFlexibilidadFinanciera: true,
    cuotaTrasladada: proximaCuotaNum,
    fechaVencimientoOriginal: resultado.fechaVencimientoOriginal,
    nuevaFechaVencimiento: resultado.fechaVencimientoNueva,
    interesesCausadosTrasladados: resultado.interesesCausados,
    usosDisponiblesRestantes: prestamo.flexibilidadUsosDisponibles - 1,
    mensaje:
      `✅ Flexibilidad Financiera aplicada. Cuota ${proximaCuotaNum} trasladada al final del crédito ` +
      `(nuevo vencimiento: ${formatearFecha(resultado.fechaVencimientoNueva)}). ` +
      `Intereses moratorios de ${formatearMoneda(resultado.interesesCausados)} incluidos en la cuota trasladada (no se cobran aparte). ` +
      `Usos restantes: ${prestamo.flexibilidadUsosDisponibles - 1}.`,
  })
}

// =====================================================
// ACCIÓN: Abono extraordinario al capital
// -----------------------------------------------------
// Para préstamos con modalidad INTERES_FIJO_SIN_CAPITAL.
// El gestor ingresa manualmente el valor del abono al capital.
// Esto reduce el saldo real del préstamo (montoPrincipal - capitalPagadoExtra)
// pero NO cambia la cuota mensual fija de intereses (sigue siendo la misma).
//
// El pago se registra como un Pago con estado APLICADO, numeroCuota=0
// (no corresponde a una cuota programada), y se actualiza el capitalPagadoExtra
// del préstamo. El saldoTotal se recalcula como montoPrincipal - capitalPagadoExtra.
//
// Si el abono cubre todo el capital restante, el préstamo se cancela
// (estado = CANCELADO, fechaCancelacion = hoy).
// =====================================================
async function abonarCapitalExtraordinario(body: any, user: any) {
  const { prestamoId, montoAbono, metodoPago, referencia, cuentaRecaudoId, fechaPago } = body

  // === Validaciones ===
  if (!prestamoId) {
    return NextResponse.json(
      { success: false, error: 'prestamoId es obligatorio' },
      { status: 400 }
    )
  }
  const montoAbonoNum = parseFloat(montoAbono)
  if (isNaN(montoAbonoNum) || montoAbonoNum <= 0) {
    return NextResponse.json(
      { success: false, error: `El monto del abono debe ser mayor a 0. Recibido: ${montoAbono}`, codigo: 'MONTO_INVALIDO' },
      { status: 400 }
    )
  }

  // Validar fechaPago (si viene)
  if (fechaPago) {
    const fechaRecibida = new Date(fechaPago)
    if (!isNaN(fechaRecibida.getTime()) && fechaRecibida > new Date()) {
      return NextResponse.json(
        { success: false, error: `Fecha no puede ser futura. Recibido: ${fechaPago}`, codigo: 'FECHA_FUTURA_INVALIDA' },
        { status: 400 }
      )
    }
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
    },
  })
  if (!prestamo) {
    return NextResponse.json({ success: false, error: 'Préstamo no encontrado' }, { status: 404 })
  }

  // === Solo aplica para préstamos con modalidad INTERES_FIJO_SIN_CAPITAL ===
  if (prestamo.modalidadAmortizacion !== 'INTERES_FIJO_SIN_CAPITAL') {
    return NextResponse.json(
      {
        success: false,
        error: `Este tipo de abono solo aplica para préstamos con modalidad INTERES_FIJO_SIN_CAPITAL. Este préstamo tiene modalidad ${prestamo.modalidadAmortizacion}.`,
        codigo: 'MODALIDAD_NO_APLICA',
      },
      { status: 400 }
    )
  }

  // === Validar estado del préstamo ===
  const ESTADOS_NO_ACEPTAN_PAGOS = ['ANULADO', 'RECHAZADO', 'CANCELADO']
  if (ESTADOS_NO_ACEPTAN_PAGOS.includes(prestamo.estado)) {
    return NextResponse.json(
      {
        success: false,
        error: `No se pueden registrar abonos a un préstamo en estado ${prestamo.estado}.`,
        codigo: 'PRESTAMO_NO_APLICA_PAGOS',
        estadoPrestamo: prestamo.estado,
      },
      { status: 409 }
    )
  }

  // === Validar que el abono no exceda el saldo real del capital ===
  const saldoReal = prestamo.montoPrincipal - (prestamo.capitalPagadoExtra || 0)
  if (montoAbonoNum > saldoReal) {
    return NextResponse.json(
      {
        success: false,
        error: `El monto del abono (${formatearMoneda(montoAbonoNum)}) excede el saldo real del capital (${formatearMoneda(saldoReal)}). Si deseas saldar el préstamo por completo, ingresa exactamente ${formatearMoneda(saldoReal)}.`,
        codigo: 'ABONO_EXCEDE_SALDO',
        saldoReal,
        montoAbono: montoAbonoNum,
      },
      { status: 400 }
    )
  }

  // === Resolver cuenta de recaudo (igual que en aplicarPago) ===
  const cliente = prestamo.cliente
  const instruccionActiva = cliente.instruccionCuentaId &&
    (!cliente.instruccionCuentaExpira || new Date(cliente.instruccionCuentaExpira) > new Date())
  const cuentaAsignada = instruccionActiva
    ? cliente.instruccionCuentaId
    : (cliente.cuentaRecaudoId || cliente.categoria?.cuentaRecaudoId || null)
  let cuentaFinalPago: string | null
  if (cuentaAsignada && cuentaRecaudoId && cuentaRecaudoId !== cuentaAsignada) {
    cuentaFinalPago = cuentaAsignada
  } else {
    cuentaFinalPago = cuentaRecaudoId || cuentaAsignada || null
  }

  // === Calcular nuevos valores ===
  const nuevoCapitalPagadoExtra = (prestamo.capitalPagadoExtra || 0) + montoAbonoNum
  const nuevoSaldoReal = prestamo.montoPrincipal - nuevoCapitalPagadoExtra
  const prestamoSaldado = nuevoSaldoReal <= 0

  // === Generar código del pago ===
  const codigoPago = generarCodigoPago()

  // === Transacción atómica: crear pago + actualizar préstamo + registrar en caja ===
  const fechaPagoFinal = fechaPago ? new Date(fechaPago) : new Date()

  const resultado = await db.$transaction(async (tx) => {
    // 1. Crear el registro de Pago
    const pago = await tx.pago.create({
      data: {
        codigo: codigoPago,
        prestamoId,
        numeroCuota: 0,  // 0 = abono extraordinario (no es cuota programada)
        montoCapital: montoAbonoNum,  // 100% del abono va a capital
        montoInteres: 0,  // No hay interés en este abono
        montoMora: 0,  // No hay mora en este abono
        montoTotal: montoAbonoNum,
        fechaPago: fechaPagoFinal,
        fechaVencimiento: fechaPagoFinal,  // Requerido por el schema; usa la fecha del pago
        metodoPago: metodoPago || 'MANUAL',
        referencia: referencia || `Abono extraordinario al capital`,
        cuentaRecaudoId: cuentaFinalPago,
        estado: 'APLICADO',
        notas: `ABONO_EXTRAORDINARIO_CAPITAL: ${formatearMoneda(montoAbonoNum)}. Saldo real anterior: ${formatearMoneda(saldoReal)}. Nuevo saldo real: ${formatearMoneda(nuevoSaldoReal)}. Modalidad: INTERES_FIJO_SIN_CAPITAL. La cuota mensual de intereses (${formatearMoneda(prestamo.interesFijoMensual)}) NO se modifica.`,
      },
    })

    // 2. Actualizar el préstamo
    const prestamoActualizado = await tx.prestamo.update({
      where: { id: prestamoId },
      data: {
        capitalPagadoExtra: nuevoCapitalPagadoExtra,
        // Saldo real = capital - abonos extraordinarios
        saldoCapital: nuevoSaldoReal,
        saldoTotal: nuevoSaldoReal,  // Saldo real mostrado en informes
        montoPagado: prestamo.montoPagado + montoAbonoNum,
        // Si el saldo queda en 0, cancelar el préstamo
        ...(prestamoSaldado ? {
          estado: 'CANCELADO',
          fechaCancelacion: new Date(),
        } : {}),
      },
    })

    // 3. Registrar ingreso en caja (CAJA-INGRESOS-VARIOS o CAJA-CAPITAL si existe)
    try {
      const cajaCapital = await tx.cajaMenor.findFirst({
        where: { OR: [{ codigo: 'CAJA-CAPITAL' }, { codigo: 'CAJA-INGRESOS-VARIOS' }] },
      })
      if (cajaCapital) {
        await tx.movimientoCaja.create({
          data: {
            cajaId: cajaCapital.id,
            tipo: 'INGRESO',
            monto: montoAbonoNum,
            concepto: `Abono extraordinario al capital - Préstamo ${prestamo.codigo}`,
            referencia: prestamo.codigo,
            prestamoId,
            usuarioId: user.id === 'system' ? null : user.id,
          },
        })
        await tx.cajaMenor.update({
          where: { id: cajaCapital.id },
          data: {
            saldoActual: { increment: montoAbonoNum },
            totalIngresos: { increment: montoAbonoNum },
          },
        })
      }
    } catch (e) {
      console.error('[pagos abonar_capital] No se pudo registrar movimiento de caja:', e)
      // No bloquear el pago si falla el movimiento de caja
    }

    return { pago, prestamoActualizado }
  })

  // === Audit log ===
  try {
    await db.auditLog.create({
      data: {
        usuarioId: user.id === 'system' ? null : user.id,
        usuarioNombre: user.nombre,
        accion: 'ABONO_CAPITAL_EXTRAORDINARIO',
        modulo: 'pagos',
        entidadId: prestamo.id,
        entidadNombre: `Préstamo ${prestamo.codigo} - Pago ${codigoPago}`,
        detalles: JSON.stringify({
          prestamoId,
          codigoPrestamo: prestamo.codigo,
          clienteCedula: cliente.cedula,
          clienteNombre: cliente.nombre,
          montoAbono: montoAbonoNum,
          saldoRealAnterior: saldoReal,
          nuevoSaldoReal,
          capitalPagadoExtraAcumulado: nuevoCapitalPagadoExtra,
          prestamoSaldado,
          modalidadAmortizacion: prestamo.modalidadAmortizacion,
          metodoPago: metodoPago || 'MANUAL',
          referencia: referencia || '',
        }),
        ipOrigen: '',
        userAgent: '',
        exito: true,
      },
    })
  } catch (auditErr) {
    console.error('[pagos abonar_capital] Audit log falló:', auditErr)
  }

  return NextResponse.json({
    success: true,
    data: resultado.pago,
    prestamo: resultado.prestamoActualizado,
    esAbonoExtraordinario: true,
    montoAbono: montoAbonoNum,
    saldoRealAnterior: saldoReal,
    nuevoSaldoReal,
    capitalPagadoExtraAcumulado: nuevoCapitalPagadoExtra,
    prestamoSaldado,
    mensaje: prestamoSaldado
      ? `✅ Abono de ${formatearMoneda(montoAbonoNum)} aplicado al capital. El préstamo ha sido saldado completamente (saldo real: $0). Estado: CANCELADO.`
      : `✅ Abono de ${formatearMoneda(montoAbonoNum)} aplicado al capital. Nuevo saldo real: ${formatearMoneda(nuevoSaldoReal)}. La cuota mensual de intereses (${formatearMoneda(prestamo.interesFijoMensual)}) se mantiene sin cambios.`,
  })
}
