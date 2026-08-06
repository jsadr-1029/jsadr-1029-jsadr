/**
 * =====================================================
 * Utilidades para periodo de corte y días causados
 * =====================================================
 *
 * Caso de uso:
 *   - Cliente solicita un crédito ANTES de la fecha de corte.
 *   - Ej: fechaPrestamo = 2/08/2026, periodo de corte = "5-20"
 *     El corte más cercano es el 5/08/2026.
 *   - El sistema debe cobrar 3 días de interés anticipado
 *     (del 2 al 5 de agosto) y las cuotas deben programarse
 *     desde el 5/08/2026 (fecha del corte), no desde el 2/08.
 *
 * Conceptos:
 *   - periodoCorte: "5-20" | "15-30" — los días del mes en que cae corte.
 *   - fechaPrestamo: la fecha real en que se entregó el dinero.
 *   - fechaPrimerCorte: el corte más cercano FORWARD desde fechaPrestamo.
 *     Si la fechaPrestamo cae justo en un día de corte, se usa esa fecha.
 *   - diasCausadosAntes: días entre fechaPrestamo y fechaPrimerCorte.
 *   - valorDiasCausados: monto COP de interés por esos días.
 *
 * Tasa diaria:
 *   - Para modalidad FRANCÉS: tasaInteresAnual / 365
 *   - Para TASA_FIJA y CUOTA_PERSONALIZADA: tasaMensual / 30
 *   (Se usa 365 para anual y 30 para mensual — estándar bancario colombiano.)
 */

export type PeriodoCorte = "5-20" | "15-30"

// Alias corto para evitar choques de tipos
type PeriodoCorto = "5-20" | "15-30"

/**
 * Obtiene los días de corte de un periodo.
 * - "5-20"  → [5, 20]
 * - "15-30" → [15, 30]
 *
 * Nota: si el mes tiene menos de 30 días (febrero), el día 30 se ajusta
 * al último día del mes en calcularFechaPrimerCorte.
 */
export function diasDeCorte(periodo: PeriodoCorto | string): number[] {
  if (periodo === "5-20") return [5, 20]
  if (periodo === "15-30") return [15, 30]
  return []
}

/**
 * Días en un mes específico (maneja años bisiestos).
 */
function diasEnMes(year: number, month: number /* 0-indexed */): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Calcula el corte más cercano FORWARD desde fechaPrestamo.
 *
 * Reglas:
 *   1. Si fechaPrestamo cae EXACTAMENTE en un día de corte, ese es el corte.
 *   2. Si fechaPrestamo cae antes del primer corte del mes, el corte es ese día.
 *   3. Si fechaPrestamo cae entre los dos cortes del mes, el corte es el segundo.
 *   4. Si fechaPrestamo cae después del segundo corte, el corte es el primer
 *      corte del mes siguiente.
 *
 * Ejemplos (periodo "5-20"):
 *   - 2/08/2026 → 5/08/2026 (caso del usuario)
 *   - 5/08/2026 → 5/08/2026 (mismo día)
 *   - 7/08/2026 → 20/08/2026
 *   - 25/08/2026 → 5/09/2026 (mes siguiente)
 *
 * Para meses con < 30 días (febrero), el día 30 se ajusta al último día del mes.
 * Ej: 15-30 en febrero 2026 → 15/02 y 28/02.
 */
export function calcularFechaPrimerCorte(
  fechaPrestamo: Date,
  periodo: PeriodoCorto | string
): Date | null {
  const diasCorte = diasDeCorte(periodo)
  if (diasCorte.length === 0) return null

  const year = fechaPrestamo.getFullYear()
  const month = fechaPrestamo.getMonth() // 0-indexed
  const day = fechaPrestamo.getDate()

  // Ajustar días de corte al mes actual (por si el mes tiene < 30 días)
  const maxDias = diasEnMes(year, month)
  const diasCorteAjustados = diasCorte.map((d) => Math.min(d, maxDias))

  // Caso 1: cae exactamente en un día de corte
  if (diasCorteAjustados.includes(day)) {
    return new Date(year, month, day, 12, 0, 0)
  }

  // Caso 2: cae antes del primer corte del mes
  if (day < diasCorteAjustados[0]) {
    return new Date(year, month, diasCorteAjustados[0], 12, 0, 0)
  }

  // Caso 3: cae entre los dos cortes del mes
  if (day < diasCorteAjustados[1]) {
    return new Date(year, month, diasCorteAjustados[1], 12, 0, 0)
  }

  // Caso 4: cae después del segundo corte → siguiente mes, primer corte
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  const maxDiasNext = diasEnMes(nextYear, nextMonth)
  const primerCorteNext = Math.min(diasCorte[0], maxDiasNext)
  return new Date(nextYear, nextMonth, primerCorteNext, 12, 0, 0)
}

/**
 * Calcula los días causados entre fechaPrestamo y fechaPrimerCorte.
 * Incluye el día de inicio y el día de corte (inclusivo en ambos extremos).
 *
 * Ej: 2/08 → 5/08 = 3 días (día 2, 3, 4 — el 5 es el corte, no se cobra).
 *    Pero según el caso del usuario: "el sistema deberá cobrarle los 3 días
 *    que faltan para llegar al 5/08/2026" → son 3 días (del 2 al 4 inclusive,
 *    el 5 inicia el periodo normal).
 *
 * Por eso: días = (fechaCorte - fechaPrestamo) en días naturales.
 */
export function calcularDiasCausadosAntes(
  fechaPrestamo: Date,
  fechaPrimerCorte: Date
): number {
  const msPorDia = 1000 * 60 * 60 * 24
  // Usar mediodía para ambos y luego diff para evitar DST/zone issues
  const f1 = new Date(
    fechaPrestamo.getFullYear(),
    fechaPrestamo.getMonth(),
    fechaPrestamo.getDate(),
    12,
    0,
    0
  )
  const f2 = new Date(
    fechaPrimerCorte.getFullYear(),
    fechaPrimerCorte.getMonth(),
    fechaPrimerCorte.getDate(),
    12,
    0,
    0
  )
  const diffMs = f2.getTime() - f1.getTime()
  const dias = Math.round(diffMs / msPorDia)
  return dias > 0 ? dias : 0
}

/**
 * Calcula el valor COP a cobrar por los días causados.
 *
 * Fórmula: valorDiasCausados = montoPrincipal * tasaDiaria * dias / 100
 *
 * Donde tasaDiaria:
 *   - Para tasa anual: tasaAnual / 365 (ej: 24% → 0.06575% diario)
 *   - Para tasa mensual: tasaMensual / 30 (ej: 15% → 0.5% diario)
 *
 * @param montoPrincipal Capital del préstamo (COP)
 * @param dias Número de días causados
 * @param tasaValor Valor de la tasa (ej: 24 para 24% anual, 15 para 15% mensual)
 * @param tipoTasa "ANUAL" | "MENSUAL" — define cómo calcular la tasa diaria
 */
export function calcularValorDiasCausados(
  montoPrincipal: number,
  dias: number,
  tasaValor: number,
  tipoTasa: "ANUAL" | "MENSUAL"
): number {
  if (!montoPrincipal || !dias || !tasaValor) return 0
  const tasaDiaria = tipoTasa === "ANUAL" ? tasaValor / 365 : tasaValor / 30
  const valor = (montoPrincipal * tasaDiaria * dias) / 100
  return Math.round(valor * 100) / 100
}

/**
 * Función de conveniencia: dado fechaPrestamo + periodo + tasa, calcula
 * todos los valores del bloque de "días causados" en una sola llamada.
 *
 * Devuelve null si no se puede calcular (ej: fechaPrestamo vacía).
 */
export function calcularBloqueCorte(params: {
  fechaPrestamo: Date | string | null
  periodo: PeriodoCorto | string | null
  montoPrincipal: number | string
  tasaValor: number | string
  tipoTasa: "ANUAL" | "MENSUAL"
}): {
  fechaPrimerCorte: Date
  diasCausadosAntes: number
  valorDiasCausados: number
} | null {
  const { fechaPrestamo, periodo, montoPrincipal, tasaValor, tipoTasa } = params
  if (!fechaPrestamo || !periodo) return null

  // Parsear fechaPrestamo (acepta Date o "YYYY-MM-DD")
  let fPrestamo: Date
  if (fechaPrestamo instanceof Date) {
    fPrestamo = fechaPrestamo
  } else {
    const [yyyy, mm, dd] = fechaPrestamo.split("-").map(Number)
    if (!yyyy || !mm || !dd) return null
    fPrestamo = new Date(yyyy, mm - 1, dd, 12, 0, 0)
  }

  const fechaPrimerCorte = calcularFechaPrimerCorte(fPrestamo, periodo)
  if (!fechaPrimerCorte) return null

  const diasCausadosAntes = calcularDiasCausadosAntes(fPrestamo, fechaPrimerCorte)
  if (diasCausadosAntes === 0) {
    // fechaPrestamo cae justo en corte — no hay días causados
    return {
      fechaPrimerCorte,
      diasCausadosAntes: 0,
      valorDiasCausados: 0,
    }
  }

  const monto = typeof montoPrincipal === "string" ? parseFloat(montoPrincipal) : montoPrincipal
  const tasa = typeof tasaValor === "string" ? parseFloat(tasaValor) : tasaValor
  const valorDiasCausados = calcularValorDiasCausados(monto || 0, diasCausadosAntes, tasa || 0, tipoTasa)

  return { fechaPrimerCorte, diasCausadosAntes, valorDiasCausados }
}
