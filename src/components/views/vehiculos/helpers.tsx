// Helper para formato de moneda y fechas
export function formatCOP(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '$0'
  return '$' + valor.toLocaleString('es-CO')
}

export function formatDate(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(fecha: Date | string | null | undefined): string {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const ESTADOS_VEHICULO = ['DISPONIBLE', 'ASIGNADO', 'MANTENIMIENTO', 'INACTIVO']
export const ESTADOS_CONTRATO = ['BORRADOR', 'ACTIVO', 'SUSPENDIDO', 'FINALIZADO', 'CANCELADO']
export const ESTADOS_OBLIGACION = ['PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA']
export const ESTADOS_PAGO = ['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO']
export const MODALIDADES_PAGO = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'PERSONALIZADO']
export const TIPOS_MANTENIMIENTO = ['PREVENTIVO', 'CORRECTIVO', 'REVISION', 'EMERGENCIA']
export const CATEGORIAS_REPUESTO = ['FILTRO', 'FRENO', 'MOTOR', 'SUSPENSION', 'ELECTRICO', 'OTRO']
export const CATEGORIAS_GASTO = ['COMBUSTIBLE', 'PEAJE', 'LAVADO', 'PARQUEADERO', 'SEGURO', 'OTRO']

export const COLORS_ESTADO: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  EN_REVISION: 'bg-blue-100 text-blue-800 border-blue-300',
  APROBADO: 'bg-green-100 text-green-800 border-green-300',
  RECHAZADO: 'bg-red-100 text-red-800 border-red-300',
  ACTIVO: 'bg-green-100 text-green-800 border-green-300',
  SUSPENDIDO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CANCELADO: 'bg-red-100 text-red-800 border-red-300',
  FINALIZADO: 'bg-gray-100 text-gray-800 border-gray-300',
  BORRADOR: 'bg-gray-100 text-gray-600 border-gray-300',
  DISPONIBLE: 'bg-blue-100 text-blue-800 border-blue-300',
  ASIGNADO: 'bg-green-100 text-green-800 border-green-300',
  MANTENIMIENTO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  INACTIVO: 'bg-gray-100 text-gray-600 border-gray-300',
  PARCIAL: 'bg-orange-100 text-orange-800 border-orange-300',
  PAGADA: 'bg-green-100 text-green-800 border-green-300',
  VENCIDA: 'bg-red-100 text-red-800 border-red-300',
}

export function EstadoBadge({ estado }: { estado: string }) {
  const color = COLORS_ESTADO[estado] || 'bg-gray-100 text-gray-800 border-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {estado}
    </span>
  )
}

// Helper para fetch con auth
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string; warning?: string; message?: string }> {
  try {
    // Obtener token del localStorage
    let token: string | null = null
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try {
          const u = JSON.parse(userStr)
          token = u.token || u.accessToken || null
        } catch {}
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, { ...options, headers })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || `Error HTTP ${res.status}` }
    }
    return {
      success: true,
      data: data.data !== undefined ? data.data : data,
      warning: data.warning,
      message: data.message,
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
