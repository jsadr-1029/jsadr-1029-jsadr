'use client'

// =====================================================
// Vista: Próximos Pagos — Neobanco Glass
// Lista ordenada por fecha, destacando mora y vencimientos
// cercanos. Incluye cuenta de recaudo para pago manual.
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  GlassButton,
  Chip,
  EmptyState,
  Skeleton,
  Sheet,
  ListRow,
} from '../ui'
import {
  formatCOP,
  formatFechaCorta,
  formatFechaRelativa,
  diasEntre,
  type NbEstado,
  type NbProximoVencimiento,
} from '../useNeobancoPortal'
import { CalendarClock, AlertTriangle, Landmark, Copy, CheckCircle2, Building2, User } from 'lucide-react'

type ProximosPagosViewProps = {
  estado: NbEstado | null
  cargando: boolean
}

export function ProximosPagosView({ estado, cargando }: ProximosPagosViewProps) {
  const [detalle, setDetalle] = React.useState<NbProximoVencimiento | null>(null)
  const vencimientos = estado?.proximosVencimientos ?? []
  const cuenta = estado?.cuentaRecaudoPrincipal

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[24px]" />
        ))}
      </div>
    )
  }

  // Separar en mora vs próximos
  const enMora = vencimientos.filter((v) => (diasEntre(v.fechaVencimiento) ?? 0) < 0)
  const proximos = vencimientos.filter((v) => (diasEntre(v.fechaVencimiento) ?? 0) >= 0)

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Próximos Pagos
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          {vencimientos.length} cuota(s) pendiente(s) · {enMora.length} en mora
        </p>
      </header>

      {/* Alerta de mora */}
      {enMora.length > 0 && (
        <GlassCard radius="lg">
          <div className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--nb-danger-soft)] text-[var(--nb-danger)] flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[var(--nb-fg)]">
                Tienes {enMora.length} pago(s) en mora
              </p>
              <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5 leading-relaxed">
                Comunícate con tu asesor para regularizar tu situación y evitar reportes
                negativos en centrales de riesgo.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Lista en mora */}
      {enMora.length > 0 && (
        <section>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--nb-danger)] mb-2 px-1">
            En mora
          </h2>
          <div className="flex flex-col gap-2.5">
            {enMora.map((v) => (
              <VencimientoCard key={v.prestamoId + v.numeroCuota} v={v} onClick={() => setDetalle(v)} />
            ))}
          </div>
        </section>
      )}

      {/* Lista próximos */}
      <section>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--nb-fg-muted)] mb-2 px-1">
          {enMora.length > 0 ? 'Próximos vencimientos' : 'Tus cuotas pendientes'}
        </h2>
        {proximos.length === 0 && enMora.length === 0 ? (
          <GlassCard radius="lg">
            <EmptyState
              icon={<CheckCircle2 size={24} />}
              title="¡Estás al día!"
              description="No tienes cuotas pendientes. Te avisaremos cuando se acerque tu próximo vencimiento."
            />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2.5">
            {proximos.map((v) => (
              <VencimientoCard key={v.prestamoId + v.numeroCuota} v={v} onClick={() => setDetalle(v)} />
            ))}
          </div>
        )}
      </section>

      {/* Cuenta de recaudo */}
      {cuenta && (
        <section>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--nb-fg-muted)] mb-2 px-1">
            Cuenta para pago
          </h2>
          <GlassCard radius="lg">
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-[var(--nb-fg-muted)]" />
                <span className="text-[14px] font-bold text-[var(--nb-fg)]">{cuenta.banco}</span>
                <Chip tone="brand" size="sm">{cuenta.tipoCuenta}</Chip>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <CopyRow icon={<Landmark size={13} />} label="Número de cuenta" value={cuenta.numeroCuenta} />
                <CopyRow icon={<User size={13} />} label="Titular" value={cuenta.titular} />
              </div>
              <p className="text-[11px] text-[var(--nb-fg-subtle)] leading-relaxed">
                {cuenta.nombreCuenta || 'Cuenta de recaudo principal'}
              </p>
            </div>
          </GlassCard>
        </section>
      )}

      {/* Sheet detalle de cuota */}
      <Sheet open={!!detalle} onClose={() => setDetalle(null)} title="Detalle de la cuota">
        {detalle && <DetalleCuota venc={detalle} cuenta={cuenta} />}
      </Sheet>
    </div>
  )
}

function VencimientoCard({
  v,
  onClick,
}: {
  v: NbProximoVencimiento
  onClick: () => void
}) {
  const dias = diasEntre(v.fechaVencimiento) ?? 0
  const enMora = dias < 0
  const urgente = !enMora && dias <= 3

  return (
    <GlassCard interactive radius="lg" onClick={onClick}>
      <div className="p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0"
          style={{
            background: enMora
              ? 'var(--nb-danger-soft)'
              : urgente
                ? 'var(--nb-warning-soft)'
                : 'var(--nb-primary-soft)',
            color: enMora
              ? 'var(--nb-danger)'
              : urgente
                ? 'var(--nb-warning)'
                : 'var(--nb-primary)',
          }}
        >
          <CalendarClock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-[var(--nb-fg)] nb-tabular">
              {formatCOP(v.montoCuota)}
            </span>
            <Chip tone={enMora ? 'danger' : urgente ? 'warning' : 'neutral'} size="sm">
              {enMora ? `Mora ${Math.abs(dias)}d` : formatFechaRelativa(v.fechaVencimiento)}
            </Chip>
          </div>
          <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5 truncate">
            Cuota {v.numeroCuota} · {v.prestamoCodigo} · vence {formatFechaCorta(v.fechaVencimiento)}
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

function CopyRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      onClick={copy}
      className="nb-press flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] hover:border-[var(--nb-border-strong)] transition-colors w-full text-left"
    >
      <span className="text-[var(--nb-fg-muted)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
          {label}
        </p>
        <p className="text-[13px] font-semibold text-[var(--nb-fg)] truncate nb-tabular">{value}</p>
      </div>
      {copied ? (
        <CheckCircle2 size={14} className="text-[var(--nb-success)]" />
      ) : (
        <Copy size={14} className="text-[var(--nb-fg-subtle)]" />
      )}
    </button>
  )
}

function DetalleCuota({
  venc,
  cuenta,
}: {
  venc: NbProximoVencimiento
  cuenta: NbEstado['cuentaRecaudoPrincipal']
}) {
  const dias = diasEntre(venc.fechaVencimiento) ?? 0
  const enMora = dias < 0

  return (
    <div className="flex flex-col gap-4 pb-4">
      <GlassCard radius="lg">
        <div className="p-4 flex flex-col items-center text-center">
          <Chip tone={enMora ? 'danger' : 'brand'} size="md">
            {enMora ? `Mora ${Math.abs(dias)} días` : formatFechaRelativa(venc.fechaVencimiento)}
          </Chip>
          <p className="text-[32px] font-extrabold text-[var(--nb-fg)] nb-tabular mt-2">
            {formatCOP(venc.montoCuota)}
          </p>
          <p className="text-[13px] text-[var(--nb-fg-muted)] mt-1">
            Cuota {venc.numeroCuota} de {venc.prestamoCodigo}
          </p>
          <p className="text-[12px] text-[var(--nb-fg-subtle)] mt-1">
            Vence el {formatFechaCorta(venc.fechaVencimiento)}
          </p>
        </div>
      </GlassCard>

      <div>
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 px-1">
          Cómo pagar
        </h3>
        <div className="flex flex-col gap-2">
          <ListRow
            leading={<Building2 size={16} />}
            title="Transferencia bancaria"
            subtitle={cuenta ? `${cuenta.banco} · ${cuenta.tipoCuenta}` : 'Sin cuenta configurada'}
            trailing={<Copy size={14} />}
            onClick={() => cuenta && navigator.clipboard.writeText(cuenta.numeroCuenta)}
          />
          {cuenta && (
            <GlassCard radius="md" variant="soft">
              <div className="p-3.5 flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                  Datos de la cuenta
                </p>
                <CopyRow icon={<Landmark size={13} />} label="Número" value={cuenta.numeroCuenta} />
                <CopyRow icon={<User size={13} />} label="Titular" value={cuenta.titular} />
                <CopyRow icon={<Building2 size={13} />} label="Banco" value={cuenta.banco} />
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <GlassButton fullWidth variant="primary" size="lg" onClick={() => window.open(`https://wa.me/573000000000?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20mi%20cuota%20${venc.numeroCuota}%20del%20pr%C3%A9stamo%20${venc.prestamoCodigo}`, '_blank')}>
        Hablar con mi asesor
      </GlassButton>
    </div>
  )
}
