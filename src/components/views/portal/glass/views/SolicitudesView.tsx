'use client'

// =====================================================
// Vista: Solicitudes — Neobanco Glass
// Lista de solicitudes de crédito enviadas + estado del flujo
// (Pendiente, En revisión, Aprobada, Rechazada).
// Permite crear nueva solicitud.
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  GlassButton,
  Chip,
  EmptyState,
  Skeleton,
  Sheet,
  GlassInput,
  SegmentedControl,
} from '../ui'
import { formatCOP, formatFechaCorta } from '../useNeobancoPortal'
import { useNbToast } from '../ui'
import { FileText, Clock, CheckCircle2, XCircle, Plus, FileCheck, Loader2 } from 'lucide-react'

type SolicitudEstado = 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'COMPLETADA'

type Solicitud = {
  id: string
  codigo?: string
  estado: SolicitudEstado
  montoSolicitado: number
  plazoMeses: number
  frecuencia: string
  flexibilidadFinanciera?: boolean
  createdAt: string
  notasCliente?: string
}

type SolicitudesViewProps = {
  token: string | null
  cedula: string | null
  onSolicitudCreada?: () => void
}

export function SolicitudesView({ token, cedula, onSolicitudCreada }: SolicitudesViewProps) {
  const toast = useNbToast()
  const [solicitudes, setSolicitudes] = React.useState<Solicitud[]>([])
  const [cargando, setCargando] = React.useState(true)
  const [verNueva, setVerNueva] = React.useState(false)
  const [creando, setCreando] = React.useState(false)

  const cargar = React.useCallback(async () => {
    if (!token || !cedula) return
    setCargando(true)
    try {
      const res = await fetch(`/api/solicitudes-web?cedula=${encodeURIComponent(cedula)}`, {
        headers: token ? { 'x-portal-token': token } : {},
      })
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        setSolicitudes(data.data)
      } else if (Array.isArray(data)) {
        setSolicitudes(data)
      }
    } catch {
      /* no crítico */
    } finally {
      setCargando(false)
    }
  }, [token, cedula])

  React.useEffect(() => {
    cargar()
  }, [cargar])

  const crear = async (payload: {
    monto: number
    plazo: number
    frecuencia: string
    flexibilidad: 'ninguna' | 'basica' | 'premium'
    notas: string
  }) => {
    if (!token || !cedula) {
      toast.push('Sesión no disponible', 'danger')
      return
    }
    setCreando(true)
    try {
      const res = await fetch('/api/solicitudes-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula,
          montoSolicitado: payload.monto,
          plazoMeses: payload.plazo,
          frecuencia: payload.frecuencia,
          flexibilidadFinanciera: payload.flexibilidad !== 'ninguna',
          flexibilidadModalidad: payload.flexibilidad === 'ninguna' ? undefined : payload.flexibilidad.toUpperCase(),
          notasCliente: payload.notas,
          origen: 'PORTAL_NEOBANCO',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la solicitud')
      toast.push('Solicitud enviada con éxito', 'success')
      setVerNueva(false)
      await cargar()
      onSolicitudCreada?.()
    } catch (e: any) {
      toast.push(e.message || 'Error al crear solicitud', 'danger')
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
            Solicitudes
          </h1>
          <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
            {solicitudes.length} solicitud(es) enviada(s)
          </p>
        </div>
        <GlassButton size="sm" variant="primary" iconLeft={<Plus size={14} />} onClick={() => setVerNueva(true)}>
          Nueva
        </GlassButton>
      </header>

      {cargando ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
          ))}
        </div>
      ) : solicitudes.length === 0 ? (
        <GlassCard radius="lg">
          <EmptyState
            icon={<FileText size={24} />}
            title="Aún no tienes solicitudes"
            description="Crea tu primera solicitud de crédito desde el botón 'Nueva'. Te avisaremos cuando un asesor la revise."
            action={
              <GlassButton
                size="md"
                variant="primary"
                iconLeft={<Plus size={14} />}
                onClick={() => setVerNueva(true)}
              >
                Crear solicitud
              </GlassButton>
            }
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {solicitudes.map((s) => (
            <SolicitudCard key={s.id} solicitud={s} />
          ))}
        </div>
      )}

      <Sheet
        open={verNueva}
        onClose={() => !creando && setVerNueva(false)}
        title="Nueva solicitud"
      >
        <NuevaSolicitudForm onSubmit={crear} loading={creando} />
      </Sheet>
    </div>
  )
}

function SolicitudCard({ solicitud }: { solicitud: Solicitud }) {
  const config: Record<
    SolicitudEstado,
    { tone: 'neutral' | 'warning' | 'info' | 'success' | 'danger'; label: string; icon: React.ReactNode }
  > = {
    PENDIENTE: { tone: 'warning', label: 'Pendiente', icon: <Clock size={11} /> },
    EN_REVISION: { tone: 'info', label: 'En revisión', icon: <Loader2 size={11} className="animate-spin" /> },
    APROBADA: { tone: 'success', label: 'Aprobada', icon: <CheckCircle2 size={11} /> },
    RECHAZADA: { tone: 'danger', label: 'Rechazada', icon: <XCircle size={11} /> },
    COMPLETADA: { tone: 'success', label: 'Completada', icon: <FileCheck size={11} /> },
  }
  const c = config[solicitud.estado] || config.PENDIENTE
  return (
    <GlassCard radius="lg">
      <div className="p-4 flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-bold text-[var(--nb-fg)]">
              {solicitud.codigo || `Solicitud ${solicitud.id.slice(-6)}`}
            </p>
            <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-0.5">
              {formatFechaCorta(solicitud.createdAt)}
            </p>
          </div>
          <Chip tone={c.tone} size="sm">
            {c.icon}
            {c.label}
          </Chip>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
              Monto
            </p>
            <p className="text-[15px] font-bold text-[var(--nb-fg)] nb-tabular">
              {formatCOP(solicitud.montoSolicitado)}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
              Plazo
            </p>
            <p className="text-[14px] font-semibold text-[var(--nb-fg-muted)] nb-tabular">
              {solicitud.plazoMeses} · {solicitud.frecuencia?.toLowerCase() || 'mensual'}
            </p>
          </div>
          {solicitud.flexibilidadFinanciera && (
            <Chip tone="brand" size="sm">
              Flex
            </Chip>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

function NuevaSolicitudForm({
  onSubmit,
  loading,
}: {
  onSubmit: (p: {
    monto: number
    plazo: number
    frecuencia: string
    flexibilidad: 'ninguna' | 'basica' | 'premium'
    notas: string
  }) => void
  loading: boolean
}) {
  const [monto, setMonto] = React.useState(500000)
  const [plazo, setPlazo] = React.useState(6)
  const [frecuencia, setFrecuencia] = React.useState<'MENSUAL' | 'QUINCENAL' | 'SEMANAL'>('MENSUAL')
  const [flexibilidad, setFlexibilidad] = React.useState<'ninguna' | 'basica' | 'premium'>('ninguna')
  const [notas, setNotas] = React.useState('')

  return (
    <div className="flex flex-col gap-4 pb-4">
      <GlassInput
        label="Monto solicitado (COP)"
        type="number"
        value={monto}
        onChange={(e) => setMonto(Number(e.target.value) || 0)}
        min={100000}
        max={5000000}
        prefix="$"
        hint="Entre $100.000 y $5.000.000"
      />
      <GlassInput
        label="Plazo (meses)"
        type="number"
        value={plazo}
        onChange={(e) => setPlazo(Number(e.target.value) || 1)}
        min={1}
        max={24}
        suffix={plazo === 1 ? 'mes' : 'meses'}
      />
      <div>
        <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 block">
          Frecuencia
        </label>
        <SegmentedControl
          value={frecuencia}
          onChange={(v) => setFrecuencia(v)}
          options={[
            { value: 'MENSUAL', label: 'Mensual' },
            { value: 'QUINCENAL', label: 'Quincenal' },
            { value: 'SEMANAL', label: 'Semanal' },
          ]}
          size="sm"
          className="w-full"
        />
      </div>
      <div>
        <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 block">
          Flexibilidad
        </label>
        <SegmentedControl
          value={flexibilidad}
          onChange={(v) => setFlexibilidad(v)}
          options={[
            { value: 'ninguna', label: 'Ninguna' },
            { value: 'basica', label: 'Básica $15K' },
            { value: 'premium', label: 'Premium $35K' },
          ]}
          size="sm"
          className="w-full"
        />
      </div>
      <div>
        <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 block">
          Notas para tu asesor (opcional)
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Ej: el crédito es para gastos educativos..."
          className="w-full p-3 rounded-[14px] bg-[var(--nb-surface-2)] border border-[var(--nb-border)] text-[14px] text-[var(--nb-fg)] placeholder:text-[var(--nb-fg-subtle)] outline-none focus:border-[var(--nb-primary)] resize-none"
        />
      </div>
      <GlassButton
        fullWidth
        variant="primary"
        size="lg"
        loading={loading}
        onClick={() =>
          onSubmit({
            monto,
            plazo,
            frecuencia,
            flexibilidad,
            notas,
          })
        }
      >
        Enviar solicitud
      </GlassButton>
      <p className="text-[11px] text-[var(--nb-fg-subtle)] text-center leading-relaxed">
        Al enviar aceptas nuestros términos y condiciones. Un asesor revisará tu solicitud en menos de 24h.
      </p>
    </div>
  )
}
