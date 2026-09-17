'use client'

// =====================================================
// Portal Neobanco Glass — Hook de datos y tema
// Conecta con las APIs existentes del portal (sin crear nuevas):
//   - /api/portal/mi-estado
//   - /api/portal/simular
//   - /api/portal/otros-si-pendientes
//   - /api/solicitudes-web (POST)
//   - /api/portal/marcar-campana-vista
// =====================================================

import * as React from 'react'

// =====================================================
// Tipos del dominio
// =====================================================
export type NbCliente = {
  id: string
  nombre: string
  cedula: string
  telefono?: string | null
  email?: string | null
  activo?: boolean
}

export type NbPago = {
  id: string
  numeroCuota: number
  fechaVencimiento?: string | null
  montoCapital?: number | string
  montoInteres?: number | string
  montoMora?: number | string
  montoTotal: number | string
  estado: string
  cuentaRecaudoId?: string | null
  fechaPago?: string | null
}

export type NbPrestamo = {
  id: string
  codigo: string
  estado: string
  montoPrincipal: number
  montoCuota: number
  totalInteres: number
  saldoTotal: number
  montoPagado: number
  plazoMeses: number
  frecuencia?: string
  fechaDesembolso?: string | null
  fechaAceptacion?: string | null
  flexibilidadFinanciera?: boolean
  flexibilidadModalidad?: string | null
  flexibilidadUsosEjercidos?: number
  flexibilidadUsosDisponibles?: number
  tarifaPlataformaCargada?: boolean
  pagos?: NbPago[]
  cuentaRecaudoPago?: {
    banco: string
    tipoCuenta: string
    numeroCuenta: string
    titular: string
    nombreCuenta?: string
  } | null
}

export type NbProximoVencimiento = {
  prestamoId: string
  prestamoCodigo: string
  numeroCuota: number
  fechaVencimiento: string
  montoCuota: number
  diasMora: number
}

export type NbResumen = {
  totalPrestamos: number
  prestamosActivos: number
  prestamosCancelados: number
  prestamosJuridico: number
  saldoTotalActivos: number
  totalPagado: number
}

export type NbCampana = {
  id: string
  titulo: string
  descripcion?: string | null
  tipo?: string | null
  activa: boolean
  inicioVigencia?: string | null
  finVigencia?: string | null
}

export type NbOtroSi = {
  id: string
  codigo: string
  estado: string
  tipoModificacion?: string
  descripcion?: string
  createdAt: string
}

export type NbEstado = {
  cliente: NbCliente
  resumen: NbResumen
  prestamos: NbPrestamo[]
  proximosVencimientos: NbProximoVencimiento[]
  cuentaRecaudoPrincipal: NbPrestamo['cuentaRecaudoPago'] | null
}

// =====================================================
// Hook principal: datos + theme + sesión
// =====================================================
export function useNeobancoPortal() {
  const [estado, setEstado] = React.useState<NbEstado | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const [cedula, setCedula] = React.useState<string | null>(null)
  const [otrosSi, setOtrosSi] = React.useState<NbOtroSi[]>([])
  const [campanas, setCampanas] = React.useState<NbCampana[]>([])

  // === Cargar token + cédula desde localStorage ===
  React.useEffect(() => {
    try {
      const tk = localStorage.getItem('portal_cliente_token')
      const ci = localStorage.getItem('portal_cliente_cedula')
      setToken(tk)
      setCedula(ci)
    } catch {
      setError('No se pudo acceder al almacenamiento local')
    }
  }, [])

  // === Fetch mi-estado ===
  const cargarEstado = React.useCallback(async () => {
    if (!token) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/mi-estado', {
        headers: { 'x-portal-token': token },
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al cargar tu estado')
      }
      setEstado(data.data as NbEstado)
      // Cargar campañas desde el resumen interno (incluidas en prestamosConCuenta.cliente.categoria?)
      // El endpoint mi-estado no devuelve campañas; las pedimos aparte con la cédula
      if (cedula) {
        try {
          const camRes = await fetch(`/api/portal/${cedula}`, {
            headers: { 'x-portal-token': token },
          })
          const camData = await camRes.json()
          if (camData.success && camData.data?.campanas) {
            setCampanas(camData.data.campanas)
          }
        } catch {
          /* no crítico */
        }
      }
    } catch (e: any) {
      setError(e.message || 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [token, cedula])

  React.useEffect(() => {
    if (token) cargarEstado()
  }, [token, cargarEstado])

  // === Fetch Otros Síes pendientes ===
  React.useEffect(() => {
    if (!token) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/portal/otros-si-pendientes', {
          headers: { 'x-portal-token': token },
        })
        const data = await res.json()
        if (active && Array.isArray(data?.data)) {
          setOtrosSi(data.data as NbOtroSi[])
        }
      } catch {
        /* no crítico */
      }
    })()
    return () => {
      active = false
    }
  }, [token])

  return {
    estado,
    cargando,
    error,
    token,
    cedula,
    otrosSi,
    campanas,
    recargar: cargarEstado,
  }
}

// =====================================================
// Hook: tema dark/light con persistencia
// =====================================================
export type NbTheme = 'dark' | 'light'

export function useNbTheme() {
  const [theme, setTheme] = React.useState<NbTheme>('dark')

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('nb-theme') as NbTheme | null
      const prefersLight =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      const initial = saved ?? (prefersLight ? 'light' : 'dark')
      setTheme(initial)
    } catch {
      setTheme('dark')
    }
  }, [])

  React.useEffect(() => {
    document.documentElement.setAttribute('data-neobanco-theme', theme)
    try {
      localStorage.setItem('nb-theme', theme)
    } catch {}
  }, [theme])

  const toggle = React.useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle }
}

// =====================================================
// Utilidades de formato
// =====================================================
export function formatCOP(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatFechaCorta(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function formatFechaHora(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function formatFechaRelativa(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 0 && diff <= 7) return `En ${diff} días`
  if (diff < 0 && diff >= -7) return `Hace ${-diff} días`
  return formatFechaCorta(iso)
}

export function diasEntre(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  return Math.floor((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

// Estado de préstamo → tono visual
export function estadoPrestamoTono(estado: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (estado) {
    case 'ACTIVO':
      return 'success'
    case 'EN_MORA':
      return 'danger'
    case 'PENDIENTE_ACEPTACION':
      return 'warning'
    case 'CANCELADO':
      return 'neutral'
    case 'JURIDICO':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function estadoPrestamoLabel(estado: string): string {
  const map: Record<string, string> = {
    ACTIVO: 'Al día',
    EN_MORA: 'En mora',
    PENDIENTE_ACEPTACION: 'Pendiente',
    CANCELADO: 'Cancelado',
    JURIDICO: 'Jurídico',
  }
  return map[estado] || estado
}
