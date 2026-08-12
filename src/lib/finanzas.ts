// =====================================================
// Librería de Cálculo Financiero v2.0
// - Interés FIJO sobre capital inicial (cuota constante)
// - Mora compuesta diaria modificable
// =====================================================

import crypto from 'crypto'

export type Frecuencia = 'MENSUAL' | 'QUINCENAL' | 'SEMANAL' | 'DIARIO'

export interface ParametrosPrestamo {
  montoPrincipal: number
  tasaInteresAnual: number
  tasaMoraAnual: number
  plazoMeses: number
  frecuencia: Frecuencia
  fechaSolicitud?: Date
  fechaDesembolso?: Date
}

export interface CuotaAmortizacion {
  numero: number
  fechaVencimiento: Date
  montoCuota: number
  capital: number
  interes: number
  saldoCapital: number
  acumuladoInteres: number
  acumuladoCapital: number
}

export interface ResultadoCalculo {
  numeroCuotas: number
  montoCuota: number
  totalInteres: number
  totalPagar: number
  tasaAplicada: number
  tablaAmortizacion: CuotaAmortizacion[]
  fechaVencimiento: Date
  fondoGarantia: number // 5% del primer préstamo
}

const PERIODOS_POR_ANIO: Record<Frecuencia, number> = {
  MENSUAL: 12,
  QUINCENAL: 24,
  SEMANAL: 52,
  DIARIO: 360,
}

export function calcularFechaVencimiento(
  fechaInicio: Date,
  numeroCuota: number,
  frecuencia: Frecuencia
): Date {
  const fecha = new Date(fechaInicio)
  switch (frecuencia) {
    case 'MENSUAL':
      fecha.setMonth(fecha.getMonth() + numeroCuota)
      break
    case 'QUINCENAL':
      fecha.setDate(fecha.getDate() + 15 * numeroCuota)
      break
    case 'SEMANAL':
      fecha.setDate(fecha.getDate() + 7 * numeroCuota)
      break
    case 'DIARIO':
      fecha.setDate(fecha.getDate() + numeroCuota)
      break
  }
  return fecha
}

/**
 * Cálculo de préstamo con cuota FIJA sobre capital inicial
 * Fórmula sistema francés: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * El interés se calcula SIEMPRE sobre el capital inicial (no sobre saldo)
 * por lo que la cuota es constante de inicio a fin
 */
export function calcularPrestamo(parametros: ParametrosPrestamo): ResultadoCalculo {
  const {
    montoPrincipal,
    tasaInteresAnual,
    plazoMeses,
    frecuencia,
    fechaDesembolso,
  } = parametros

  const periodosAnio = PERIODOS_POR_ANIO[frecuencia]
  const tasaAplicada = tasaInteresAnual / 100 / periodosAnio

  let numeroCuotas: number
  switch (frecuencia) {
    case 'MENSUAL':
      numeroCuotas = plazoMeses
      break
    case 'QUINCENAL':
      numeroCuotas = plazoMeses * 2
      break
    case 'SEMANAL':
      numeroCuotas = Math.round(plazoMeses * 4.345)
      break
    case 'DIARIO':
      numeroCuotas = plazoMeses * 30
      break
  }

  // Cuota fija usando sistema francés
  let montoCuota: number
  if (tasaAplicada === 0) {
    montoCuota = montoPrincipal / numeroCuotas
  } else {
    const factor = Math.pow(1 + tasaAplicada, numeroCuotas)
    montoCuota = montoPrincipal * (tasaAplicada * factor) / (factor - 1)
  }
  montoCuota = Math.round(montoCuota * 100) / 100

  // Tabla de amortización
  const fechaInicio = fechaDesembolso || new Date()
  const tablaAmortizacion: CuotaAmortizacion[] = []
  let saldoCapital = montoPrincipal
  let acumuladoInteres = 0
  let acumuladoCapital = 0
  let totalInteres = 0

  for (let i = 1; i <= numeroCuotas; i++) {
    const interesCuota = Math.round(saldoCapital * tasaAplicada * 100) / 100
    let capitalCuota = Math.round((montoCuota - interesCuota) * 100) / 100

    if (i === numeroCuotas) {
      capitalCuota = Math.round(saldoCapital * 100) / 100
    }

    saldoCapital = Math.round((saldoCapital - capitalCuota) * 100) / 100
    if (saldoCapital < 0) saldoCapital = 0

    acumuladoInteres = Math.round((acumuladoInteres + interesCuota) * 100) / 100
    acumuladoCapital = Math.round((acumuladoCapital + capitalCuota) * 100) / 100
    totalInteres = Math.round((totalInteres + interesCuota) * 100) / 100

    tablaAmortizacion.push({
      numero: i,
      fechaVencimiento: calcularFechaVencimiento(fechaInicio, i, frecuencia),
      montoCuota: i === numeroCuotas ? Math.round((capitalCuota + interesCuota) * 100) / 100 : montoCuota,
      capital: capitalCuota,
      interes: interesCuota,
      saldoCapital,
      acumuladoInteres,
      acumuladoCapital,
    })
  }

  const totalPagar = Math.round((montoPrincipal + totalInteres) * 100) / 100
  const fechaVencimiento = calcularFechaVencimiento(fechaInicio, numeroCuotas, frecuencia)
  const fondoGarantia = Math.round(montoPrincipal * 0.05 * 100) / 100 // 5%

  return {
    numeroCuotas,
    montoCuota,
    totalInteres,
    totalPagar,
    tasaAplicada,
    tablaAmortizacion,
    fechaVencimiento,
    fondoGarantia,
  }
}

/**
 * Cálculo de mora COMPUESTA DIARIA
 *
 * Fórmula: M = S * (1 + r)^d - S
 * donde:
 *   S = saldo base (capital inicial prestado según política del usuario)
 *   r = tasa moratoria DIARIA en decimal (ej: 0.01 para 1% diario)
 *   d = días de mora
 *
 * Mora compuesta: cada día se calcula sobre el saldo + mora acumulada del día anterior.
 *
 * ⚠️ IMPORTANTE: La tasa que se pasa aquí es DIARIA (no anual).
 * El admin determina directamente el % diario en el formulario del préstamo
 * (ej: "1" significa 1% diario sobre el capital inicial prestado).
 */
export function calcularMoraCompuesta(
  saldoPendiente: number,
  tasaMoraDiaria: number,  // % DIARIO (ej: 1 para 1% diario)
  diasMora: number
): number {
  if (diasMora <= 0 || saldoPendiente <= 0) return 0
  const tasaDiariaDecimal = tasaMoraDiaria / 100
  // Mora compuesta: M = S * [(1 + r)^d - 1]
  const mora = saldoPendiente * (Math.pow(1 + tasaDiariaDecimal, diasMora) - 1)
  return Math.round(mora * 100) / 100
}

/**
 * Calcula días de mora de una cuota vencida
 */
export function calcularDiasMora(fechaVencimiento: Date, fechaActual: Date = new Date()): number {
  const diff = fechaActual.getTime() - fechaVencimiento.getTime()
  if (diff <= 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Devuelve la tasa moratoria DIARIA efectiva de un préstamo.
 *
 * El campo Prisma `Prestamo.tasaMoraDiaria` almacena la tasa DIARIA configurada
 * por el admin (ej: 1 = 1% diario). El admin puede sobrescribirla por préstamo
 * vía `tasaMoraPersonalizada` (PATCH actualizar_tasa_mora).
 *
 * Orden de prioridad:
 *   1. tasaMoraPersonalizada (override del admin, también diario)
 *   2. tasaMoraDiaria (valor guardado al crear el préstamo)
 *
 * @param prestamo Objeto préstamo con campos tasaMoraPersonalizada y tasaMoraDiaria
 * @returns Tasa moratoria diaria efectiva (ej: 1 = 1% diario)
 */
export function getTasaMoraDiaria(prestamo: {
  tasaMoraPersonalizada?: number | null
  tasaMoraDiaria: number
}): number {
  const tasa = prestamo.tasaMoraPersonalizada ?? prestamo.tasaMoraDiaria
  return Number.isFinite(tasa) ? tasa : 0
}

/**
 * @deprecated Usar getTasaMoraDiaria.
 * Mantenido por compatibilidad con código que aún referencia el nombre antiguo.
 * Internamente delega a getTasaMoraDiaria.
 */
export function getTasaMoraAnual(prestamo: {
  tasaMoraPersonalizada?: number | null
  tasaMoraDiaria: number
}): number {
  return getTasaMoraDiaria(prestamo)
}

/**
 * Determina si un préstamo debe ir a cobro jurídico (60 días de mora)
 */
export function debeIrAJuridico(diasMora: number): boolean {
  return diasMora >= 60
}

export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor || 0)
}

export function formatearFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatearFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Genera un código de pago único para links de pago
 */
// Reforzado: usar crypto.randomInt en lugar de Math.random para seguridad criptográfica
export function generarCodigoPago(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  // crypto.randomInt es CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
  const random = crypto.randomInt(0, 1679616).toString(36).padStart(4, '0').substring(0, 4).toUpperCase()
  return `PAY-${timestamp}-${random}`
}

/**
 * Genera un token único para aceptación de T&C
 * Reforzado: usa crypto.randomBytes (CSPRNG) en lugar de Math.random()
 */
export function generarTokenTyC(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Genera código OTP de 6 dígitos
 * Reforzado: usa crypto.randomInt (CSPRNG) para que el OTP NO sea predecible
 */
export function generarOTP(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

// =====================================================
// PRÉSTAMO TASA FIJA MENSUAL (sobre capital inicial)
// =====================================================
// Modelo usado para clientes con tasa personalizada:
//   - Interés mensual constante = capital × tasaMensualFija% (NO varía)
//   - Abono a capital mensual constante = capital / numeroCuotas
//   - Cuota total constante = abono capital + interés mensual
//   - Última cuota se ajusta para dejar el saldo en 0
// =====================================================

export interface ParametrosPrestamoTasaFija {
  montoPrincipal: number
  tasaMensualFija: number   // % mensual (ej: 3 = 3% mensual sobre capital inicial)
  numeroCuotas: number
  frecuencia: Frecuencia
  fechaDesembolso?: Date
}

export function calcularPrestamoTasaFijaMensual(parametros: ParametrosPrestamoTasaFija): ResultadoCalculo {
  const {
    montoPrincipal,
    tasaMensualFija,
    numeroCuotas,
    frecuencia,
    fechaDesembolso,
  } = parametros

  if (numeroCuotas <= 0) {
    throw new Error('El número de cuotas debe ser mayor a 0')
  }
  if (montoPrincipal <= 0) {
    throw new Error('El monto principal debe ser mayor a 0')
  }
  if (tasaMensualFija < 0) {
    throw new Error('La tasa mensual no puede ser negativa')
  }

  // === CORRECCIÓN DEFINITIVA: La tasa es MENSUAL (capital × tasa% por cada mes de duración).
  // El número de cuotas NO afecta el interés. Solo afecta la duración en meses.
  //
  // Lógica:
  //   - 1 cuota mensual      = 1 mes  → interés = capital × tasa% × 1 mes
  //   - 1 cuota quincenal    = 0.5 mes → interés = capital × tasa% × 1 mes (mínimo 1 mes)
  //   - 2 cuotas mensuales   = 2 meses → interés = capital × tasa% × 2 meses
  //   - 2 cuotas quincenales = 1 mes  → interés = capital × tasa% × 1 mes
  //   - 4 cuotas quincenales = 2 meses → interés = capital × tasa% × 2 meses
  //   - 3 cuotas mensuales   = 3 meses → interés = capital × tasa% × 3 meses
  //
  // Ejemplo: 300.000 al 20% mensual
  //   - 1 cuota mensual: 300.000 + (300.000 × 20% × 1) = 360.000 → cuota = 360.000
  //   - 1 cuota quincenal: 300.000 + (300.000 × 20% × 1) = 360.000 → cuota = 360.000
  //   - 2 cuotas mensuales: 300.000 + (300.000 × 20% × 2) = 420.000 → cuota = 210.000
  //   - 2 cuotas quincenales: 300.000 + (300.000 × 20% × 1) = 360.000 → cuota = 180.000
  //   - 4 cuotas quincenales: 300.000 + (300.000 × 20% × 2) = 420.000 → cuota = 105.000
  // ============================================================================

  // Tasa aplicada (en formato decimal sobre el capital inicial)
  const tasaAplicada = tasaMensualFija / 100

  // === Calcular duración en MESES según la frecuencia y número de cuotas ===
  let mesesDuracion = 1 // mínimo 1 mes (aunque sea 1 cuota quincenal)
  if (frecuencia === 'MENSUAL') {
    mesesDuracion = numeroCuotas // cada cuota mensual = 1 mes
  } else if (frecuencia === 'QUINCENAL') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 2)) // 2 quincenas = 1 mes
  } else if (frecuencia === 'SEMANAL') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 4)) // 4 semanas = 1 mes
  } else if (frecuencia === 'DIARIO') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 30)) // 30 días = 1 mes
  }

  // Interés TOTAL = capital × tasa% × meses de duración
  const interesTotalFijo = Math.round(montoPrincipal * tasaAplicada * mesesDuracion * 100) / 100

  // Total a pagar = capital + interés total
  const totalPagarCalculado = Math.round((montoPrincipal + interesTotalFijo) * 100) / 100

  // Cuota constante = total a pagar / número de cuotas
  const montoCuota = Math.round((totalPagarCalculado / numeroCuotas) * 100) / 100

  // Abono a capital constante por cuota
  const abonoCapitalCuota = Math.round((montoPrincipal / numeroCuotas) * 100) / 100

  // Interés por cuota (constante, dividido equitativamente)
  const interesPorCuota = Math.round((interesTotalFijo / numeroCuotas) * 100) / 100

  // Tabla de amortización
  const fechaInicio = fechaDesembolso || new Date()
  const tablaAmortizacion: CuotaAmortizacion[] = []
  let saldoCapital = montoPrincipal
  let acumuladoInteres = 0
  let acumuladoCapital = 0
  let totalInteres = 0

  for (let i = 1; i <= numeroCuotas; i++) {
    let capitalCuota = abonoCapitalCuota
    let interesCuota = interesPorCuota
    let cuotaEsta = montoCuota

    if (i === numeroCuotas) {
      // Ajuste final: el capital restante + interés de la última cuota
      capitalCuota = Math.round(saldoCapital * 100) / 100
      // El interés de la última cuota se ajusta para que el total cuadre
      interesCuota = Math.round((totalPagarCalculado - acumuladoCapital - acumuladoInteres - capitalCuota) * 100) / 100
      if (interesCuota < 0) interesCuota = 0
      cuotaEsta = Math.round((capitalCuota + interesCuota) * 100) / 100
    }

    saldoCapital = Math.round((saldoCapital - capitalCuota) * 100) / 100
    if (saldoCapital < 0) saldoCapital = 0

    acumuladoInteres = Math.round((acumuladoInteres + interesCuota) * 100) / 100
    acumuladoCapital = Math.round((acumuladoCapital + capitalCuota) * 100) / 100
    totalInteres = Math.round((totalInteres + interesCuota) * 100) / 100

    tablaAmortizacion.push({
      numero: i,
      fechaVencimiento: calcularFechaVencimiento(fechaInicio, i, frecuencia),
      montoCuota: cuotaEsta,
      capital: capitalCuota,
      interes: interesCuota,
      saldoCapital,
      acumuladoInteres,
      acumuladoCapital,
    })
  }

  const totalPagar = Math.round((montoPrincipal + totalInteres) * 100) / 100
  const fechaVencimiento = calcularFechaVencimiento(fechaInicio, numeroCuotas, frecuencia)
  const fondoGarantia = Math.round(montoPrincipal * 0.05 * 100) / 100 // 5%

  return {
    numeroCuotas,
    montoCuota,
    totalInteres,
    totalPagar,
    tasaAplicada,
    tablaAmortizacion,
    fechaVencimiento,
    fondoGarantia,
  }
}
