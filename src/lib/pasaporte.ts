// =====================================================
// 🏆 PASAPORTE DE CONFIANZA — Lógica de negocio
// =====================================================
// Convierte el comportamiento de pago del cliente en una
// trayectoria visible, dinámica y motivadora.
//
// Concepto: "CADA PAGO CONSTRUYE TU SIGUIENTE OPORTUNIDAD."
//
// NO es un score crediticio. Es la trayectoria del cliente
// dentro de la entidad, calculada con datos REALES.
// =====================================================

import { db } from '@/lib/db'
import { formatCOP } from '@/lib/format'

// =====================================================
// TIPOS
// =====================================================

export type NivelTrayectoria =
  | 'EN_CONSTRUCCION'
  | 'CONFIABLE'
  | 'DESTACADO'
  | 'PREFERENTE'

export interface IndicadoresTrayectoria {
  pagosPuntuales: number
  pagosAnticipados: number
  pagosPosteriores: number
  pagosTotales: number
  creditosCompletados: number
  creditosActivos: number
  creditosTotales: number
  cumplimientoHistorico: number  // % de pagos puntuales+anticipados sobre el total
  antiguedadMeses: number
  antiguedadLegible: string
}

export interface CompromisoResumen {
  registrados: number
  cumplidos: number
  pendientes: number
  incumplidos: number
  cumplimiento: number  // % cumplidos/(cumplidos+incumplidos)
}

export interface NovedadPago {
  tipo: 'PAGO_EXCEDIDO' | 'PAGO_PROXIMO' | 'PAGO_NO_REGISTRADO' | 'COMPROMISO_VENCIDO' | 'COMPROMISO_PROXIMO' | 'PAGO_PARCIAL'
  severidad: 'INFO' | 'WARNING' | 'CRITICAL'
  prestamoId: string
  prestamoCodigo: string
  pagoId?: string
  numeroCuota?: number
  fechaPactada: Date
  fechaActual: Date
  diasTranscurridos: number
  montoEsperado?: number
  montoPagado?: number
  descripcion: string
  compromisoId?: string
}

export interface EstadoCreditoActual {
  prestamoId: string
  codigo: string
  montoPrincipal: number
  montoPagado: number
  saldoPendiente: number
  totalPagar: number
  progresoPorcentaje: number
  cuotasPagadas: number
  numeroCuotas: number
  cuotasRestantes: number
  fechaDesembolso: Date
  fechaVencimiento: Date
  proximoPago?: {
    pagoId: string
    numeroCuota: number
    fechaVencimiento: Date
    monto: number
    diasParaVencer: number
  }
  diasTranscurridos: number
  diasRestantes: number
  estadoVigencia: string  // DENTRO_PLAZO | PROXIMO_VENCER | EXCEDIDO | VIGENTE
  estadoPrestamo: string  // ACTIVO | EN_MORA | etc
}

export interface CreditoHistorico {
  prestamoId: string
  codigo: string
  montoPrincipal: number
  montoPagado: number
  totalPagar: number
  estado: string
  fechaDesembolso: Date
  fechaVencimiento?: Date
  fechaCancelacion?: Date
  anio: number
  numeroCuotas: number
  cuotasPagadas: number
  progresoPorcentaje: number
  pagosPuntuales: number
  pagosAnticipados: number
  pagosPosteriores: number
  completado: boolean
  tipoEvento?: 'COMPLETADO' | 'ACTIVO' | 'CANCELADO' | 'RENOVADO'
}

export interface ResultadoPasaporte {
  cliente: {
    id: string
    nombre: string
    cedula: string
  }
  indicadores: IndicadoresTrayectoria
  nivel: {
    actual: NivelTrayectoria
    etiqueta: string
    color: string
    emoji: string
    descripcion: string
    mensaje: string
  }
  creditoActual: EstadoCreditoActual | null
  proximaMeta: {
    descripcion: string
    cuotasRestantes: number
    progresoActual: number
    progresoObjetivo: number
    hitoAlcanzado: number | null
    mensajeHito: string | null
  } | null
  loQueEstasConstruyendo: {
    elegibleRenovacion: boolean
    razonesElegibilidad: string[]
    razonesBloqueo: string[]
    mensaje: string
    opcionesDisponibles: ('MISMO_VALOR' | 'VALOR_DIFERENTE' | 'NUEVA_SOLICITUD')[]
  }
  trayectoria: {
    totalCreditos: number
    completados: number
    activos: number
    totalPagos: number
    creditos: CreditoHistorico[]
  }
  compromisos: CompromisoResumen
  novedades: NovedadPago[]
  notificaciones: NotificacionPasaporte[]
  generadoEn: Date
}

export interface NotificacionPasaporte {
  tipo: 'PAGO_PROXIMO' | 'PAGO_HOY' | 'PAGO_EXCEDIDO' | 'COMPROMISO_REGISTRADO' | 'COMPROMISO_PROXIMO' | 'COMPROMISO_CUMPLIDO' | 'COMPROMISO_INCUMPLIDO' | 'NOVEDAD_INFO'
  emoji: string
  color: string
  titulo: string
  mensaje: string
  fechaReferencia?: Date
  prestamoId?: string
}

// =====================================================
// CONFIGURACIÓN POR DEFECTO
// =====================================================

const CONFIG_DEFAULT = {
  nivelEnConstruccionMax: 60.0,
  nivelConfiableMax: 75.0,
  nivelDestacadoMax: 90.0,
  renovacionCumplimientoMinimo: 75.0,
  renovacionCreditosMinimos: 1,
  renovacionCompromisoCumplimiento: 70.0,
  renovacionProximidadFinalMeses: 2,
  novedadDiasAntesVencimiento: 3,
  novedadDiasDespuesExcedido: 1,
}

// =====================================================
// HELPERS DE FECHA (zona horaria America/Bogota)
// =====================================================

function hoyEnColombia(): Date {
  // Devuelve la fecha actual interpretada en zona horaria America/Bogota
  const ahora = new Date()
  return ahora
}

function diasEntre(fecha1: Date, fecha2: Date): number {
  const ms = fecha2.getTime() - fecha1.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function diferenciaMeses(fechaInicio: Date, fechaFin: Date): number {
  const anios = fechaFin.getFullYear() - fechaInicio.getFullYear()
  const meses = fechaFin.getMonth() - fechaInicio.getMonth()
  return anios * 12 + meses
}

function legibleAntiguedad(meses: number): string {
  if (meses < 1) return 'Menos de 1 mes'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  const mesesRestantes = meses % 12
  if (mesesRestantes === 0) return `${anios} ${anios === 1 ? 'año' : 'años'}`
  return `${anios} ${anios === 1 ? 'año' : 'años'} y ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`
}

// =====================================================
// OBTENER CONFIGURACIÓN
// =====================================================

export async function obtenerConfigPasaporte() {
  const config = await db.pasaporteConfig.findFirst({
    where: { clave: 'PASAPORTE_CONFIG_GLOBAL', activo: true },
  })
  if (!config) {
    // Crear configuración por defecto si no existe
    return await db.pasaporteConfig.create({
      data: {
        clave: 'PASAPORTE_CONFIG_GLOBAL',
        ...CONFIG_DEFAULT,
        mensajeEnConstruccion: 'Vas construyendo tu trayectoria. Cada pago te acerca a tu próxima oportunidad.',
        mensajeConfiable: 'Tu trayectoria es confiable. Sigue así y subirás de nivel.',
        mensajeDestacado: 'Tu trayectoria es destacada. Estás construyendo grandes oportunidades.',
        mensajePreferente: 'Tu trayectoria es preferente. Eres un cliente ejemplar.',
      },
    })
  }
  return config
}

// =====================================================
// CALCULAR INDICADORES DE TRAYECTORIA
// =====================================================

export async function calcularIndicadores(clienteId: string): Promise<IndicadoresTrayectoria> {
  // Obtener todos los préstamos del cliente con sus pagos aplicados
  const prestamos = await db.prestamo.findMany({
    where: { clienteId },
    include: {
      pagos: {
        where: { estado: { in: ['APLICADO', 'REVERSADO'] } },
        orderBy: { numeroCuota: 'asc' },
      },
    },
    orderBy: { fechaSolicitud: 'asc' },
  })

  let pagosPuntuales = 0
  let pagosAnticipados = 0
  let pagosPosteriores = 0
  let pagosTotales = 0
  let creditosCompletados = 0
  let creditosActivos = 0

  for (const p of prestamos) {
    if (p.estado === 'CANCELADO' && p.saldoTotal <= 0) {
      creditosCompletados++
    } else if (p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION') {
      creditosActivos++
    }

    for (const pago of p.pagos) {
      // Solo contar pagos reales (no movimientos de flexibilidad financiera)
      if (pago.esFlexibilidadFinanciera) continue
      if (!pago.fechaPago || !pago.fechaVencimiento) continue

      pagosTotales++
      const diff = diasEntre(pago.fechaVencimiento, pago.fechaPago)
      if (diff <= 0) {
        // Pago puntual o anticipado
        if (diff < 0) {
          pagosAnticipados++
        } else {
          pagosPuntuales++
        }
      } else {
        pagosPosteriores++
      }
    }
  }

  // Antigüedad: desde el primer préstamo hasta hoy
  const primerPrestamo = prestamos[0]
  const antiguedadMeses = primerPrestamo
    ? Math.max(0, diferenciaMeses(primerPrestamo.fechaSolicitud, hoyEnColombia()))
    : 0

  const cumplimientoHistorico = pagosTotales > 0
    ? Math.round(((pagosPuntuales + pagosAnticipados) / pagosTotales) * 100)
    : 0

  return {
    pagosPuntuales,
    pagosAnticipados,
    pagosPosteriores,
    pagosTotales,
    creditosCompletados,
    creditosActivos,
    creditosTotales: prestamos.length,
    cumplimientoHistorico,
    antiguedadMeses,
    antiguedadLegible: legibleAntiguedad(antiguedadMeses),
  }
}

// =====================================================
// CALCULAR NIVEL DE TRAYECTORIA
// =====================================================

export function calcularNivel(
  cumplimiento: number,
  config: { nivelEnConstruccionMax: number; nivelConfiableMax: number; nivelDestacadoMax: number }
): {
  actual: NivelTrayectoria
  etiqueta: string
  color: string
  emoji: string
  descripcion: string
  mensaje: string
} {
  if (cumplimiento >= config.nivelDestacadoMax) {
    return {
      actual: 'PREFERENTE',
      etiqueta: 'Preferente',
      color: '#7c3aed',
      emoji: '🟣',
      descripcion: 'Trayectoria preferente',
      mensaje: 'Tu trayectoria es preferente. Eres un cliente ejemplar.',
    }
  } else if (cumplimiento >= config.nivelConfiableMax) {
    return {
      actual: 'DESTACADO',
      etiqueta: 'Destacado',
      color: '#2563eb',
      emoji: '🔵',
      descripcion: 'Trayectoria destacada',
      mensaje: 'Tu trayectoria es destacada. Estás construyendo grandes oportunidades.',
    }
  } else if (cumplimiento >= config.nivelEnConstruccionMax) {
    return {
      actual: 'CONFIABLE',
      etiqueta: 'Confiable',
      color: '#16a34a',
      emoji: '🟢',
      descripcion: 'Trayectoria confiable',
      mensaje: 'Tu trayectoria es confiable. Sigue así y subirás de nivel.',
    }
  } else {
    return {
      actual: 'EN_CONSTRUCCION',
      etiqueta: 'En construcción',
      color: '#ca8a04',
      emoji: '🟡',
      descripcion: 'Construyendo trayectoria',
      mensaje: 'Vas construyendo tu trayectoria. Cada pago te acerca a tu próxima oportunidad.',
    }
  }
}

// =====================================================
// OBTENER CRÉDITO ACTUAL
// =====================================================

export async function obtenerCreditoActual(clienteId: string): Promise<EstadoCreditoActual | null> {
  const prestamo = await db.prestamo.findFirst({
    where: {
      clienteId,
      estado: { in: ['ACTIVO', 'EN_MORA', 'PENDIENTE_ACEPTACION'] },
    },
    include: {
      pagos: {
        where: { estado: { in: ['PENDIENTE', 'VENCIDO', 'PAGO_PARCIAL'] } },
        orderBy: { fechaVencimiento: 'asc' },
        take: 1,
      },
    },
    orderBy: { fechaDesembolso: 'desc' },
  })

  if (!prestamo) return null

  const hoy = hoyEnColombia()
  const progreso = prestamo.numeroCuotas > 0
    ? Math.min(100, (prestamo.cuotasPagadas / prestamo.numeroCuotas) * 100)
    : 0

  const fechaRef = prestamo.fechaDesembolso || prestamo.fechaSolicitud
  const diasTranscurridos = Math.max(0, diasEntre(fechaRef, hoy))
  const diasRestantes = prestamo.fechaVencimiento
    ? Math.max(0, diasEntre(hoy, prestamo.fechaVencimiento))
    : 0

  // Determinar estado de vigencia
  let estadoVigencia = 'VIGENTE'
  if (prestamo.estado === 'EN_MORA') {
    estadoVigencia = 'EXCEDIDO'
  } else if (prestamo.fechaVencimiento) {
    const diasParaVencer = diasEntre(hoy, prestamo.fechaVencimiento)
    if (diasParaVencer < 0) {
      estadoVigencia = 'EXCEDIDO'
    } else if (diasParaVencer <= 15) {
      estadoVigencia = 'PROXIMO_VENCER'
    } else {
      estadoVigencia = 'DENTRO_PLAZO'
    }
  }

  // Próximo pago
  const proximoPago = prestamo.pagos[0]
  const proximoPagoInfo = proximoPago
    ? {
        pagoId: proximoPago.id,
        numeroCuota: proximoPago.numeroCuota,
        fechaVencimiento: proximoPago.fechaVencimiento,
        monto: proximoPago.montoTotal,
        diasParaVencer: diasEntre(hoy, proximoPago.fechaVencimiento),
      }
    : undefined

  return {
    prestamoId: prestamo.id,
    codigo: prestamo.codigo,
    montoPrincipal: prestamo.montoPrincipal,
    montoPagado: prestamo.montoPagado,
    saldoPendiente: prestamo.saldoTotal,
    totalPagar: prestamo.totalPagar,
    progresoPorcentaje: progreso,
    cuotasPagadas: prestamo.cuotasPagadas,
    numeroCuotas: prestamo.numeroCuotas,
    cuotasRestantes: Math.max(0, prestamo.numeroCuotas - prestamo.cuotasPagadas),
    fechaDesembolso: prestamo.fechaDesembolso || prestamo.fechaSolicitud,
    fechaVencimiento: prestamo.fechaVencimiento || prestamo.fechaDesembolso || prestamo.fechaSolicitud,
    proximoPago: proximoPagoInfo,
    diasTranscurridos,
    diasRestantes,
    estadoVigencia,
    estadoPrestamo: prestamo.estado,
  }
}

// =====================================================
// CALCULAR PRÓXIMA META
// =====================================================

export function calcularProximaMeta(creditoActual: EstadoCreditoActual | null): ResultadoPasaporte['proximaMeta'] {
  if (!creditoActual) return null

  const hitos = [25, 50, 75, 90, 100]
  const progreso = Math.round(creditoActual.progresoPorcentaje)

  // Determinar hito alcanzado
  let hitoAlcanzado: number | null = null
  for (const hito of hitos) {
    if (progreso >= hito) {
      hitoAlcanzado = hito
    }
  }

  let mensajeHito: string | null = null
  if (hitoAlcanzado === 100) {
    mensajeHito = '🏆 ¡MISIÓN COMPLETADA! Has completado tu crédito.'
  } else if (hitoAlcanzado === 90) {
    mensajeHito = '🎉 ¡Has alcanzado el 90% de tu crédito! Ya casi lo logras.'
  } else if (hitoAlcanzado === 75) {
    mensajeHito = '🎉 ¡Has alcanzado el 75% de tu crédito!'
  } else if (hitoAlcanzado === 50) {
    mensajeHito = '🎉 ¡Has alcanzado la mitad de tu crédito!'
  } else if (hitoAlcanzado === 25) {
    mensajeHito = '🎉 ¡Has alcanzado el 25% de tu crédito!'
  }

  return {
    descripcion: 'Completar tu crédito actual',
    cuotasRestantes: creditoActual.cuotasRestantes,
    progresoActual: progreso,
    progresoObjetivo: 100,
    hitoAlcanzado,
    mensajeHito,
  }
}

// =====================================================
// CALCULAR "LO QUE ESTÁS CONSTRUYENDO" (ELEGIBILIDAD RENOVACIÓN)
// =====================================================

export async function calcularElegibilidadRenovacion(
  clienteId: string,
  indicadores: IndicadoresTrayectoria,
  creditoActual: EstadoCreditoActual | null,
  compromisos: CompromisoResumen,
  config: any
): Promise<ResultadoPasaporte['loQueEstasConstruyendo']> {
  const razonesElegibilidad: string[] = []
  const razonesBloqueo: string[] = []

  // 1. Cumplimiento histórico mínimo
  if (indicadores.cumplimientoHistorico >= config.renovacionCumplimientoMinimo) {
    razonesElegibilidad.push(
      `Cumplimiento histórico del ${indicadores.cumplimientoHistorico}% (≥ ${config.renovacionCumplimientoMinimo}%)`
    )
  } else {
    razonesBloqueo.push(
      `Tu cumplimiento histórico es ${indicadores.cumplimientoHistorico}% (requiere ≥ ${config.renovacionCumplimientoMinimo}%)`
    )
  }

  // 2. Créditos completados mínimos
  if (indicadores.creditosCompletados >= config.renovacionCreditosMinimos) {
    razonesElegibilidad.push(
      `${indicadores.creditosCompletados} crédito(s) completado(s) (≥ ${config.renovacionCreditosMinimos})`
    )
  } else {
    razonesBloqueo.push(
      `Necesitas completar al menos ${config.renovacionCreditosMinimos} crédito(s). Actualmente: ${indicadores.creditosCompletados}`
    )
  }

  // 3. Cumplimiento de compromisos
  if (compromisos.registrados === 0 || compromisos.cumplimiento >= config.renovacionCompromisoCumplimiento) {
    razonesElegibilidad.push(
      compromisos.registrados === 0
        ? 'Sin compromisos registrados previos (historial limpio)'
        : `Cumplimiento de compromisos del ${compromisos.cumplimiento}% (≥ ${config.renovacionCompromisoCumplimiento}%)`
    )
  } else {
    razonesBloqueo.push(
      `Tu cumplimiento de compromisos es ${compromisos.cumplimiento}% (requiere ≥ ${config.renovacionCompromisoCumplimiento}%)`
    )
  }

  // 4. Crédito actual próximo a finalizar (si existe)
  if (creditoActual) {
    const mesesRestantes = Math.ceil(creditoActual.diasRestantes / 30)
    if (creditoActual.progresoPorcentaje >= 75 || mesesRestantes <= config.renovacionProximidadFinalMeses) {
      razonesElegibilidad.push(
        `Tu crédito actual está al ${Math.round(creditoActual.progresoPorcentaje)}% (${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'} restantes)`
      )
    } else {
      razonesBloqueo.push(
        `Tu crédito actual está al ${Math.round(creditoActual.progresoPorcentaje)}% — debe estar al 75% o más cerca del final`
      )
    }
  }

  // 5. Sin pagos excedidos activos (sin mora actual)
  if (creditoActual && creditoActual.estadoVigencia === 'EXCEDIDO') {
    razonesBloqueo.push('Tienes un pago excedido en tu crédito actual. Regulariza tu situación primero.')
  } else {
    razonesElegibilidad.push('Sin pagos excedidos en tu crédito actual')
  }

  const elegible = razonesBloqueo.length === 0

  let mensaje: string
  if (elegible) {
    mensaje = '🟢 Tu trayectoria te permite explorar una nueva solicitud al completar este crédito.'
  } else {
    mensaje = '🔒 Esta opción aún no está disponible. Continúa construyendo tu trayectoria mediante el cumplimiento de tus compromisos.'
  }

  return {
    elegibleRenovacion: elegible,
    razonesElegibilidad,
    razonesBloqueo,
    mensaje,
    opcionesDisponibles: elegible ? ['MISMO_VALOR', 'VALOR_DIFERENTE', 'NUEVA_SOLICITUD'] : [],
  }
}

// =====================================================
// OBTENER TRAYECTORIA HISTÓRICA
// =====================================================

export async function obtenerTrayectoria(clienteId: string): Promise<ResultadoPasaporte['trayectoria']> {
  const prestamos = await db.prestamo.findMany({
    where: { clienteId },
    include: {
      pagos: {
        where: { estado: { in: ['APLICADO', 'REVERSADO'] } },
        orderBy: { numeroCuota: 'asc' },
      },
    },
    orderBy: { fechaSolicitud: 'asc' },
  })

  const creditos: CreditoHistorico[] = prestamos.map((p) => {
    let pagosPuntuales = 0
    let pagosAnticipados = 0
    let pagosPosteriores = 0

    for (const pago of p.pagos) {
      if (pago.esFlexibilidadFinanciera) continue
      if (!pago.fechaPago || !pago.fechaVencimiento) continue
      const diff = diasEntre(pago.fechaVencimiento, pago.fechaPago)
      if (diff < 0) pagosAnticipados++
      else if (diff === 0) pagosPuntuales++
      else pagosPosteriores++
    }

    const completado = p.estado === 'CANCELADO' && p.saldoTotal <= 0
    const progreso = p.numeroCuotas > 0
      ? Math.min(100, (p.cuotasPagadas / p.numeroCuotas) * 100)
      : 0

    let tipoEvento: CreditoHistorico['tipoEvento'] = 'ACTIVO'
    if (completado) tipoEvento = 'COMPLETADO'
    else if (p.estado === 'CANCELADO') tipoEvento = 'CANCELADO'

    return {
      prestamoId: p.id,
      codigo: p.codigo,
      montoPrincipal: p.montoPrincipal,
      montoPagado: p.montoPagado,
      totalPagar: p.totalPagar,
      estado: p.estado,
      fechaDesembolso: p.fechaDesembolso || p.fechaSolicitud,
      fechaVencimiento: p.fechaVencimiento || undefined,
      fechaCancelacion: p.fechaCancelacion || undefined,
      anio: (p.fechaDesembolso || p.fechaSolicitud).getFullYear(),
      numeroCuotas: p.numeroCuotas,
      cuotasPagadas: p.cuotasPagadas,
      progresoPorcentaje: progreso,
      pagosPuntuales,
      pagosAnticipados,
      pagosPosteriores,
      completado,
      tipoEvento,
    }
  })

  return {
    totalCreditos: prestamos.length,
    completados: creditos.filter((c) => c.completado).length,
    activos: creditos.filter((c) => !c.completado && c.estado !== 'CANCELADO').length,
    totalPagos: creditos.reduce((s, c) => s + c.pagosPuntuales + c.pagosAnticipados + c.pagosPosteriores, 0),
    creditos,
  }
}

// =====================================================
// OBTENER RESUMEN DE COMPROMISOS
// =====================================================

export async function obtenerResumenCompromisos(clienteId: string): Promise<CompromisoResumen> {
  const compromisos = await db.compromisoPago.findMany({
    where: { clienteId },
    select: { estado: true },
  })

  const registrados = compromisos.length
  const cumplidos = compromisos.filter((c) => c.estado === 'CUMPLIDO').length
  const pendientes = compromisos.filter((c) => c.estado === 'REGISTRADO' || c.estado === 'PROXIMO').length
  const incumplidos = compromisos.filter((c) => c.estado === 'INCUMPLIDO').length

  const total = cumplidos + incumplidos
  const cumplimiento = total > 0 ? Math.round((cumplidos / total) * 100) : 100

  return { registrados, cumplidos, pendientes, incumplidos, cumplimiento }
}

// =====================================================
// DETECTAR NOVEDADES DE PAGO
// =====================================================

export async function detectarNovedades(clienteId: string, config: any): Promise<NovedadPago[]> {
  const novedades: NovedadPago[] = []
  const hoy = hoyEnColombia()

  // Obtener préstamos activos del cliente
  const prestamos = await db.prestamo.findMany({
    where: {
      clienteId,
      estado: { in: ['ACTIVO', 'EN_MORA'] },
    },
    include: {
      pagos: {
        where: {
          estado: { in: ['PENDIENTE', 'VENCIDO', 'PAGO_PARCIAL'] },
        },
        orderBy: { fechaVencimiento: 'asc' },
      },
    },
  })

  for (const p of prestamos) {
    for (const pago of p.pagos) {
      const diasParaVencer = diasEntre(hoy, pago.fechaVencimiento)

      // Pago excedido (fecha pactada ya pasó y no se ha pagado)
      if (diasParaVencer < 0) {
        novedades.push({
          tipo: 'PAGO_EXCEDIDO',
          severidad: diasParaVencer <= -7 ? 'CRITICAL' : 'WARNING',
          prestamoId: p.id,
          prestamoCodigo: p.codigo,
          pagoId: pago.id,
          numeroCuota: pago.numeroCuota,
          fechaPactada: pago.fechaVencimiento,
          fechaActual: hoy,
          diasTranscurridos: Math.abs(diasParaVencer),
          montoEsperado: pago.montoTotal,
          montoPagado: pago.estado === 'PAGO_PARCIAL' ? pago.montoTotal * 0.5 : 0,
          descripcion: `La fecha pactada era el ${formatFechaCorta(pago.fechaVencimiento)} y han transcurrido ${Math.abs(diasParaVencer)} días.`,
        })
      } else if (diasParaVencer <= config.novedadDiasAntesVencimiento) {
        // Pago próximo a vencer
        novedades.push({
          tipo: 'PAGO_PROXIMO',
          severidad: 'INFO',
          prestamoId: p.id,
          prestamoCodigo: p.codigo,
          pagoId: pago.id,
          numeroCuota: pago.numeroCuota,
          fechaPactada: pago.fechaVencimiento,
          fechaActual: hoy,
          diasTranscurridos: diasParaVencer,
          montoEsperado: pago.montoTotal,
          descripcion: `Tu pago vence en ${diasParaVencer} ${diasParaVencer === 1 ? 'día' : 'días'}.`,
        })
      } else if (pago.estado === 'PAGO_PARCIAL') {
        // Pago parcial
        novedades.push({
          tipo: 'PAGO_PARCIAL',
          severidad: 'WARNING',
          prestamoId: p.id,
          prestamoCodigo: p.codigo,
          pagoId: pago.id,
          numeroCuota: pago.numeroCuota,
          fechaPactada: pago.fechaVencimiento,
          fechaActual: hoy,
          diasTranscurridos: diasParaVencer,
          montoEsperado: pago.montoTotal,
          descripcion: `Tienes un pago parcial registrado para la cuota ${pago.numeroCuota}.`,
        })
      }
    }
  }

  // Verificar compromisos próximos a vencer y vencidos
  const compromisos = await db.compromisoPago.findMany({
    where: {
      clienteId,
      estado: { in: ['REGISTRADO', 'PROXIMO'] },
    },
    include: { prestamo: true },
  })

  for (const c of compromisos) {
    const diasParaCompromiso = diasEntre(hoy, c.fechaComprometida)
    if (diasParaCompromiso < 0) {
      // Compromiso vencido
      novedades.push({
        tipo: 'COMPROMISO_VENCIDO',
        severidad: 'CRITICAL',
        prestamoId: c.prestamoId,
        prestamoCodigo: c.prestamo.codigo,
        compromisoId: c.id,
        fechaPactada: c.fechaComprometida,
        fechaActual: hoy,
        diasTranscurridos: Math.abs(diasParaCompromiso),
        montoEsperado: c.valorComprometido,
        descripcion: `Tu compromiso de pago del ${formatFechaCorta(c.fechaComprometida)} no se ha cumplido.`,
      })
    } else if (diasParaCompromiso <= 1) {
      novedades.push({
        tipo: 'COMPROMISO_PROXIMO',
        severidad: 'WARNING',
        prestamoId: c.prestamoId,
        prestamoCodigo: c.prestamo.codigo,
        compromisoId: c.id,
        fechaPactada: c.fechaComprometida,
        fechaActual: hoy,
        diasTranscurridos: diasParaCompromiso,
        montoEsperado: c.valorComprometido,
        descripcion: `Tu compromiso de pago vence ${diasParaCompromiso === 0 ? 'hoy' : 'mañana'}.`,
      })
    }
  }

  return novedades
}

// =====================================================
// GENERAR NOTIFICACIONES INTELIGENTES
// =====================================================

export function generarNotificaciones(
  novedades: NovedadPago[],
  creditoActual: EstadoCreditoActual | null,
  compromisos: CompromisoResumen
): NotificacionPasaporte[] {
  const notifs: NotificacionPasaporte[] = []

  for (const nov of novedades) {
    if (nov.tipo === 'PAGO_PROXIMO' && nov.diasTranscurridos > 0) {
      notifs.push({
        tipo: 'PAGO_PROXIMO',
        emoji: '🟢',
        color: '#16a34a',
        titulo: 'Tu próximo pago vence pronto',
        mensaje: `Tu pago vence en ${nov.diasTranscurridos} ${nov.diasTranscurridos === 1 ? 'día' : 'días'}.`,
        fechaReferencia: nov.fechaPactada,
        prestamoId: nov.prestamoId,
      })
    } else if (nov.tipo === 'PAGO_PROXIMO' && nov.diasTranscurridos === 0) {
      notifs.push({
        tipo: 'PAGO_HOY',
        emoji: '📅',
        color: '#2563eb',
        titulo: 'Hoy es la fecha pactada para tu pago',
        mensaje: `Recuerda realizar tu pago hoy.`,
        fechaReferencia: nov.fechaPactada,
        prestamoId: nov.prestamoId,
      })
    } else if (nov.tipo === 'PAGO_EXCEDIDO') {
      notifs.push({
        tipo: 'PAGO_EXCEDIDO',
        emoji: '🔴',
        color: '#dc2626',
        titulo: 'Tenemos una novedad con tu pago',
        mensaje: `La fecha pactada era el ${formatFechaCorta(nov.fechaPactada)}. Han transcurrido ${nov.diasTranscurridos} días.`,
        fechaReferencia: nov.fechaPactada,
        prestamoId: nov.prestamoId,
      })
    } else if (nov.tipo === 'COMPROMISO_VENCIDO') {
      notifs.push({
        tipo: 'COMPROMISO_INCUMPLIDO',
        emoji: '🔴',
        color: '#dc2626',
        titulo: 'Tu compromiso requiere atención',
        mensaje: `No hemos registrado el pago asociado a tu compromiso del ${formatFechaCorta(nov.fechaPactada)}.`,
        fechaReferencia: nov.fechaPactada,
        prestamoId: nov.prestamoId,
      })
    } else if (nov.tipo === 'COMPROMISO_PROXIMO') {
      notifs.push({
        tipo: 'COMPROMISO_PROXIMO',
        emoji: '⏰',
        color: '#f59e0b',
        titulo: 'Tu compromiso de pago vence pronto',
        mensaje: `Tu compromiso vence ${nov.diasTranscurridos === 0 ? 'hoy' : 'mañana'}.`,
        fechaReferencia: nov.fechaPactada,
        prestamoId: nov.prestamoId,
      })
    }
  }

  return notifs
}

// =====================================================
// HELPERS DE FECHA
// =====================================================

export function formatFechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// =====================================================
// FUNCIÓN PRINCIPAL: GENERAR PASAPORTE COMPLETO
// =====================================================

export async function generarPasaporte(clienteId: string): Promise<ResultadoPasaporte> {
  // 1. Obtener cliente
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, cedula: true },
  })

  if (!cliente) {
    throw new Error('Cliente no encontrado')
  }

  // 2. Cargar configuración
  const config = await obtenerConfigPasaporte()

  // 3. Calcular indicadores (en paralelo)
  const [indicadores, creditoActual, trayectoria, compromisos] = await Promise.all([
    calcularIndicadores(clienteId),
    obtenerCreditoActual(clienteId),
    obtenerTrayectoria(clienteId),
    obtenerResumenCompromisos(clienteId),
  ])

  // 4. Calcular nivel
  const nivel = calcularNivel(indicadores.cumplimientoHistorico, config)

  // 5. Calcular próxima meta
  const proximaMeta = calcularProximaMeta(creditoActual)

  // 6. Calcular elegibilidad de renovación
  const loQueEstasConstruyendo = await calcularElegibilidadRenovacion(
    clienteId,
    indicadores,
    creditoActual,
    compromisos,
    config
  )

  // 7. Detectar novedades
  const novedades = await detectarNovedades(clienteId, config)

  // 8. Generar notificaciones
  const notificaciones = generarNotificaciones(novedades, creditoActual, compromisos)

  return {
    cliente,
    indicadores,
    nivel: {
      actual: nivel.actual,
      etiqueta: nivel.etiqueta,
      color: nivel.color,
      emoji: nivel.emoji,
      descripcion: nivel.descripcion,
      mensaje: nivel.mensaje,
    },
    creditoActual,
    proximaMeta,
    loQueEstasConstruyendo,
    trayectoria,
    compromisos,
    novedades,
    notificaciones,
    generadoEn: new Date(),
  }
}

// =====================================================
// AUDITORÍA
// =====================================================

export async function auditarAccion(params: {
  clienteId: string
  prestamoId?: string
  compromisoId?: string
  tipoAccion: string
  descripcion: string
  valor?: number
  fechaComprometida?: Date
  estado?: string
  ipOrigen?: string
  userAgent?: string
}): Promise<void> {
  try {
    await db.pasaporteAuditoria.create({
      data: {
        clienteId: params.clienteId,
        prestamoId: params.prestamoId || null,
        compromisoId: params.compromisoId || null,
        tipoAccion: params.tipoAccion,
        descripcion: params.descripcion,
        valor: params.valor || null,
        fechaComprometida: params.fechaComprometida || null,
        estado: params.estado || null,
        ipOrigen: params.ipOrigen || null,
        userAgent: params.userAgent || null,
      },
    })
  } catch (e) {
    // No bloquear la operación principal si la auditoría falla
    console.error('[PASAPORTE] Error en auditoría:', e)
  }
}

// =====================================================
// VERIFICAR COMPROMISOS CUMPLIDOS/INCUMPLIDOS
// =====================================================

export async function verificarCompromisos(clienteId: string): Promise<void> {
  const hoy = hoyEnColombia()

  // Obtener compromisos activos
  const compromisos = await db.compromisoPago.findMany({
    where: {
      clienteId,
      estado: { in: ['REGISTRADO', 'PROXIMO'] },
    },
    include: {
      prestamo: {
        include: {
          pagos: {
            where: { estado: { in: ['APLICADO', 'REVERSADO'] } },
            orderBy: { fechaPago: 'desc' },
          },
        },
      },
    },
  })

  for (const c of compromisos) {
    // Buscar si hay un pago posterior o igual a la fecha comprometida
    // dentro de los 3 días siguientes a la fecha comprometida
    const fechaLimite = new Date(c.fechaComprometida)
    fechaLimite.setDate(fechaLimite.getDate() + 3)

    const pagoCumplido = c.prestamo.pagos.find((p) => {
      if (!p.fechaPago) return false
      const fechaPago = new Date(p.fechaPago)
      return fechaPago >= c.fechaComprometida && fechaPago <= fechaLimite && p.montoTotal >= c.valorComprometido * 0.9
    })

    if (pagoCumplido) {
      // Compromiso cumplido
      const diasRetraso = diasEntre(c.fechaComprometida, pagoCumplido.fechaPago!)
      await db.compromisoPago.update({
        where: { id: c.id },
        data: {
          estado: 'CUMPLIDO',
          fechaCumplimiento: pagoCumplido.fechaPago,
          pagoCumplimientoId: pagoCumplido.id,
          diasRetrasoCumplimiento: diasRetraso > 0 ? diasRetraso : 0,
        },
      })
      await auditarAccion({
        clienteId,
        prestamoId: c.prestamoId,
        compromisoId: c.id,
        tipoAccion: 'COMPROMISO_CUMPLIDO',
        descripcion: `Compromiso del ${formatFechaCorta(c.fechaComprometida)} cumplido. Pago registrado: ${formatCOP(pagoCumplido.montoTotal)}.`,
        valor: pagoCumplido.montoTotal,
        fechaComprometida: c.fechaComprometida,
        estado: 'CUMPLIDO',
      })
    } else if (hoy > fechaLimite) {
      // Compromiso incumplido (pasó la fecha límite + 3 días)
      await db.compromisoPago.update({
        where: { id: c.id },
        data: { estado: 'INCUMPLIDO' },
      })
      await auditarAccion({
        clienteId,
        prestamoId: c.prestamoId,
        compromisoId: c.id,
        tipoAccion: 'COMPROMISO_INCUMPLIDO',
        descripcion: `Compromiso del ${formatFechaCorta(c.fechaComprometida)} incumplido. No se registró pago a tiempo.`,
        valor: c.valorComprometido,
        fechaComprometida: c.fechaComprometida,
        estado: 'INCUMPLIDO',
      })
    } else if (hoy >= c.fechaComprometida) {
      // Compromiso próximo (dentro de la ventana de gracia)
      await db.compromisoPago.update({
        where: { id: c.id },
        data: { estado: 'PROXIMO' },
      })
    }
  }
}
