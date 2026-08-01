// =====================================================
// ZONA HORARIA CENTRAL — America/Bogota (Colombia, GMT-5, sin DST)
// =====================================================
// Toda la app debe usar estas funciones para fechas de negocio.
// SQLite/Prisma guardan en UTC; mostramos/consultamos en America/Bogota.
// =====================================================

export const ZONA_HORARIA_COLOMBIA = 'America/Bogota'

/**
 * Devuelve la fecha/hora actual en zona Colombia.
 * Internamente es un Date UTC, pero sus métodos getX se interpretan en Bogota.
 */
export function ahoraColombia(): Date {
  // Forzamos que el Date retornado, al usar toLocaleString('es-CO', {timeZone}),
  // corresponda a Bogotá. La manera portable de obtener "ahora" es new Date();
  // lo importante es que cuando lo comparemos o lo formateemos usemos la zona correcta.
  return new Date()
}

/**
 * Devuelve un string ISO con offset de Bogotá (-05:00).
 * Útil para logs y almacenamiento cuando se necesita el offset visible.
 */
export function ahoraColombiaISO(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: ZONA_HORARIA_COLOMBIA }).replace(' ', 'T') + '-05:00'
}

/**
 * Formatea cualquier Date/string ISO a string legible en zona Colombia.
 * Equivalente a toLocaleString('es-CO') pero forzando timeZone America/Bogota.
 */
export function formatearColombia(
  fecha: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    ...opts,
  })
}

/**
 * Devuelve la fecha actual en Colombia truncada a inicio del día (00:00:00).
 * Útil para consultas tipo "préstamos creados hoy".
 * Retorna un Date UTC correspondiente a esa medianoche Bogota.
 */
export function inicioDiaColombia(fecha: Date = new Date()): Date {
  // Obtener componentes en zona Bogota
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value) - 1
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  // Construir UTC con offset -5: medianoche Bogota = 05:00 UTC
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
}

/**
 * Devuelve la fecha actual en Colombia truncada a fin del día (23:59:59.999).
 */
export function finDiaColombia(fecha: Date = new Date()): Date {
  const inicio = inicioDiaColombia(fecha)
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1)
}

/**
 * Devuelve el inicio (día 1, 00:00) del mes actual en zona Colombia.
 */
export function inicioMesColombia(fecha: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(fecha)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value) - 1
  return new Date(Date.UTC(y, m, 1, 5, 0, 0, 0))
}

/**
 * Devuelve el final del mes actual en zona Colombia.
 */
export function finMesColombia(fecha: Date = new Date()): Date {
  const inicio = inicioMesColombia(fecha)
  // Avanzamos al mes siguiente y restamos 1ms
  const siguiente = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1, 5, 0, 0, 0))
  return new Date(siguiente.getTime() - 1)
}

/**
 * Devuelve un objeto con {inicio, fin} para "hoy" en zona Colombia.
 */
export function rangoHoyColombia(): { inicio: Date; fin: Date } {
  return { inicio: inicioDiaColombia(), fin: finDiaColombia() }
}

/**
 * Devuelve un objeto con {inicio, fin} para "este mes" en zona Colombia.
 */
export function rangoMesColombia(): { inicio: Date; fin: Date } {
  return { inicio: inicioMesColombia(), fin: finMesColombia() }
}

/**
 * Convierte cualquier fecha a su representación "YYYY-MM-DD" en zona Colombia.
 * Útil para guardar fechas en inputs <input type="date">.
 */
export function fechaLocalColombia(fecha: Date | string = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Convierte cualquier fecha a "YYYY-MM-DDTHH:mm" en zona Colombia.
 * Útil para inputs <input type="datetime-local">.
 */
export function fechaHoraLocalColombia(fecha: Date | string = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return s.replace(' ', 'T')
}

/**
 * Días de diferencia entre dos fechas (sin contar horas).
 * Si fecha2 > fecha1, devuelve positivo.
 */
export function diasEntreColombia(
  fecha1: Date | string,
  fecha2: Date | string = new Date()
): number {
  const d1 = typeof fecha1 === 'string' ? new Date(fecha1) : fecha1
  const d2 = typeof fecha2 === 'string' ? new Date(fecha2) : fecha2
  // Truncar a medianoche Bogota para evitar errores por horas
  const i1 = inicioDiaColombia(d1).getTime()
  const i2 = inicioDiaColombia(d2).getTime()
  return Math.floor((i2 - i1) / (1000 * 60 * 60 * 24))
}

/**
 * Días de mora: días transcurridos desde fechaVencimiento hasta hoy,
 * solo si la fecha de vencimiento ya pasó.
 */
export function diasMoraColombia(fechaVencimiento: Date | string | null | undefined): number {
  if (!fechaVencimiento) return 0
  const venc = typeof fechaVencimiento === 'string' ? new Date(fechaVencimiento) : fechaVencimiento
  const hoy = inicioDiaColombia(new Date())
  if (venc > hoy) return 0
  return diasEntreColombia(venc, new Date())
}

/**
 * Devuelve la hora actual en Colombia como string "HH:mm:ss".
 */
export function horaColombia(fecha: Date | string = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Devuelve la fecha y hora actual formateada en español Colombia zona Bogota.
 */
export function fechaHoraTextoColombia(fecha: Date | string = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
