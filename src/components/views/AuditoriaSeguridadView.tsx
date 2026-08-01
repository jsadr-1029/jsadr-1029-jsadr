'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  CircleDot,
  Users,
  FileWarning,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// =====================================================
// TIPOS — alineados con la respuesta real de /api/auditoria-seguridad
// =====================================================

type EstadoControlEmoji = '🟢' | '🟡' | '🔴' | '⚪'
type NivelRiesgo = 'Crítico' | 'Alto' | 'Medio' | 'Bajo'
type EstadoTrabajo = 'pendiente' | 'en_progreso' | 'resuelto' | 'descartado'

interface Hallazgo {
  control: string
  estado: EstadoControlEmoji | string
  riesgo: NivelRiesgo | string
  evidencia: string
  explicacion: string
  escenario: string
  recomendacion: string
  prioridad: string
  estadoTrabajo: EstadoTrabajo
  asignadoA: string | null
  fechaAsignacion: string | null
  fechaResolucion: string | null
  notasTrabajo: string | null
  nivelRiesgo: NivelRiesgo | string
}

interface Resumen {
  total: number
  cumple: number
  parcial: number
  noCumple: number
  porcentaje: number
  puntaje: number
  enProgreso: number
  resueltos: number
  pendientes: number
}

interface ApiResponse {
  success: boolean
  data?: {
    hallazgos: Hallazgo[]
    resumen: Resumen
    top10?: Hallazgo[]
  }
  error?: string
}

// =====================================================
// CONFIGURACIÓN VISUAL
// =====================================================

const REFRESH_INTERVAL_MS = 30_000

const NIVEL_CONFIG: Record<
  string,
  {
    label: string
    order: number
    badgeClass: string
    borderClass: string
    bgClass: string
    icon: LucideIcon
    color: string
  }
> = {
  Crítico: {
    label: 'Crítico',
    order: 0,
    badgeClass: 'bg-red-500/15 text-red-300 border-red-400/40',
    borderClass: 'border-l-red-500/70',
    bgClass: 'bg-red-500/5',
    icon: ShieldX,
    color: '#ef4444',
  },
  Alto: {
    label: 'Alto',
    order: 1,
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-400/40',
    borderClass: 'border-l-orange-500/70',
    bgClass: 'bg-orange-500/5',
    icon: ShieldAlert,
    color: '#f97316',
  },
  Medio: {
    label: 'Medio',
    order: 2,
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
    borderClass: 'border-l-amber-500/70',
    bgClass: 'bg-amber-500/5',
    icon: AlertTriangle,
    color: '#f59e0b',
  },
  Bajo: {
    label: 'Bajo',
    order: 3,
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
    borderClass: 'border-l-sky-500/70',
    bgClass: 'bg-sky-500/5',
    icon: ShieldCheck,
    color: '#0ea5e9',
  },
}

const ESTADO_CONTROL_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  '🟢': { label: 'Cumple', color: '#10b981', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-300' },
  '🟡': { label: 'Parcial', color: '#f59e0b', bgClass: 'bg-amber-500/15', textClass: 'text-amber-300' },
  '🔴': { label: 'No Cumple', color: '#ef4444', bgClass: 'bg-red-500/15', textClass: 'text-red-300' },
  '⚪': { label: 'Pendiente', color: '#64748b', bgClass: 'bg-slate-500/15', textClass: 'text-slate-300' },
}

const ESTADO_ACCION_CONFIG: Record<
  EstadoTrabajo,
  { label: string; badgeClass: string; icon: LucideIcon }
> = {
  pendiente: {
    label: 'Abierto',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
    icon: CircleDot,
  },
  en_progreso: {
    label: 'En Trabajo',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/40',
    icon: Activity,
  },
  resuelto: {
    label: 'Resuelto',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
    icon: CheckCircle,
  },
  descartado: {
    label: 'Descartado',
    badgeClass: 'bg-white/10 text-muted-foreground border-white/20',
    icon: CircleSlash,
  },
}

function getNivelConfig(nivel: string) {
  return NIVEL_CONFIG[nivel] || NIVEL_CONFIG.Bajo
}

function getEstadoControlConfig(estado: string) {
  return ESTADO_CONTROL_CONFIG[estado] || ESTADO_CONTROL_CONFIG['⚪']
}

function getEstadoAccionConfig(estado: EstadoTrabajo) {
  return ESTADO_ACCION_CONFIG[estado] || ESTADO_ACCION_CONFIG.pendiente
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function AuditoriaSeguridadView() {
  const { toast } = useToast()

  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [nivelExpandido, setNivelExpandido] = useState<string | null>(null)

  // -------- Cargar hallazgos --------
  const cargar = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/auditoria-seguridad', { cache: 'no-store' })
        const json: ApiResponse = await res.json()
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `Error ${res.status} ${res.statusText}`)
        }
        setHallazgos(json.data.hallazgos || [])
        setResumen(json.data.resumen || null)
        setUltimaActualizacion(new Date())
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error desconocido al cargar auditoría'
        setError(msg)
        if (!silent) {
          toast({ title: 'Error al cargar auditoría', description: msg, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  // -------- Auto-refresh --------
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => cargar(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autoRefresh, cargar])

  // -------- Acciones (sin auto-arreglar) --------
  const accionHallazgo = async (
    control: string,
    nivelRiesgo: string,
    accion: 'seleccionar' | 'resolver' | 'descartar',
    notasTrabajo?: string,
  ) => {
    setActualizandoId(control)
    try {
      const res = await fetch('/api/auditoria-seguridad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          control,
          nivelRiesgo,
          asignadoA: 'admin',
          notasTrabajo: notasTrabajo || `Acción manual: ${accion}`,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error en la acción')
      }
      toast({
        title: 'Acción registrada',
        description: json.mensaje || `Hallazgo ${control} actualizado`,
      })
      await cargar(true)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setActualizandoId(null)
    }
  }

  const accionPorNivel = async (nivelRiesgo: string) => {
    setActualizandoId(`nivel-${nivelRiesgo}`)
    try {
      const res = await fetch('/api/auditoria-seguridad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'seleccionar_nivel',
          nivelRiesgo,
          asignadoA: 'admin',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error en la acción por nivel')
      }
      toast({
        title: 'Nivel en trabajo',
        description: json.mensaje || `${nivelRiesgo} marcado en trabajo`,
      })
      await cargar(true)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setActualizandoId(null)
    }
  }

  const resetTodo = async () => {
    if (!confirm('¿Resetear TODOS los hallazgos? Esto borrará el tracking de trabajo y volverán a su estado técnico escaneado.')) return
    setActualizandoId('reset-all')
    try {
      const res = await fetch('/api/auditoria-seguridad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'resetear_todo' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al resetear')
      toast({ title: 'Reset completo', description: json.mensaje })
      await cargar(true)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setActualizandoId(null)
    }
  }

  // -------- Derivados (memo) --------
  const porNivel = useMemo(() => {
    const grupos: Record<string, Hallazgo[]> = { Crítico: [], Alto: [], Medio: [], Bajo: [] }
    for (const h of hallazgos) {
      const nivel = (h.nivelRiesgo || h.riesgo || 'Bajo') as string
      if (!grupos[nivel]) grupos[nivel] = []
      grupos[nivel].push(h)
    }
    return grupos
  }, [hallazgos])

  const cumpleLista = useMemo(() => hallazgos.filter((h) => h.estado === '🟢'), [hallazgos])
  const parcialLista = useMemo(() => hallazgos.filter((h) => h.estado === '🟡'), [hallazgos])
  const noCumpleLista = useMemo(() => hallazgos.filter((h) => h.estado === '🔴'), [hallazgos])
  const pendienteLista = useMemo(() => hallazgos.filter((h) => h.estado === '⚪'), [hallazgos])

  const toggleNivel = (nivel: string) => {
    setNivelExpandido((prev) => (prev === nivel ? null : nivel))
  }

  // =====================================================
  // RENDER
  // =====================================================

  if (loading && hallazgos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Auditoría de Seguridad"
          subtitle="Cargando 25 controles…"
          icon={<ShieldAlert className="w-5 h-5" />}
        />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
            <p>Escanendo controles de seguridad…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && hallazgos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Auditoría de Seguridad"
          subtitle="Error al cargar"
          icon={<ShieldAlert className="w-5 h-5" />}
        />
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-12 text-center">
            <XCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
            <p className="font-semibold mb-1">No se pudo cargar la auditoría</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={() => cargar()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría de Seguridad"
        subtitle="25 controles · Mapa de cumplimiento · Hallazgos por nivel de riesgo"
        icon={<ShieldAlert className="w-5 h-5" />}
        actions={
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Play className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground select-none">Auto 30s</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-9 p-0"
                onClick={() => setAutoRefresh((v) => !v)}
              >
                <span
                  className={cn(
                    'block h-4 w-7 rounded-full transition-colors relative',
                    autoRefresh ? 'bg-emerald-500/60' : 'bg-white/20',
                  )}
                >
                  <span
                    className={cn(
                      'block h-3 w-3 rounded-full bg-white absolute top-0.5 transition-all',
                      autoRefresh ? 'left-3.5' : 'left-0.5',
                    )}
                  />
                </span>
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => cargar()} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Refrescar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetTodo}
              disabled={actualizandoId === 'reset-all'}
              className="text-amber-300 border-amber-400/40 hover:bg-amber-500/10"
            >
              {actualizandoId === 'reset-all' ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Reset
            </Button>
          </>
        }
      />

      {/* ====== KPIs GLOBALES — CANTIDAD DE HALLAZGOS ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Hallazgos"
          value={resumen?.total ?? hallazgos.length}
          icon={FileWarning}
          color="#6366f1"
        />
        <KpiCard
          label="Cumple"
          value={resumen?.cumple ?? cumpleLista.length}
          icon={CheckCircle}
          color="#10b981"
        />
        <KpiCard
          label="Parcial"
          value={resumen?.parcial ?? parcialLista.length}
          icon={AlertTriangle}
          color="#f59e0b"
        />
        <KpiCard
          label="No Cumple"
          value={resumen?.noCumple ?? noCumpleLista.length}
          icon={XCircle}
          color="#ef4444"
        />
        <KpiCard
          label="En Trabajo"
          value={resumen?.enProgreso ?? 0}
          icon={Activity}
          color="#6366f1"
        />
        <KpiCard
          label="Score"
          value={`${resumen?.puntaje ?? 0}/100`}
          icon={ShieldCheck}
          color="#a855f7"
        />
      </div>

      {/* ====== MAPA DE CUMPLIMIENTO ====== */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Mapa de Cumplimiento
            {ultimaActualizacion && (
              <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {ultimaActualizacion.toLocaleTimeString('es-CO')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barra principal de cumplimiento */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Cumplimiento global</span>
              <span className="text-2xl font-bold text-primary">
                {resumen?.puntaje ?? 0}<span className="text-sm text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="h-6 w-full rounded-full overflow-hidden flex bg-white/5 border border-white/10">
              {(() => {
                const total = resumen?.total || 1
                const cumplePct = ((resumen?.cumple ?? 0) / total) * 100
                const parcialPct = ((resumen?.parcial ?? 0) / total) * 100
                const noCumplePct = ((resumen?.noCumple ?? 0) / total) * 100
                const pendientePct = ((total - (resumen?.cumple ?? 0) - (resumen?.parcial ?? 0) - (resumen?.noCumple ?? 0)) / total) * 100
                return (
                  <>
                    <div
                      className="bg-emerald-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${cumplePct}%` }}
                      title={`Cumple: ${resumen?.cumple ?? 0}`}
                    >
                      {cumplePct > 8 && <span className="text-[10px] font-bold text-white">{resumen?.cumple ?? 0}</span>}
                    </div>
                    <div
                      className="bg-amber-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${parcialPct}%` }}
                      title={`Parcial: ${resumen?.parcial ?? 0}`}
                    >
                      {parcialPct > 8 && <span className="text-[10px] font-bold text-white">{resumen?.parcial ?? 0}</span>}
                    </div>
                    <div
                      className="bg-red-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${noCumplePct}%` }}
                      title={`No cumple: ${resumen?.noCumple ?? 0}`}
                    >
                      {noCumplePct > 8 && <span className="text-[10px] font-bold text-white">{resumen?.noCumple ?? 0}</span>}
                    </div>
                    <div
                      className="bg-slate-500 transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${pendientePct}%` }}
                      title={`Pendiente: ${total - (resumen?.cumple ?? 0) - (resumen?.parcial ?? 0) - (resumen?.noCumple ?? 0)}`}
                    >
                      {pendientePct > 8 && <span className="text-[10px] font-bold text-white">{total - (resumen?.cumple ?? 0) - (resumen?.parcial ?? 0) - (resumen?.noCumple ?? 0)}</span>}
                    </div>
                  </>
                )
              })()}
            </div>
            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-muted-foreground">Cumple:</span>
                <span className="font-semibold">{resumen?.cumple ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-500" />
                <span className="text-muted-foreground">Parcial:</span>
                <span className="font-semibold">{resumen?.parcial ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-500" />
                <span className="text-muted-foreground">No cumple:</span>
                <span className="font-semibold">{resumen?.noCumple ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-slate-500" />
                <span className="text-muted-foreground">Pendiente:</span>
                <span className="font-semibold">{(resumen?.total ?? 0) - (resumen?.cumple ?? 0) - (resumen?.parcial ?? 0) - (resumen?.noCumple ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* ====== INDICADOR: QUÉ CUMPLE Y QUÉ NO ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-3 border-t">
            {/* Cumple */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">Sí cumple con la seguridad</span>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/40">
                  {cumpleLista.length} controles
                </Badge>
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {cumpleLista.length === 0 ? (
                  <li className="text-xs text-muted-foreground italic">Ningún control cumple todavía</li>
                ) : (
                  cumpleLista.map((h) => (
                    <li key={h.control} className="text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{h.control}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* No cumple */}
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-300">No cumple con la seguridad</span>
                </div>
                <Badge className="bg-red-500/15 text-red-300 border-red-400/40">
                  {noCumpleLista.length + parcialLista.length} controles
                </Badge>
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {noCumpleLista.length === 0 && parcialLista.length === 0 ? (
                  <li className="text-xs text-muted-foreground italic">Todo cumple ✨</li>
                ) : (
                  <>
                    {noCumpleLista.map((h) => (
                      <li key={h.control} className="text-xs flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="truncate">{h.control}</span>
                      </li>
                    ))}
                    {parcialLista.map((h) => (
                      <li key={h.control} className="text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{h.control}</span>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== TARJETAS POR NIVEL DE RIESGO ====== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Hallazgos por Nivel de Riesgo
          </h3>
          <span className="text-xs text-muted-foreground">
            Click en una tarjeta para expandir y ver controles
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(porNivel)
            .sort(([a], [b]) => (getNivelConfig(a).order - getNivelConfig(b).order))
            .map(([nivel, items]) => {
              const cfg = getNivelConfig(nivel)
              const Icono = cfg.icon
              const expandido = nivelExpandido === nivel
              const cuentaCumple = items.filter((h) => h.estado === '🟢').length
              const cuentaParcial = items.filter((h) => h.estado === '🟡').length
              const cuentaNoCumple = items.filter((h) => h.estado === '🔴').length
              const cuentaPendiente = items.filter((h) => h.estado === '⚪').length
              const enTrabajo = items.filter((h) => h.estadoTrabajo === 'en_progreso').length
              const resueltos = items.filter((h) => h.estadoTrabajo === 'resuelto').length

              return (
                <Card
                  key={nivel}
                  className={cn(
                    'glass-card border-l-4 cursor-pointer transition-all hover:shadow-lg',
                    cfg.borderClass,
                    cfg.bgClass,
                    expandido && 'ring-2 ring-primary/30',
                  )}
                  onClick={() => toggleNivel(nivel)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icono className="w-4 h-4" style={{ color: cfg.color }} />
                        {cfg.label}
                      </CardTitle>
                      {expandido ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Total del nivel */}
                    <div className="text-3xl font-bold" style={{ color: cfg.color }}>
                      {items.length}
                      <span className="text-xs text-muted-foreground font-normal ml-1">controles</span>
                    </div>

                    {/* Distribución de estados de control */}
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                        <span className="text-muted-foreground">Cumple:</span>
                        <span className="font-semibold">{cuentaCumple}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-amber-500" />
                        <span className="text-muted-foreground">Parcial:</span>
                        <span className="font-semibold">{cuentaParcial}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-red-500" />
                        <span className="text-muted-foreground">No:</span>
                        <span className="font-semibold">{cuentaNoCumple}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-slate-500" />
                        <span className="text-muted-foreground">Pend:</span>
                        <span className="font-semibold">{cuentaPendiente}</span>
                      </div>
                    </div>

                    {/* Estados de acción */}
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                      {enTrabajo > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5 bg-indigo-500/15 text-indigo-300 border-indigo-400/40">
                          <Activity className="w-2.5 h-2.5 mr-1" />
                          {enTrabajo} en trabajo
                        </Badge>
                      )}
                      {resueltos > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5 bg-emerald-500/15 text-emerald-300 border-emerald-400/40">
                          <CheckCircle className="w-2.5 h-2.5 mr-1" />
                          {resueltos} resueltos
                        </Badge>
                      )}
                    </div>

                    {/* Botón para trabajar TODO el nivel */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[11px] mt-1"
                      disabled={actualizandoId === `nivel-${nivel}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        accionPorNivel(nivel)
                      }}
                    >
                      {actualizandoId === `nivel-${nivel}` ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Users className="w-3 h-3 mr-1" />
                      )}
                      Trabajar nivel {cfg.label}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
        </div>

        {/* ====== DETALLE EXPANDIDO DEL NIVEL SELECCIONADO ====== */}
        {nivelExpandido && porNivel[nivelExpandido] && (
          <Card className="glass-card mt-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {(() => {
                  const cfg = getNivelConfig(nivelExpandido)
                  const Icono = cfg.icon
                  return (
                    <>
                      <Icono className="w-4 h-4" style={{ color: cfg.color }} />
                      Detalle · Nivel {cfg.label} · {porNivel[nivelExpandido].length} controles
                    </>
                  )
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {porNivel[nivelExpandido].map((h) => (
                <HallazgoDetalle
                  key={h.control}
                  hallazgo={h}
                  actualizando={actualizandoId === h.control}
                  onAccion={(accion) => accionHallazgo(h.control, h.nivelRiesgo || h.riesgo || 'Bajo', accion)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// =====================================================
// SUBCOMPONENTE: KPI Card
// =====================================================

interface KpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: string
}

function KpiCard({ label, value, icon: Icono, color }: KpiCardProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
          <Icono className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-2xl font-bold" style={{ color }}>
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

// =====================================================
// SUBCOMPONENTE: Detalle de un hallazgo individual
// =====================================================

interface HallazgoDetalleProps {
  hallazgo: Hallazgo
  actualizando: boolean
  onAccion: (accion: 'seleccionar' | 'resolver' | 'descartar') => void
}

function HallazgoDetalle({ hallazgo, actualizando, onAccion }: HallazgoDetalleProps) {
  const [expandido, setExpandido] = useState(false)
  const estadoCtrl = getEstadoControlConfig(hallazgo.estado)
  const estadoAcc = getEstadoAccionConfig(hallazgo.estadoTrabajo)
  const IconoEstadoAccion = estadoAcc.icon

  return (
    <div className="rounded-md border border-white/10 bg-white/5 overflow-hidden">
      {/* Cabecera clickeable */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
      >
        <span className="text-xl">{hallazgo.estado}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{hallazgo.control}</span>
            <Badge variant="outline" className={cn('text-[10px] py-0 h-5', estadoCtrl.bgClass, estadoCtrl.textClass, 'border-current/30')}>
              {estadoCtrl.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] py-0 h-5', estadoAcc.badgeClass)}>
              <IconoEstadoAccion className="w-2.5 h-2.5 mr-1" />
              {estadoAcc.label}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {hallazgo.prioridad}
          </p>
        </div>
        {expandido ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Detalle */}
      {expandido && (
        <div className="p-3 pt-0 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-muted-foreground mb-0.5">Evidencia</p>
            <p className="text-foreground/90">{hallazgo.evidencia}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground mb-0.5">Explicación</p>
            <p className="text-foreground/90">{hallazgo.explicacion}</p>
          </div>
          <div className="p-2 rounded-md bg-red-500/5 border border-red-500/20">
            <p className="font-semibold text-red-300 mb-0.5">⚠️ Escenario de riesgo</p>
            <p className="text-foreground/90">{hallazgo.escenario}</p>
          </div>
          <div className="p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
            <p className="font-semibold text-emerald-300 mb-0.5">✓ Recomendación</p>
            <p className="text-foreground/90">{hallazgo.recomendacion}</p>
          </div>

          {/* Acciones manuales — NO auto-arreglar */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Acciones manuales
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] bg-indigo-500/10 text-indigo-300 border-indigo-400/40 hover:bg-indigo-500/20"
                disabled={actualizando || hallazgo.estadoTrabajo === 'en_progreso' || hallazgo.estadoTrabajo === 'resuelto'}
                onClick={() => onAccion('seleccionar')}
              >
                {actualizando ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Activity className="w-3 h-3 mr-1" />}
                Iniciar trabajo
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] bg-emerald-500/10 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/20"
                disabled={actualizando || hallazgo.estadoTrabajo === 'resuelto'}
                onClick={() => onAccion('resolver')}
              >
                {actualizando ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                Marcar resuelto
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] bg-white/5 text-muted-foreground border-white/20 hover:bg-white/10"
                disabled={actualizando}
                onClick={() => onAccion('descartar')}
              >
                {actualizando ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <CircleSlash className="w-3 h-3 mr-1" />}
                Descartar
              </Button>
            </div>
            {hallazgo.asignadoA && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Asignado a: <strong className="text-foreground">{hallazgo.asignadoA}</strong>
                {hallazgo.fechaAsignacion && ` · ${new Date(hallazgo.fechaAsignacion).toLocaleString('es-CO')}`}
              </p>
            )}
            {hallazgo.notasTrabajo && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Nota: {hallazgo.notasTrabajo}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
