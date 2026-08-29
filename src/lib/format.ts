// Utilidades de formato para el sistema de solicitudes
import { ZONA_HORARIA_COLOMBIA } from './timezone'

export function formatCOP(value: number | null | undefined, opts?: { decimals?: boolean }): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '$0'
  const num = Number(value)
  const decimals = opts?.decimals ? 0 : 0
  return '$' + num.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '0%'
  return Number(value).toFixed(decimals) + '%'
}

export function formatDate(date: Date | string | null | undefined, opts?: { withTime?: boolean }): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  if (opts?.withTime) {
    return d.toLocaleString('es-CO', {
      timeZone: ZONA_HORARIA_COLOMBIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString('es-CO', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 30) return formatDate(d)
  if (days > 0) return `hace ${days} día${days === 1 ? '' : 's'}`
  if (hours > 0) return `hace ${hours} hora${hours === 1 ? '' : 's'}`
  if (minutes > 0) return `hace ${minutes} minuto${minutes === 1 ? '' : 's'}`
  return 'hace un momento'
}

export function diasEntre(fecha1: Date | string, fecha2: Date | string = new Date()): number {
  const d1 = typeof fecha1 === 'string' ? new Date(fecha1) : fecha1
  const d2 = typeof fecha2 === 'string' ? new Date(fecha2) : fecha2
  const diff = d2.getTime() - d1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Estado de solicitud a color Tailwind
export function estadoPrestamoColor(estado: string): string {
  const map: Record<string, string> = {
    SOLICITADO: 'bg-slate-100 text-slate-700 border-slate-300',
    APROBADO: 'bg-blue-50 text-blue-700 border-blue-300',
    ACTIVO: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    PAGADO: 'bg-slate-100 text-slate-700 border-slate-300',
    REVERSADO: 'bg-amber-50 text-amber-700 border-amber-300',
    CASTIGADO: 'bg-red-50 text-red-700 border-red-300',
    VENCIDO: 'bg-orange-50 text-orange-700 border-orange-300',
    EN_MORA: 'bg-red-50 text-red-700 border-red-300',
  }
  return map[estado] || 'bg-slate-100 text-slate-700 border-slate-300'
}

export function estadoPagoColor(estado: string): string {
  const map: Record<string, string> = {
    CONFIRMADO: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-300',
    REVERSADO: 'bg-red-50 text-red-700 border-red-300',
    ANULADO: 'bg-slate-100 text-slate-700 border-slate-300',
  }
  return map[estado] || 'bg-slate-100 text-slate-700 border-slate-300'
}

export function estadoNotificacionColor(estado: string): string {
  const map: Record<string, string> = {
    PENDIENTE_MANUAL: 'bg-amber-50 text-amber-700 border-amber-300',
    ENVIADO: 'bg-blue-50 text-blue-700 border-blue-300',
    ENTREGADO: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    LEIDO: 'bg-emerald-100 text-emerald-800 border-emerald-400',
    FALLIDO: 'bg-red-50 text-red-700 border-red-300',
  }
  return map[estado] || 'bg-slate-100 text-slate-700 border-slate-300'
}

export function estadoCasoJuridicoColor(estado: string): string {
  const map: Record<string, string> = {
    RADICADO: 'bg-blue-50 text-blue-700 border-blue-300',
    COBRO_JUDICIAL: 'bg-amber-50 text-amber-700 border-amber-300',
    DEMANDA: 'bg-orange-50 text-orange-700 border-orange-300',
    EMBARGO: 'bg-red-50 text-red-700 border-red-300',
    AUDIENCIA: 'bg-purple-50 text-purple-700 border-purple-300',
    CERRADO: 'bg-slate-100 text-slate-700 border-slate-300',
  }
  return map[estado] || 'bg-slate-100 text-slate-700 border-slate-300'
}

// Generador de código OTP de 6 caracteres alfanuméricos
// Reforzado: usa crypto.getRandomValues (CSPRNG) en lugar de Math.random()
export function generateOTP(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin caracteres confusos (0, O, 1, I)
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(arr[i] % chars.length)
  }
  return result
}

// Generar código numérico de 6 dígitos
// Reforzado: usa crypto.getRandomValues (CSPRNG)
export function generateNumericCode(length = 6): string {
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += (arr[i] % 10).toString()
  }
  return result
}

// Token de firma (hex aleatorio)
export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Generar link wa.me
export function buildWaMeLink(telefono: string, mensaje: string): string {
  // Limpiar teléfono: solo dígitos, asegurar código país
  let clean = telefono.replace(/\D/g, '')
  if (clean.length === 10) clean = '57' + clean // Colombia por defecto
  const encoded = encodeURIComponent(mensaje)
  return `https://wa.me/${clean}?text=${encoded}`
}

// Sanitizar teléfono para mostrar
export function maskPhone(telefono: string): string {
  if (!telefono) return ''
  const digits = telefono.replace(/\D/g, '')
  if (digits.length < 4) return telefono
  return telefono.slice(0, -4) + '****'
}

// Sanitizar cuenta bancaria
export function maskAccount(cuenta: string): string {
  if (!cuenta) return ''
  if (cuenta.length < 4) return cuenta
  return '****' + cuenta.slice(-4)
}

// Calcular días de mora desde una fecha (zona Colombia)
import { diasMoraColombia } from './timezone'

export function calcularDiasMora(fechaVencimiento: Date | string | null | undefined): number {
  return diasMoraColombia(fechaVencimiento)
}

// Validar cédula colombiana básica
export function isValidCedula(cedula: string): boolean {
  if (!cedula) return false
  const clean = cedula.replace(/\D/g, '')
  return clean.length >= 6 && clean.length <= 11
}

// Validar teléfono colombiano
export function isValidPhone(telefono: string): boolean {
  if (!telefono) return false
  const clean = telefono.replace(/\D/g, '')
  // 10 dígitos empieza con 3 (celular) o 7 dígitos (fijo)
  return (clean.length === 10 && clean.startsWith('3')) || clean.length === 7
}

// Truncar texto
export function truncate(text: string, max = 100): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

// Iniciales para avatar
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
