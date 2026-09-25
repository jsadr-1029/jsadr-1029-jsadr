'use client'

// =====================================================
// Vista: Créditos — Neobanco Glass
// Lista de préstamos con detalle expandible, filtros
// por estado (tabs pill). Estilo Revolut "Cards list".
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  GlassButton,
  Chip,
  SegmentedControl,
  EmptyState,
  Skeleton,
  Sheet,
} from '../ui'
import {
  formatCOP,
  formatFechaCorta,
  estadoPrestamoTono,
  estadoPrestamoLabel,
  type NbEstado,
  type NbPrestamo,
} from '../useNeobancoPortal'
import { RenovacionSheet } from './RenovacionSheet'
import { Landmark, ChevronRight, FileText, Download, Calendar, TrendingUp, RefreshCw } from 'lucide-react'

type CreditosViewProps = {
  estado: NbEstado | null
  cargando: boolean
  onAbrirEstadoCuenta: (prestamoId: string) => void
  token?: string | null
}

type Filtro = 'activos' | 'cancelados' | 'todos'

export function CreditosView({ estado, cargando, onAbrirEstadoCuenta, token }: CreditosViewProps) {
  const [filtro, setFiltro] = React.useState<Filtro>('activos')
  const [seleccionado, setSeleccionado] = React.useState<NbPrestamo | null>(null)
  const [renovar, setRenovar] = React.useState<NbPrestamo | null>(null)

  const prestamos = estado?.prestamos ?? []
  const filtrados = React.useMemo(() => {
    if (filtro === 'activos') {
      return prestamos.filter(
        (p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION',
      )
    }
    if (filtro === 'cancelados') {
      return prestamos.filter((p) => p.estado === 'CANCELADO' || p.estado === 'JURIDICO')
    }
    return prestamos
  }, [prestamos, filtro])

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-[24px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Mis Créditos
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          {prestamos.length} en total · {prestamos.filter((p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA').length} activos
        </p>
      </header>

      <SegmentedControl<Filtro>
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'activos', label: 'Activos' },
          { value: 'cancelados', label: 'Históricos' },
          { value: 'todos', label: 'Todos' },
        ]}
        className="w-full"
      />

      {filtrados.length === 0 ? (
        <GlassCard radius="lg">
          <EmptyState
            icon={<Landmark size={24} />}
            title="Sin créditos en esta categoría"
            description="Cuando tengas créditos en este estado, aparecerán aquí para que puedas ver su detalle y descargar documentos."
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((p) => {
            const total = Number(p.montoPrincipal) + Number(p.totalInteres)
            const pct = total > 0 ? (Number(p.montoPagado) / total) * 100 : 0
            const cuotasPagadas = p.pagos?.filter((pg) => pg.estado === 'PAGADO').length ?? 0
            return (
              <GlassCard key={p.id} interactive radius="lg" onClick={() => setSeleccionado(p)}>
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[var(--nb-fg)]">
                          {p.codigo}
                        </span>
                        <Chip tone={estadoPrestamoTono(p.estado)} size="sm">
                          {estadoPrestamoLabel(p.estado)}
                        </Chip>
                      </div>
                      <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5">
                        Desde {formatFechaCorta(p.fechaDesembolso || p.fechaAceptacion)} ·{' '}
                        {p.frecuencia || 'MENSUAL'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[var(--nb-fg-subtle)] mt-1" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                        Saldo
                      </p>
                      <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                        {formatCOP(p.saldoTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                        Cuota
                      </p>
                      <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                        {formatCOP(p.montoCuota)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                        Cuotas
                      </p>
                      <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                        {cuotasPagadas}/{p.plazoMeses}
                      </p>
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full bg-[var(--nb-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--nb-gradient-brand)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--nb-fg-muted)] font-medium">
                      Pagado: {formatCOP(p.montoPagado)}
                    </span>
                    <span className="text-[var(--nb-primary)] font-bold">
                      {Math.round(pct)}%
                    </span>
                  </div>

                  {/* Botón Solicitar renovación — solo para préstamos ACTIVO o EN_MORA */}
                  {(p.estado === 'ACTIVO' || p.estado === 'EN_MORA') && token && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenovar(p)
                      }}
                      className="nb-press w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--nb-primary-soft)] border border-[var(--nb-primary)]/20 text-[var(--nb-primary)] hover:border-[var(--nb-primary)]/40 transition-colors text-[12px] font-bold"
                    >
                      <RefreshCw size={13} />
                      Solicitar renovación
                    </button>
                  )}
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Sheet detalle */}
      <Sheet
        open={!!seleccionado}
        onClose={() => setSeleccionado(null)}
        title={seleccionado?.codigo}
      >
        {seleccionado && (
          <DetalleCredito
            prestamo={seleccionado}
            onAbrirEstado={() => {
              if (seleccionado) onAbrirEstadoCuenta(seleccionado.id)
              setSeleccionado(null)
            }}
            onRenovar={
              seleccionado.estado === 'ACTIVO' || seleccionado.estado === 'EN_MORA'
                ? () => {
                    setRenovar(seleccionado)
                    setSeleccionado(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>

      {/* Sheet renovación */}
      <RenovacionSheet
        open={!!renovar}
        onClose={() => setRenovar(null)}
        prestamo={renovar}
        token={token || null}
      />
    </div>
  )
}

function DetalleCredito({
  prestamo,
  onAbrirEstado,
  onRenovar,
}: {
  prestamo: NbPrestamo
  onAbrirEstado: () => void
  onRenovar?: () => void
}) {
  const total = Number(prestamo.montoPrincipal) + Number(prestamo.totalInteres)
  const pct = total > 0 ? (Number(prestamo.montoPagado) / total) * 100 : 0
  const pagos = prestamo.pagos ?? []

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Monto original" value={formatCOP(prestamo.montoPrincipal)} />
        <Stat label="Interés total" value={formatCOP(prestamo.totalInteres)} />
        <Stat label="Pagado" value={formatCOP(prestamo.montoPagado)} tone="success" />
        <Stat label="Saldo" value={formatCOP(prestamo.saldoTotal)} tone="brand" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)]">
            Avance del crédito
          </span>
          <span className="text-[12px] font-bold text-[var(--nb-primary)]">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--nb-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--nb-gradient-brand)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <InfoRow icon={<Calendar size={14} />} label="Plazo" value={`${prestamo.plazoMeses} cuotas`} />
        <InfoRow icon={<TrendingUp size={14} />} label="Frecuencia" value={prestamo.frecuencia || 'MENSUAL'} />
        <InfoRow icon={<FileText size={14} />} label="Cuotas pagadas" value={`${pagos.filter((p) => p.estado === 'PAGADO').length}/${prestamo.plazoMeses}`} />
        <InfoRow
          icon={<Landmark size={14} />}
          label="Estado"
          value={estadoPrestamoLabel(prestamo.estado)}
        />
      </div>

      {prestamo.flexibilidadFinanciera && (
        <GlassCard radius="md" variant="soft">
          <div className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[var(--nb-fg)]">
                Flexibilidad Financiera {prestamo.flexibilidadModalidad === 'PREMIUM' ? 'PREMIUM' : 'BÁSICA'}
              </p>
              <p className="text-[12px] text-[var(--nb-fg-muted)]">
                {prestamo.flexibilidadUsosDisponibles ?? 0} usos disponibles
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="flex flex-col gap-2">
        <GlassButton
          fullWidth
          variant="primary"
          size="lg"
          iconLeft={<FileText size={16} />}
          onClick={onAbrirEstado}
        >
          Ver estado de cuenta
        </GlassButton>
        {(prestamo.estado === 'ACTIVO' || prestamo.estado === 'EN_MORA') && onRenovar && (
          <GlassButton
            fullWidth
            variant="secondary"
            size="md"
            iconLeft={<RefreshCw size={14} />}
            onClick={onRenovar}
          >
            Solicitar renovación
          </GlassButton>
        )}
        <GlassButton
          fullWidth
          variant="ghost"
          size="md"
          iconLeft={<Download size={14} />}
          onClick={() => window.open(`/api/paz-y-salvo?prestamo=${prestamo.id}`, '_blank')}
        >
          Descargar paz y salvo (PDF)
        </GlassButton>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'success' | 'brand'
}) {
  const color =
    tone === 'success'
      ? 'text-[var(--nb-success)]'
      : tone === 'brand'
        ? 'text-[var(--nb-primary)]'
        : 'text-[var(--nb-fg)]'
  return (
    <GlassCard radius="md" variant="soft">
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
          {label}
        </p>
        <p className={`text-[15px] font-bold nb-tabular mt-0.5 ${color}`}>{value}</p>
      </div>
    </GlassCard>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)]">
      <span className="text-[var(--nb-fg-muted)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
          {label}
        </p>
        <p className="text-[13px] font-semibold text-[var(--nb-fg)] truncate">{value}</p>
      </div>
    </div>
  )
}
