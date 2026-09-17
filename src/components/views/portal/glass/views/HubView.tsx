'use client'

// =====================================================
// Vista: Hub (dashboard) — Neobanco Glass
// Estilo Revolut: hero card con saldo, accesos rápidos,
// próxima cuota destacada, mini gráfica de avance.
// =====================================================

import * as React from 'react'
import { GlassCard, GlassButton, ProgressRing, Chip, SectionHeader, Skeleton } from '../ui'
import {
  formatCOP,
  formatFechaRelativa,
  diasEntre,
  estadoPrestamoTono,
  estadoPrestamoLabel,
  type NbEstado,
} from '../useNeobancoPortal'
import { ArrowUpRight, Bell, CalendarClock, Sparkles, TrendingUp, Wallet, Plus, ChevronRight } from 'lucide-react'

type HubViewProps = {
  estado: NbEstado | null
  cargando: boolean
  avisosNoLeidos: number
  onIrA: (v: string) => void
}

export function HubView({ estado, cargando, avisosNoLeidos, onIrA }: HubViewProps) {
  const cliente = estado?.cliente
  const resumen = estado?.resumen
  const proxVenc = estado?.proximosVencimientos?.[0]
  const prestamosActivos = estado?.prestamos?.filter(
    (p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA',
  )

  const saldoPendiente = resumen?.saldoTotalActivos ?? 0
  const totalPagado = resumen?.totalPagado ?? 0
  const avancePct =
    prestamosActivos && prestamosActivos.length > 0
      ? prestamosActivos.reduce((s, p) => {
          const total = Number(p.montoPrincipal) + Number(p.totalInteres)
          if (total <= 0) return s
          return s + (Number(p.montoPagado) / total) * 100
        }, 0) / prestamosActivos.length
      : 0

  const diasProx = diasEntre(proxVenc?.fechaVencimiento)

  const primerNombre = (cliente?.nombre || '').split(' ')[0] || 'Hola'

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Saludo + fecha */}
      <header className="px-1 flex items-center justify-between">
        <div>
          <p className="text-[12px] text-[var(--nb-fg-muted)] font-medium">
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em] mt-0.5">
            Hola, <span className="nb-gradient-text">{primerNombre}</span>
          </h1>
        </div>
        <button
          onClick={() => onIrA('avisos')}
          aria-label="Ver avisos"
          className="nb-press relative w-11 h-11 rounded-2xl nb-glass flex items-center justify-center text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)]"
        >
          <Bell size={18} />
          {avisosNoLeidos > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--nb-danger)] text-white text-[10px] font-bold flex items-center justify-center">
              {avisosNoLeidos > 9 ? '9+' : avisosNoLeidos}
            </span>
          )}
        </button>
      </header>

      {/* HERO: saldo pendiente + avance */}
      <GlassCard variant="elevated" radius="xl" className="overflow-hidden">
        {/* Capa de aura */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90 pointer-events-none"
          style={{ background: 'var(--nb-gradient-aurora)' }}
        />
        <div className="relative z-10 p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--nb-fg-muted)]">
                Saldo pendiente
              </p>
              {cargando ? (
                <Skeleton className="h-9 w-44 mt-2" />
              ) : (
                <p className="text-[34px] font-extrabold text-[var(--nb-fg)] tracking-[-0.025em] nb-tabular mt-1">
                  {formatCOP(saldoPendiente)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <Chip tone="brand" size="sm">
                  <Wallet size={11} />
                  {resumen?.prestamosActivos ?? 0} créditos activos
                </Chip>
              </div>
            </div>
            <ProgressRing
              value={avancePct}
              tone={avancePct >= 70 ? 'success' : 'brand'}
              label="Avance"
              size={72}
              stroke={7}
            />
          </div>

          {/* Accesos rápidos */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: 'simulador', label: 'Simular', icon: <Sparkles size={16} /> },
              { v: 'solicitudes', label: 'Pedir', icon: <Plus size={16} /> },
              { v: 'proximos-pagos', label: 'Pagar', icon: <CalendarClock size={16} /> },
              { v: 'historial', label: 'Historial', icon: <TrendingUp size={16} /> },
            ].map((q) => (
              <button
                key={q.v}
                onClick={() => onIrA(q.v)}
                className="nb-press flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] hover:border-[var(--nb-border-strong)] transition-colors"
              >
                <span className="w-9 h-9 rounded-xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center">
                  {q.icon}
                </span>
                <span className="text-[11px] font-semibold text-[var(--nb-fg)]">{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* PRÓXIMO PAGO */}
      <section>
        <SectionHeader
          title="Próximo pago"
          action={
            <button
              onClick={() => onIrA('proximos-pagos')}
              className="text-[12px] font-semibold text-[var(--nb-primary)] hover:underline flex items-center gap-0.5"
            >
              Ver todos <ChevronRight size={12} />
            </button>
          }
        />
        {cargando ? (
          <Skeleton className="h-28 w-full rounded-[24px]" />
        ) : proxVenc ? (
          <GlassCard interactive radius="lg" onClick={() => onIrA('proximos-pagos')}>
            <div className="p-4 flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    diasProx !== null && diasProx < 0
                      ? 'var(--nb-danger-soft)'
                      : diasProx !== null && diasProx <= 3
                        ? 'var(--nb-warning-soft)'
                        : 'var(--nb-primary-soft)',
                  color:
                    diasProx !== null && diasProx < 0
                      ? 'var(--nb-danger)'
                      : diasProx !== null && diasProx <= 3
                        ? 'var(--nb-warning)'
                        : 'var(--nb-primary)',
                }}
              >
                <CalendarClock size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {formatCOP(proxVenc.montoCuota)}
                  </span>
                  <Chip
                    tone={
                      diasProx !== null && diasProx < 0
                        ? 'danger'
                        : diasProx !== null && diasProx <= 3
                          ? 'warning'
                          : 'neutral'
                    }
                    size="sm"
                  >
                    {diasProx !== null && diasProx < 0
                      ? `Mora ${Math.abs(diasProx)}d`
                      : formatFechaRelativa(proxVenc.fechaVencimiento)}
                  </Chip>
                </div>
                <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5 truncate">
                  Cuota {proxVenc.numeroCuota} · {proxVenc.prestamoCodigo}
                </p>
              </div>
              <GlassButton size="sm" variant="primary" onClick={() => onIrA('proximos-pagos')}>
                Pagar
              </GlassButton>
            </div>
          </GlassCard>
        ) : (
          <GlassCard radius="lg">
            <div className="p-6 text-center">
              <p className="text-[13px] text-[var(--nb-fg-muted)]">
                No tienes pagos pendientes 🎉
              </p>
            </div>
          </GlassCard>
        )}
      </section>

      {/* MIS CRÉDITOS */}
      <section>
        <SectionHeader
          title="Mis créditos"
          action={
            <button
              onClick={() => onIrA('creditos')}
              className="text-[12px] font-semibold text-[var(--nb-primary)] hover:underline flex items-center gap-0.5"
            >
              Ver todos <ChevronRight size={12} />
            </button>
          }
        />
        {cargando ? (
          <Skeleton className="h-32 w-full rounded-[24px]" />
        ) : prestamosActivos && prestamosActivos.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {prestamosActivos.slice(0, 2).map((p) => {
              const total = Number(p.montoPrincipal) + Number(p.totalInteres)
              const pct = total > 0 ? (Number(p.montoPagado) / total) * 100 : 0
              return (
                <GlassCard key={p.id} interactive radius="lg" onClick={() => onIrA('creditos')}>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[var(--nb-fg)]">
                          {p.codigo}
                        </span>
                        <Chip tone={estadoPrestamoTono(p.estado)} size="sm">
                          {estadoPrestamoLabel(p.estado)}
                        </Chip>
                      </div>
                      <span className="text-[11px] text-[var(--nb-fg-subtle)]">
                        {p.plazoMeses} cuotas
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[11px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                          Saldo
                        </p>
                        <p className="text-[18px] font-bold text-[var(--nb-fg)] nb-tabular">
                          {formatCOP(p.saldoTotal)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold">
                          Cuota
                        </p>
                        <p className="text-[14px] font-semibold text-[var(--nb-fg-muted)] nb-tabular">
                          {formatCOP(p.montoCuota)}
                        </p>
                      </div>
                    </div>
                    {/* Barra de avance */}
                    <div className="h-1.5 rounded-full bg-[var(--nb-surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--nb-gradient-brand)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        ) : (
          <GlassCard radius="lg">
            <div className="p-6 text-center">
              <p className="text-[13px] text-[var(--nb-fg-muted)] mb-3">
                Aún no tienes créditos activos
              </p>
              <GlassButton
                size="sm"
                variant="primary"
                iconLeft={<Plus size={14} />}
                onClick={() => onIrA('simulador')}
              >
                Simular primer crédito
              </GlassButton>
            </div>
          </GlassCard>
        )}
      </section>

      {/* RESUMEN FINANCIERO */}
      <section>
        <SectionHeader title="Tu actividad" />
        <div className="grid grid-cols-2 gap-2.5">
          <GlassCard radius="md">
            <div className="p-3.5 flex flex-col gap-1">
              <div className="w-8 h-8 rounded-lg bg-[var(--nb-success-soft)] text-[var(--nb-success)] flex items-center justify-center">
                <ArrowUpRight size={14} />
              </div>
              <p className="text-[11px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold mt-1">
                Total pagado
              </p>
              <p className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
                {formatCOP(totalPagado)}
              </p>
            </div>
          </GlassCard>
          <GlassCard radius="md">
            <div className="p-3.5 flex flex-col gap-1">
              <div className="w-8 h-8 rounded-lg bg-[var(--nb-info-soft)] text-[var(--nb-info)] flex items-center justify-center">
                <Wallet size={14} />
              </div>
              <p className="text-[11px] text-[var(--nb-fg-subtle)] uppercase tracking-wide font-semibold mt-1">
                Total créditos
              </p>
              <p className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
                {resumen?.totalPrestamos ?? 0}
              </p>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  )
}
