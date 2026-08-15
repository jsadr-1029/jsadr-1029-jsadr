// =====================================================
// 🕰️ Línea de Tiempo 360° — Motor de reconstrucción histórica
// =====================================================
// Funciones puras que, dado un préstamo y una fecha de corte T,
// "rebobinan" el estado del crédito al momento exacto T usando
// los eventos reales registrados (pagos, anulaciones, reversiones,
// refinanciaciones, otros-síes, cancelaciones).
//
// REGLA DE ORO:
//   - Si un evento ocurrió DESPUÉS de T, NO se aplica.
//   - Si un pago fue REVERSADO o ANULADO antes de T, se descuenta.
//   - Si el crédito fue CANCELADO antes de T, se muestra como CANCELADO
//     y el conteo se congela en su fechaCancelacion real.
//   - Si el crédito aún no existía en T (fechaDesembolso > T), NO aparece.
//
// NO inventa datos. Si no hay información suficiente, lo indica.
// =====================================================
import { PrismaClient, Prisma } from '@prisma/client'

const db = new PrismaClient()

// =====================================================
// Tipos
// =====================================================
export type EstadoPlazoHistorico =
  | 'DENTRO'
  | 'CUMPLIDO'
  | 'EXCEDIDO'
  | 'CANCELADO'
  | 'NO_APLICA'

export interface PrestamoHistorico {
  id: string
  codigo: string
  clienteId: string
  clienteNombre: string
  clienteCedula: string
  montoPrincipal: number
  tasaInteresAnual: number
  plazoMeses: number
  frecuencia: string
  numeroCuotas: number
  montoCuota: number
  totalPagar: number
  // Estado reconstruido al momento T
  estadoHistorico: string
  saldoTotalHistorico: number
  montoPagadoHistorico: number
  cuotasPagadasHistorico: number
  montoMoraHistorico: number
  diasMoraHistorico: number
  // Conteo de vigencia al momento T
  diasTranscurridos: number
  plazoTotalDias: number
  diasExcedidos: number
  estadoPlazo: EstadoPlazoHistorico
  congelado: boolean
  // Fechas relevantes
  fechaSolicitud: Date
  fechaDesembolso: Date | null
  fechaVencimiento: Date | null
  fechaCancelacionReal: Date | null
  // Auxiliares
  existiaEnT: boolean
  eventosHastaT: number
  pagosHastaT: number
}

export interface EventoTimeline {
  id: string
  prestamoId: string
  prestamoCodigo: string
  clienteId?: string
  clienteNombre?: string
  fecha: Date
  hora: string
  tipo:
    | 'SOLICITUD_CREADA'
    | 'APROBACION'
    | 'DESEMBOLSO'
    | 'PAGO'
    | 'PAGO_PARCIAL'
    | 'PAGO_REVERSADO'
    | 'PAGO_ANULADO'
    | 'MORA_RENEGOCIADA'
    | 'REFINANCIACION'
    | 'OTRO_SI'
    | 'RENOVACION'
    | 'CANCELACION'
    | 'BITACORA'
    | 'FIRMA_COMPLETADA'
    | 'NOTA'
    | 'CAMBIO_ESTADO'
  tipoDisplay: string
  icono: string
  titulo: string
  descripcion: string
  monto?: number
  usuarioNombre?: string
  metadata?: Record<string, any>
}

// =====================================================
// Helpers de fecha
// =====================================================
function calcularPlazoTotalDias(
  fechaDesembolso: Date | null,
  fechaVencimiento: Date | null,
  frecuencia: string,
  numeroCuotas: number
): number {
  if (fechaDesembolso && fechaVencimiento) {
    const diffMs = fechaVencimiento.getTime() - fechaDesembolso.getTime()
    const dias = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (dias > 0) return dias
  }
  const cuotas = numeroCuotas || 0
  switch (frecuencia) {
    case 'MENSUAL': return cuotas * 30
    case 'QUINCENAL': return cuotas * 15
    case 'SEMANAL': return cuotas * 7
    case 'DIARIO': return cuotas
    default: return cuotas * 30
  }
}

function diasEntre(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

function horaColombia(fecha: Date): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    }).format(fecha)
  } catch {
    return fecha.toISOString().slice(11, 19)
  }
}

// =====================================================
// Reconstrucción de un préstamo "as of T"
// =====================================================
export async function reconstruirPrestamoHastaFecha(
  prestamoId: string,
  fechaCorte: Date
): Promise<PrestamoHistorico | null> {
  const p = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true } },
    },
  })
  if (!p) return null

  // === ¿Existía en T? ===
  // Un préstamo "existía" en T si fue creado (fechaSolicitud) <= T
  const existiaEnT = p.fechaSolicitud <= fechaCorte
  if (!existiaEnT) {
    return {
      id: p.id,
      codigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre: p.cliente?.nombre || '',
      clienteCedula: p.cliente?.cedula || '',
      montoPrincipal: p.montoPrincipal,
      tasaInteresAnual: p.tasaInteresAnual,
      plazoMeses: p.plazoMeses,
      frecuencia: p.frecuencia,
      numeroCuotas: p.numeroCuotas,
      montoCuota: p.montoCuota,
      totalPagar: p.totalPagar,
      estadoHistorico: 'NO_EXISTIA',
      saldoTotalHistorico: 0,
      montoPagadoHistorico: 0,
      cuotasPagadasHistorico: 0,
      montoMoraHistorico: 0,
      diasMoraHistorico: 0,
      diasTranscurridos: 0,
      plazoTotalDias: 0,
      diasExcedidos: 0,
      estadoPlazo: 'NO_APLICA',
      congelado: false,
      fechaSolicitud: p.fechaSolicitud,
      fechaDesembolso: p.fechaDesembolso,
      fechaVencimiento: p.fechaVencimiento,
      fechaCancelacionReal: p.fechaCancelacion,
      existiaEnT: false,
      eventosHastaT: 0,
      pagosHastaT: 0,
    }
  }

  // === Determinar estado histórico ===
  let estadoHistorico: string

  // ¿Fue cancelado antes o en T?
  const fechaCancelacionReal = p.fechaCancelacion
  if (p.estado === 'CANCELADO' && fechaCancelacionReal && fechaCancelacionReal <= fechaCorte) {
    estadoHistorico = 'CANCELADO'
  } else if (p.estado === 'RECHAZADO' && p.updatedAt <= fechaCorte) {
    estadoHistorico = 'RECHAZADO'
  } else if (!p.fechaDesembolso || p.fechaDesembolso > fechaCorte) {
    // Existía la solicitud pero no se había desembolsado
    estadoHistorico = p.tycAceptado && p.tycFechaAceptacion && p.tycFechaAceptacion <= fechaCorte
      ? 'PENDIENTE_ACEPTACION'
      : 'SOLICITUD'
  } else {
    // Estaba desembolsado en T: hay que reconstruir saldos
    // Si actualmente está en mora/juridico pero la fecha de mora es posterior a T,
    // lo mostramos como ACTIVO. Si no tenemos fecha exacta de entrada en mora,
    // asumimos que si diasMoraHistorico > 0 en T, estaba en mora.
    estadoHistorico = 'ACTIVO' // se ajusta abajo según mora histórica
  }

  // === Reconstruir saldos y pagos hasta T ===
  // Cargar TODOS los pagos APLICADOS o PAGO_PARCIAL hasta T (excluyendo reversados/anulados antes de T)
  const pagos = await db.pago.findMany({
    where: {
      prestamoId: p.id,
      OR: [
        { estado: 'APLICADO' },
        { estado: 'PAGO_PARCIAL' },
      ],
    },
    select: {
      id: true,
      montoTotal: true,
      montoCapital: true,
      montoInteres: true,
      montoMora: true,
      numeroCuota: true,
      fechaPago: true,
      estado: true,
      fechaAnulacion: true,
      fechaReversion: true,
    },
  })

  // Filtrar pagos válidos hasta T
  let pagosValidosHastaT = 0
  let montoPagadoHistorico = 0
  let montoCapitalPagado = 0
  let montoInteresPagado = 0
  let montoMoraPagado = 0
  let cuotasPagadasSet = new Set<number>()

  for (const pago of pagos) {
    if (!pago.fechaPago || pago.fechaPago > fechaCorte) continue
    // ¿Fue reversado/anulado antes de T?
    if (pago.estado === 'ANULADO' || pago.estado === 'REVERSADO') continue
    if (pago.fechaAnulacion && pago.fechaAnulacion <= fechaCorte) continue
    if (pago.fechaReversion && pago.fechaReversion <= fechaCorte) continue

    pagosValidosHastaT++
    montoPagadoHistorico += pago.montoTotal
    montoCapitalPagado += pago.montoCapital
    montoInteresPagado += pago.montoInteres
    montoMoraPagado += pago.montoMora
    if (pago.montoTotal >= p.montoCuota * 0.5) {
      cuotasPagadasSet.add(pago.numeroCuota)
    }
  }

  const cuotasPagadasHistorico = cuotasPagadasSet.size

  // === Reconstruir saldo ===
  let saldoTotalHistorico: number
  let montoMoraHistorico: number
  let diasMoraHistorico: number

  if (estadoHistorico === 'CANCELADO') {
    // Crédito cancelado: saldo 0
    saldoTotalHistorico = 0
    montoMoraHistorico = 0
    diasMoraHistorico = 0
  } else if (estadoHistorico === 'SOLICITUD' || estadoHistorico === 'PENDIENTE_ACEPTACION' || estadoHistorico === 'RECHAZADO') {
    saldoTotalHistorico = p.totalPagar
    montoMoraHistorico = 0
    diasMoraHistorico = 0
  } else {
    // Estaba activo en T
    saldoTotalHistorico = Math.max(0, p.totalPagar - montoPagadoHistorico)
    // Si hay pagos programados, calcular mora hasta T
    const pagosProgramados = await db.pagoProgramado.findMany({
      where: {
        prestamoId: p.id,
        fechaVencimiento: { lte: fechaCorte },
        estado: { in: ['PROGRAMADO', 'PARCIAL', 'VENCIDO'] },
      },
      select: { numeroCuota: true, fechaVencimiento: true, montoCuota: true, montoPagado: true },
    })

    diasMoraHistorico = 0
    montoMoraHistorico = 0
    let moraGenerada = 0
    for (const pp of pagosProgramados) {
      const diasAtraso = diasEntre(pp.fechaVencimiento, fechaCorte)
      if (diasAtraso > 0 && pp.montoPagado < pp.montoCuota) {
        const saldoCuota = pp.montoCuota - pp.montoPagado
        moraGenerada += saldoCuota * (p.tasaMoraDiaria / 100) * diasAtraso
        if (diasAtraso > diasMoraHistorico) diasMoraHistorico = diasAtraso
      }
    }
    montoMoraHistorico = Math.round(moraGenerada)
    // Si la mora fue renegociada antes de T, usar el valor renegociado
    if (p.moraRenegociada !== null && p.moraRenegociadaAccion && p.moraRenegociadaFecha && p.moraRenegociadaFecha <= fechaCorte) {
      montoMoraHistorico = p.moraRenegociada
    }

    // Ajustar estado: si diasMoraHistorico > 0, estaba en mora
    if (diasMoraHistorico >= 1) {
      // ¿Estaba en jurídico en T? Lo inferimos del CasoJuridico.fechaApertura
      const casoJur = await db.casoJuridico.findFirst({
        where: {
          prestamoId: p.id,
          fechaApertura: { lte: fechaCorte },
        },
        select: { fechaApertura: true, estado: true },
        orderBy: { fechaApertura: 'desc' },
      })
      estadoHistorico = casoJur ? 'JURIDICO' : 'EN_MORA'
    }
  }

  // === Conteo de vigencia al momento T ===
  const fechaInicio = p.fechaDesembolso
  const plazoTotalDias = calcularPlazoTotalDias(
    p.fechaDesembolso,
    p.fechaVencimiento,
    p.frecuencia,
    p.numeroCuotas
  )
  let diasTranscurridos = 0
  let diasExcedidos = 0
  let estadoPlazo: EstadoPlazoHistorico = 'NO_APLICA'
  let congelado = false

  if (estadoHistorico === 'CANCELADO' && fechaCancelacionReal) {
    // Congelado en la fecha real de cancelación
    congelado = true
    diasTranscurridos = diasEntre(fechaInicio!, fechaCancelacionReal)
    estadoPlazo = 'CANCELADO'
    diasExcedidos = Math.max(0, diasTranscurridos - plazoTotalDias)
  } else if (estadoHistorico === 'ACTIVO' || estadoHistorico === 'EN_MORA' || estadoHistorico === 'JURIDICO') {
    if (fechaInicio) {
      diasTranscurridos = diasEntre(fechaInicio, fechaCorte)
      if (diasTranscurridos < plazoTotalDias) estadoPlazo = 'DENTRO'
      else if (diasTranscurridos === plazoTotalDias) estadoPlazo = 'CUMPLIDO'
      else estadoPlazo = 'EXCEDIDO'
      diasExcedidos = Math.max(0, diasTranscurridos - plazoTotalDias)
    }
  }

  // === Contar eventos hasta T ===
  const eventosHastaT = pagosValidosHastaT + (estadoHistorico === 'CANCELADO' ? 1 : 0)

  return {
    id: p.id,
    codigo: p.codigo,
    clienteId: p.clienteId,
    clienteNombre: p.cliente?.nombre || '',
    clienteCedula: p.cliente?.cedula || '',
    montoPrincipal: p.montoPrincipal,
    tasaInteresAnual: p.tasaInteresAnual,
    plazoMeses: p.plazoMeses,
    frecuencia: p.frecuencia,
    numeroCuotas: p.numeroCuotas,
    montoCuota: p.montoCuota,
    totalPagar: p.totalPagar,
    estadoHistorico,
    saldoTotalHistorico,
    montoPagadoHistorico,
    cuotasPagadasHistorico,
    montoMoraHistorico,
    diasMoraHistorico,
    diasTranscurridos,
    plazoTotalDias,
    diasExcedidos,
    estadoPlazo,
    congelado,
    fechaSolicitud: p.fechaSolicitud,
    fechaDesembolso: p.fechaDesembolso,
    fechaVencimiento: p.fechaVencimiento,
    fechaCancelacionReal,
    existiaEnT: true,
    eventosHastaT,
    pagosHastaT: pagosValidosHastaT,
  }
}

// =====================================================
// Reconstrucción de TODA la cartera "as of T"
// =====================================================
export interface CarteraHistorica {
  fechaCorte: Date
  totalPrestamosExistentes: number
  creditosActivos: number
  creditosDentroPlazo: number
  creditosPlazoCumplido: number
  creditosExcedidos: number
  creditosCancelados: number
  creditosEnMora: number
  creditosJuridico: number
  creditosSolicitud: number
  carteraPendiente: number
  carteraActiva: number
  carteraMora: number
  capitalPrestado: number
  dineroRecuperado: number
  prestamos: PrestamoHistorico[]
  advertencias: string[]
}

export async function reconstruirCarteraHastaFecha(
  fechaCorte: Date
): Promise<CarteraHistorica> {
  const advertencias: string[] = []

  // Cargar todos los préstamos que existían en T (fechaSolicitud <= T)
  const todos = await db.prestamo.findMany({
    where: {
      fechaSolicitud: { lte: fechaCorte },
    },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true } },
    },
    orderBy: { fechaSolicitud: 'desc' },
  })

  const prestamosHistoricos: PrestamoHistorico[] = []

  for (const p of todos) {
    const ph = await reconstruirPrestamoHastaFecha(p.id, fechaCorte)
    if (ph && ph.existiaEnT) prestamosHistoricos.push(ph)
  }

  // Agregados
  let creditosActivos = 0
  let creditosDentroPlazo = 0
  let creditosPlazoCumplido = 0
  let creditosExcedidos = 0
  let creditosCancelados = 0
  let creditosEnMora = 0
  let creditosJuridico = 0
  let creditosSolicitud = 0
  let carteraPendiente = 0
  let carteraActiva = 0
  let carteraMora = 0
  let capitalPrestado = 0
  let dineroRecuperado = 0

  for (const p of prestamosHistoricos) {
    capitalPrestado += p.montoPrincipal
    dineroRecuperado += p.montoPagadoHistorico

    if (p.estadoHistorico === 'CANCELADO') {
      creditosCancelados++
    } else if (p.estadoHistorico === 'SOLICITUD' || p.estadoHistorico === 'PENDIENTE_ACEPTACION') {
      creditosSolicitud++
    } else if (p.estadoHistorico === 'RECHAZADO') {
      // no cuenta
    } else {
      creditosActivos++
      carteraActiva += p.saldoTotalHistorico
      carteraPendiente += p.saldoTotalHistorico
      if (p.estadoHistorico === 'EN_MORA') {
        creditosEnMora++
        carteraMora += p.saldoTotalHistorico
      } else if (p.estadoHistorico === 'JURIDICO') {
        creditosJuridico++
        carteraMora += p.saldoTotalHistorico
      }
      if (p.estadoPlazo === 'DENTRO') creditosDentroPlazo++
      else if (p.estadoPlazo === 'CUMPLIDO') creditosPlazoCumplido++
      else if (p.estadoPlazo === 'EXCEDIDO') creditosExcedidos++
    }
  }

  // Advertencia si la fecha es anterior a datos registrados
  const masAntiguo = todos.length > 0
    ? todos.reduce((min, p) => (p.fechaSolicitud < min ? p.fechaSolicitud : min), todos[0].fechaSolicitud)
    : null
  if (masAntiguo && fechaCorte < masAntiguo) {
    advertencias.push(
      `La fecha seleccionada es anterior al primer préstamo registrado (${masAntiguo.toLocaleDateString('es-CO')}). No hay datos históricos para mostrar.`
    )
  }

  return {
    fechaCorte,
    totalPrestamosExistentes: prestamosHistoricos.length,
    creditosActivos,
    creditosDentroPlazo,
    creditosPlazoCumplido,
    creditosExcedidos,
    creditosCancelados,
    creditosEnMora,
    creditosJuridico,
    creditosSolicitud,
    carteraPendiente,
    carteraActiva,
    carteraMora,
    capitalPrestado,
    dineroRecuperado,
    prestamos: prestamosHistoricos,
    advertencias,
  }
}

// =====================================================
// Línea de tiempo de eventos de un préstamo
// =====================================================
export async function obtenerEventosPrestamo(
  prestamoId: string,
  hastaFecha?: Date
): Promise<EventoTimeline[]> {
  const eventos: EventoTimeline[] = []
  const hasta = hastaFecha || new Date()

  const p = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cliente: { select: { nombre: true } } },
  })
  if (!p) return []

  const clienteNombre = p.cliente?.nombre || ''

  // 1. Solicitud creada
  if (p.fechaSolicitud <= hasta) {
    eventos.push({
      id: `sol-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.fechaSolicitud,
      hora: horaColombia(p.fechaSolicitud),
      tipo: 'SOLICITUD_CREADA',
      tipoDisplay: 'Solicitud creada',
      icono: '📝',
      titulo: 'Solicitud de préstamo creada',
      descripcion: `Monto: $${p.montoPrincipal.toLocaleString('es-CO')} · ${p.plazoMeses} meses · ${p.frecuencia.toLowerCase()}`,
      monto: p.montoPrincipal,
    })
  }

  // 2. Aprobación
  if (p.fechaAprobacion && p.fechaAprobacion <= hasta) {
    eventos.push({
      id: `apr-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.fechaAprobacion,
      hora: horaColombia(p.fechaAprobacion),
      tipo: 'APROBACION',
      tipoDisplay: 'Solicitud aprobada',
      icono: '✅',
      titulo: 'Solicitud aprobada',
      descripcion: `Tasa: ${p.tasaInteresAnual}% · Cuota: $${p.montoCuota.toLocaleString('es-CO')}`,
    })
  }

  // 3. TyC aceptado
  if (p.tycFechaAceptacion && p.tycFechaAceptacion <= hasta) {
    eventos.push({
      id: `tyc-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.tycFechaAceptacion,
      hora: horaColombia(p.tycFechaAceptacion),
      tipo: 'FIRMA_COMPLETADA',
      tipoDisplay: 'TyC aceptado',
      icono: '📄',
      titulo: 'Términos y condiciones aceptados',
      descripcion: `Método: ${p.metodoConfirmacion || 'N/A'}`,
    })
  }

  // 4. Desembolso
  if (p.fechaDesembolso && p.fechaDesembolso <= hasta) {
    eventos.push({
      id: `des-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.fechaDesembolso,
      hora: horaColombia(p.fechaDesembolso),
      tipo: 'DESEMBOLSO',
      tipoDisplay: 'Desembolso',
      icono: '💰',
      titulo: 'Préstamo desembolsado',
      descripcion: `Capital: $${p.montoPrincipal.toLocaleString('es-CO')} · Vence: ${p.fechaVencimiento ? p.fechaVencimiento.toLocaleDateString('es-CO') : 'N/A'}`,
      monto: p.montoPrincipal,
    })
  }

  // 5. Pagos
  const pagos = await db.pago.findMany({
    where: {
      prestamoId: p.id,
      OR: [
        { fechaPago: { lte: hasta } },
        { fechaAnulacion: { lte: hasta } },
        { fechaReversion: { lte: hasta } },
      ],
    },
    orderBy: { fechaPago: 'asc' },
    select: {
      id: true,
      numeroCuota: true,
      montoTotal: true,
      montoCapital: true,
      montoInteres: true,
      montoMora: true,
      fechaPago: true,
      fechaVencimiento: true,
      metodoPago: true,
      estado: true,
      referencia: true,
      notas: true,
      fechaAnulacion: true,
      fechaReversion: true,
      motivoAnulacion: true,
      motivoReversion: true,
    },
  })

  for (const pago of pagos) {
    if (pago.fechaPago && pago.fechaPago <= hasta && pago.estado === 'APLICADO') {
      const atraso = pago.fechaVencimiento
        ? diasEntre(pago.fechaVencimiento, pago.fechaPago)
        : 0
      eventos.push({
        id: `pago-${pago.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha: pago.fechaPago,
        hora: horaColombia(pago.fechaPago),
        tipo: 'PAGO',
        tipoDisplay: 'Pago aplicado',
        icono: '💵',
        titulo: `Cuota #${pago.numeroCuota} pagada`,
        descripcion: `$${pago.montoTotal.toLocaleString('es-CO')} · ${pago.metodoPago}${atraso > 0 ? ` · ${atraso}d atraso` : ' · puntual'}`,
        monto: pago.montoTotal,
        metadata: {
          metodo: pago.metodoPago,
          referencia: pago.referencia,
          capital: pago.montoCapital,
          interes: pago.montoInteres,
          mora: pago.montoMora,
          atrasoDias: atraso,
        },
      })
    }
    if (pago.estado === 'PAGO_PARCIAL' && pago.fechaPago && pago.fechaPago <= hasta) {
      eventos.push({
        id: `pp-${pago.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha: pago.fechaPago,
        hora: horaColombia(pago.fechaPago),
        tipo: 'PAGO_PARCIAL',
        tipoDisplay: 'Abono parcial',
        icono: '💸',
        titulo: `Abono a cuota #${pago.numeroCuota}`,
        descripcion: `$${pago.montoTotal.toLocaleString('es-CO')} · ${pago.metodoPago}`,
        monto: pago.montoTotal,
      })
    }
    if (pago.estado === 'ANULADO' && pago.fechaAnulacion && pago.fechaAnulacion <= hasta) {
      eventos.push({
        id: `an-${pago.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha: pago.fechaAnulacion,
        hora: horaColombia(pago.fechaAnulacion),
        tipo: 'PAGO_ANULADO',
        tipoDisplay: 'Pago anulado',
        icono: '⚠️',
        titulo: `Cuota #${pago.numeroCuota} anulada`,
        descripcion: `Motivo: ${pago.motivoAnulacion || 'N/A'}`,
        monto: -pago.montoTotal,
      })
    }
    if (pago.estado === 'REVERSADO' && pago.fechaReversion && pago.fechaReversion <= hasta) {
      eventos.push({
        id: `rev-${pago.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha: pago.fechaReversion,
        hora: horaColombia(pago.fechaReversion),
        tipo: 'PAGO_REVERSADO',
        tipoDisplay: 'Pago reversado',
        icono: '↩️',
        titulo: `Cuota #${pago.numeroCuota} reversada`,
        descripcion: `Motivo: ${pago.motivoReversion || 'N/A'}`,
        monto: -pago.montoTotal,
      })
    }
  }

  // 6. Cancelación
  if (p.estado === 'CANCELADO' && p.fechaCancelacion && p.fechaCancelacion <= hasta) {
    eventos.push({
      id: `can-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.fechaCancelacion,
      hora: horaColombia(p.fechaCancelacion),
      tipo: 'CANCELACION',
      tipoDisplay: 'Crédito cancelado',
      icono: '🔵',
      titulo: 'Crédito cancelado totalmente',
      descripcion: `Saldo final: $0 · Total pagado: $${p.montoPagado.toLocaleString('es-CO')}`,
    })
  }

  // 7. Mora renegociada
  if (p.moraRenegociadaFecha && p.moraRenegociadaFecha <= hasta) {
    eventos.push({
      id: `mr-${p.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: p.moraRenegociadaFecha,
      hora: horaColombia(p.moraRenegociadaFecha),
      tipo: 'MORA_RENEGOCIADA',
      tipoDisplay: 'Mora renegociada',
      icono: '🤝',
      titulo: `Mora ${p.moraRenegociadaAccion === 'ANULADA' ? 'anulada' : 'renegociada'}`,
      descripcion: `Valor: $${(p.moraRenegociada || 0).toLocaleString('es-CO')} · Por: ${p.moraRenegociadaPorNombre || 'N/A'}`,
      monto: p.moraRenegociada || 0,
      usuarioNombre: p.moraRenegociadaPorNombre || undefined,
    })
  }

  // 8. Otros síes
  const otrosSi = await db.otroSiCambioFecha.findMany({
    where: { prestamoId: p.id },
    select: { id: true, fechaSolicitud: true, fechaFirma: true, estado: true, descripcion: true, tipoModificacion: true },
  })
  for (const os of otrosSi) {
    const fecha = os.fechaFirma || os.fechaSolicitud
    if (fecha && fecha <= hasta) {
      eventos.push({
        id: `os-${os.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha,
        hora: horaColombia(fecha),
        tipo: 'OTRO_SI',
        tipoDisplay: 'Otro sí firmado',
        icono: '📎',
        titulo: `Otro sí ${os.estado === 'FIRMADO' ? 'firmado' : 'solicitado'}`,
        descripcion: os.descripcion || `Cambio: ${os.tipoModificacion || 'N/A'}`,
      })
    }
  }

  // 9. Refinanciaciones
  const refs = await db.refinanciacion.findMany({
    where: { prestamoId: p.id },
    select: { id: true, fechaSolicitud: true, fechaAprobacion: true, fechaFirma: true, nuevoMontoPrincipal: true, observaciones: true },
  })
  for (const r of refs) {
    const fecha = r.fechaFirma || r.fechaAprobacion || r.fechaSolicitud
    if (fecha && fecha <= hasta) {
      eventos.push({
        id: `ref-${r.id}`,
        prestamoId: p.id,
        prestamoCodigo: p.codigo,
        clienteId: p.clienteId,
        clienteNombre,
        fecha,
        hora: horaColombia(fecha),
        tipo: 'REFINANCIACION',
        tipoDisplay: 'Refinanciación',
        icono: '🔄',
        titulo: 'Refinanciación realizada',
        descripcion: `Nuevo capital: $${(r.nuevoMontoPrincipal || 0).toLocaleString('es-CO')}`,
        monto: r.nuevoMontoPrincipal || 0,
      })
    }
  }

  // 10. Bitácora (notas/gestiones manuales)
  const bitacora = await db.bitacoraPrestamo.findMany({
    where: { prestamoId: p.id, fechaEvento: { lte: hasta } },
    orderBy: { fechaEvento: 'desc' },
    select: { id: true, tipo: true, titulo: true, descripcion: true, resultado: true, fechaEvento: true, usuarioNombre: true },
  })
  for (const b of bitacora) {
    eventos.push({
      id: `bit-${b.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: b.fechaEvento,
      hora: horaColombia(b.fechaEvento),
      tipo: 'BITACORA',
      tipoDisplay: b.tipo || 'Bitácora',
      icono: iconoBitacora(b.tipo),
      titulo: b.titulo,
      descripcion: b.descripcion + (b.resultado ? ` · Resultado: ${b.resultado}` : ''),
      usuarioNombre: b.usuarioNombre || undefined,
    })
  }

  // 11. Renovaciones (este préstamo fue cancelado por una renovación)
  const renov = await db.renovacionPrestamo.findFirst({
    where: { prestamoOriginalId: p.id },
  })
  if (renov && renov.createdAt <= hasta) {
    eventos.push({
      id: `ren-${renov.id}`,
      prestamoId: p.id,
      prestamoCodigo: p.codigo,
      clienteId: p.clienteId,
      clienteNombre,
      fecha: renov.createdAt,
      hora: horaColombia(renov.createdAt),
      tipo: 'RENOVACION',
      tipoDisplay: 'Renovación',
      icono: '🔁',
      titulo: 'Préstamo renovado',
      descripcion: `Nuevo préstamo: ${renov.prestamoNuevoId} · Por: ${renov.usuarioNombre || 'N/A'}`,
      usuarioNombre: renov.usuarioNombre || undefined,
    })
  }

  // Ordenar por fecha descendente
  eventos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  return eventos
}

function iconoBitacora(tipo?: string): string {
  switch (tipo) {
    case 'LLAMADA': return '📞'
    case 'VISITA': return '🚶'
    case 'EMAIL': return '📧'
    case 'WHATSAPP': return '💬'
    case 'REUNION': return '👥'
    case 'PAGO': return '💵'
    case 'JURIDICO': return '⚖️'
    case 'NOTA': return '📝'
    default: return '📌'
  }
}

// =====================================================
// Comparación entre dos fechas
// =====================================================
export interface ComparacionFechas {
  fechaA: Date
  fechaB: Date
  metricasA: CarteraHistorica
  metricasB: CarteraHistorica
  diferencias: {
    creditosActivos: number
    carteraPendiente: number
    creditosExcedidos: number
    creditosCancelados: number
    capitalPrestado: number
    dineroRecuperado: number
  }
  desgloseCambios: {
    nuevosDesembolsos: number
    pagosRecibidos: number
    creditosCancelados: { id: string; codigo: string; cliente: string; saldoCancelado: number }[]
    nuevosCreditos: { id: string; codigo: string; cliente: string; monto: number }[]
    creditsExcedidos: { id: string; codigo: string; cliente: string }[]
  }
}

export async function compararCarteraEntreFechas(
  fechaA: Date,
  fechaB: Date
): Promise<ComparacionFechas> {
  const [metricasA, metricasB] = await Promise.all([
    reconstruirCarteraHastaFecha(fechaA),
    reconstruirCarteraHastaFecha(fechaB),
  ])

  // Identificar cambios específicos
  const mapA = new Map(metricasA.prestamos.map(p => [p.id, p]))
  const mapB = new Map(metricasB.prestamos.map(p => [p.id, p]))

  const nuevosCreditos: any[] = []
  const creditosCancelados: any[] = []
  const creditsExcedidos: any[] = []

  for (const [id, pb] of Array.from(mapB.entries())) {
    const pa = mapA.get(id)
    if (!pa) {
      // Existía en B pero no en A: se creó entre A y B
      // (Solo cuenta si fechaDesembolso está en (A, B])
      if (pb.fechaDesembolso && pb.fechaDesembolso > fechaA && pb.fechaDesembolso <= fechaB) {
        nuevosCreditos.push({
          id: pb.id,
          codigo: pb.codigo,
          cliente: pb.clienteNombre,
          monto: pb.montoPrincipal,
        })
      }
    } else {
      // Existía en ambos
      if (pa.estadoHistorico !== 'CANCELADO' && pb.estadoHistorico === 'CANCELADO') {
        creditosCancelados.push({
          id: pb.id,
          codigo: pb.codigo,
          cliente: pb.clienteNombre,
          saldoCancelado: pa.saldoTotalHistorico,
        })
      }
      if (pa.estadoPlazo !== 'EXCEDIDO' && pb.estadoPlazo === 'EXCEDIDO') {
        creditsExcedidos.push({
          id: pb.id,
          codigo: pb.codigo,
          cliente: pb.clienteNombre,
        })
      }
    }
  }

  // Pagos recibidos en el periodo (A, B]
  const pagosPeriodo = await db.pago.findMany({
    where: {
      estado: 'APLICADO',
      fechaPago: { gt: fechaA, lte: fechaB },
    },
    select: { montoTotal: true },
  })
  const pagosRecibidos = pagosPeriodo.reduce((s, p) => s + p.montoTotal, 0)

  // Nuevos desembolsos en el periodo
  const desembolsosPeriodo = await db.prestamo.findMany({
    where: {
      fechaDesembolso: { gt: fechaA, lte: fechaB },
    },
    select: { montoPrincipal: true },
  })
  const nuevosDesembolsos = desembolsosPeriodo.reduce((s, p) => s + p.montoPrincipal, 0)

  return {
    fechaA,
    fechaB,
    metricasA,
    metricasB,
    diferencias: {
      creditosActivos: metricasB.creditosActivos - metricasA.creditosActivos,
      carteraPendiente: metricasB.carteraPendiente - metricasA.carteraPendiente,
      creditosExcedidos: metricasB.creditosExcedidos - metricasA.creditosExcedidos,
      creditosCancelados: metricasB.creditosCancelados - metricasA.creditosCancelados,
      capitalPrestado: metricasB.capitalPrestado - metricasA.capitalPrestado,
      dineroRecuperado: metricasB.dineroRecuperado - metricasA.dineroRecuperado,
    },
    desgloseCambios: {
      nuevosDesembolsos,
      pagosRecibidos,
      creditosCancelados,
      nuevosCreditos,
      creditsExcedidos,
    },
  }
}

// =====================================================
// Detectar primer cambio relevante en un crédito
// =====================================================
export interface PrimerCambio {
  fecha: Date
  dia: number
  tipo: 'PAGO_REDUCIDO' | 'PAGO_TARDIO' | 'PRIMER_ATRASO' | 'GESTION_COBRANZA' | 'SIN_CAMBIOS'
  titulo: string
  descripcion: string
  evidenciaAdicional: { dia: number; titulo: string; fecha: Date }[]
}

export async function encontrarPrimerCambio(prestamoId: string): Promise<PrimerCambio> {
  const eventos = await obtenerEventosPrestamo(prestamoId)
  // Ordenar ascendente por fecha
  eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

  const pagos = eventos.filter(e => e.tipo === 'PAGO')
  if (pagos.length < 2) {
    return {
      fecha: eventos[0]?.fecha || new Date(),
      dia: 1,
      tipo: 'SIN_CAMBIOS',
      titulo: 'Sin cambios significativos',
      descripcion: 'No hay suficientes pagos registrados para detectar patrones.',
      evidenciaAdicional: [],
    }
  }

  // Calcular promedio histórico
  const montos = pagos.map(p => p.monto || 0)
  const promedio = montos.reduce((s, m) => s + m, 0) / montos.length

  const evidencia: { dia: number; titulo: string; fecha: Date }[] = []
  let primerCambio: PrimerCambio | null = null

  const p = await db.prestamo.findUnique({
    where: { id: prestamoId },
    select: { fechaDesembolso: true, montoCuota: true },
  })
  const fechaInicio = p?.fechaDesembolso

  for (let i = 1; i < pagos.length; i++) {
    const pago = pagos[i]
    const anterior = pagos[i - 1]
    const dia = fechaInicio ? diasEntre(fechaInicio, pago.fecha) : i

    // Pago reducido (< 75% del promedio)
    if ((pago.monto || 0) < promedio * 0.75 && !primerCambio) {
      primerCambio = {
        fecha: pago.fecha,
        dia,
        tipo: 'PAGO_REDUCIDO',
        titulo: `Día ${dia}: pago inferior al patrón`,
        descripcion: `Pago de $${(pago.monto || 0).toLocaleString('es-CO')} vs promedio $${Math.round(promedio).toLocaleString('es-CO')} (${Math.round(((pago.monto || 0) / promedio) * 100)}% del promedio)`,
        evidenciaAdicional: evidencia,
      }
    }

    // Pago tardío (>= 3 días más tarde que el anterior)
    if (anterior.fecha && pago.fecha) {
      const diffEsperado = 30 // días aproximados entre cuotas
      const diffReal = diasEntre(anterior.fecha, pago.fecha)
      if (diffReal > diffEsperado + 3 && !primerCambio) {
        primerCambio = {
          fecha: pago.fecha,
          dia,
          tipo: 'PAGO_TARDIO',
          titulo: `Día ${dia}: pago tardío`,
          descripcion: `Pagó ${diffReal - diffEsperado} días después del patrón esperado`,
          evidenciaAdicional: evidencia,
        }
      }
    }

    if (primerCambio) {
      evidencia.push({ dia, titulo: pago.titulo, fecha: pago.fecha })
    }
  }

  // Buscar primer atraso/gestión
  const gestiones = eventos.filter(e => e.tipo === 'BITACORA')
  for (const g of gestiones) {
    const dia = fechaInicio ? diasEntre(fechaInicio, g.fecha) : 0
    if (primerCambio && g.fecha > primerCambio.fecha) {
      evidencia.push({ dia, titulo: g.titulo, fecha: g.fecha })
    }
  }

  return primerCambio || {
    fecha: new Date(),
    dia: 0,
    tipo: 'SIN_CAMBIOS',
    titulo: 'Sin desviaciones detectadas',
    descripcion: 'El comportamiento de pagos ha sido consistente.',
    evidenciaAdicional: [],
  }
}

export { db }
