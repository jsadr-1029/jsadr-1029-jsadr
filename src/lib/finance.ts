// Cálculos financieros del sistema de préstamos

export type CalcPrestamoInput = {
  monto: number
  tasaMensual: number // porcentaje mensual, ej 20 = 20%
  plazoMeses: number
  frecuencia: 'MENSUAL' | 'QUINCENAL' | 'SEMANAL'
  tasaMoraDiaria?: number // porcentaje diario
}

export type CalcPrestamoResult = {
  numeroCuotas: number
  montoCuota: number
  totalInteres: number
  totalPagar: number
  tasaAplicada: number
  fechaPrimerVencimiento: Date
}

/**
 * Calcula el cronograma de un préstamo usando interés simple sobre saldos.
 * - Cuota fija = (capital + interés total) / número de cuotas
 * - Interés total = capital * tasa mensual * plazo
 */
export function calcularPrestamo(input: CalcPrestamoInput): CalcPrestamoResult {
  const { monto, tasaMensual, plazoMeses, frecuencia } = input

  let numeroCuotas = plazoMeses
  if (frecuencia === 'QUINCENAL') numeroCuotas = plazoMeses * 2
  if (frecuencia === 'SEMANAL') numeroCuotas = plazoMeses * 4

  const totalInteres = monto * (tasaMensual / 100) * plazoMeses
  const totalPagar = monto + totalInteres
  const montoCuota = Math.round(totalPagar / numeroCuotas)
  const tasaAplicada = tasaMensual / 100

  // Fecha del primer vencimiento según frecuencia
  const hoy = new Date()
  const fechaPrimerVencimiento = new Date(hoy)
  if (frecuencia === 'MENSUAL') fechaPrimerVencimiento.setMonth(fechaPrimerVencimiento.getMonth() + 1)
  if (frecuencia === 'QUINCENAL') fechaPrimerVencimiento.setDate(fechaPrimerVencimiento.getDate() + 15)
  if (frecuencia === 'SEMANAL') fechaPrimerVencimiento.setDate(fechaPrimerVencimiento.getDate() + 7)

  return {
    numeroCuotas,
    montoCuota,
    totalInteres: Math.round(totalInteres),
    totalPagar: Math.round(totalPagar),
    tasaAplicada,
    fechaPrimerVencimiento,
  }
}

export type CronogramaCuota = {
  numero: number
  fechaVencimiento: Date
  capital: number
  interes: number
  montoTotal: number
  saldoCapital: number
}

/**
 * Genera el cronograma de cuotas de un préstamo
 */
export function generarCronograma(input: CalcPrestamoInput): CronogramaCuota[] {
  const calc = calcularPrestamo(input)
  const cuotas: CronogramaCuota[] = []
  const interesPorCuota = Math.round(calc.totalInteres / calc.numeroCuotas)
  const capitalPorCuota = Math.round(input.monto / calc.numeroCuotas)

  let saldoCapital = input.monto
  for (let i = 1; i <= calc.numeroCuotas; i++) {
    const fecha = new Date(calc.fechaPrimerVencimiento)
    if (input.frecuencia === 'MENSUAL') fecha.setMonth(fecha.getMonth() + (i - 1))
    if (input.frecuencia === 'QUINCENAL') fecha.setDate(fecha.getDate() + 15 * (i - 1))
    if (input.frecuencia === 'SEMANAL') fecha.setDate(fecha.getDate() + 7 * (i - 1))

    saldoCapital -= capitalPorCuota
    cuotas.push({
      numero: i,
      fechaVencimiento: fecha,
      capital: capitalPorCuota,
      interes: interesPorCuota,
      montoTotal: capitalPorCuota + interesPorCuota,
      saldoCapital: Math.max(0, saldoCapital),
    })
  }

  // Ajustar última cuota por redondeo
  const ultima = cuotas[cuotas.length - 1]
  const totalCuotas = cuotas.reduce((sum, c) => sum + c.montoTotal, 0)
  if (totalCuotas !== calc.totalPagar) {
    ultima.montoTotal += calc.totalPagar - totalCuotas
  }

  return cuotas
}

/**
 * Calcula los días de mora desde una fecha de vencimiento
 */
export function calcularDiasMora(fechaVencimiento: Date | string | null | undefined): number {
  if (!fechaVencimiento) return 0
  const venc = typeof fechaVencimiento === 'string' ? new Date(fechaVencimiento) : fechaVencimiento
  const ahora = new Date()
  if (venc > ahora) return 0
  const diff = ahora.getTime() - venc.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Calcula el monto de mora acumulado
 */
export function calcularMoraAcumulada(
  montoBase: number,
  diasMora: number,
  tasaMoraDiaria: number,
  compuesta: boolean = false
): number {
  if (diasMora <= 0) return 0
  if (compuesta) {
    // Mora compuesta: (1 + tasa)^dias - 1
    const factor = Math.pow(1 + tasaMoraDiaria / 100, diasMora) - 1
    return Math.round(montoBase * factor)
  }
  return Math.round(montoBase * (tasaMoraDiaria / 100) * diasMora)
}

/**
 * Calcula el fondo de garantía (5% del principal por defecto)
 */
export function calcularFondoGarantia(monto: number, porcentaje = 5): number {
  return Math.round(monto * (porcentaje / 100))
}

/**
 * Distribuye un pago entre capital, interés y mora
 * Regla: mora primero, luego interés, luego capital
 */
export function distribuirPago(
  montoPago: number,
  saldoMora: number,
  saldoInteres: number,
  saldoCapital: number
): { montoMora: number; montoInteres: number; montoCapital: number; excedente: number } {
  let restante = montoPago
  const montoMora = Math.min(restante, saldoMora)
  restante -= montoMora
  const montoInteres = Math.min(restante, saldoInteres)
  restante -= montoInteres
  const montoCapital = Math.min(restante, saldoCapital)
  restante -= montoCapital
  return {
    montoMora: Math.round(montoMora),
    montoInteres: Math.round(montoInteres),
    montoCapital: Math.round(montoCapital),
    excedente: Math.round(restante),
  }
}

/**
 * Convierte tasa anual a mensual
 */
export function anualAMensual(tasaAnual: number): number {
  return tasaAnual / 12
}

/**
 * Convierte tasa mensual a diaria
 */
export function mensualADiaria(tasaMensual: number): number {
  return tasaMensual / 30
}
