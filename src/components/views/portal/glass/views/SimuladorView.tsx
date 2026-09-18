'use client'

// =====================================================
// Vista: Simulador — Neobanco Glass
// Slider de monto + plazo, resultado con cronograma,
// tarifa de plataforma obligatoria + flexibilidad opcional.
// =====================================================

import * as React from 'react'
import {
  GlassCard,
  GlassButton,
  Chip,
  Skeleton,
  Sheet,
  SegmentedControl,
  EmptyState,
} from '../ui'
import { formatCOP } from '../useNeobancoPortal'
import { useNbToast } from '../ui'
import { Sliders, Sparkles, Info, CalendarDays, TrendingUp, ChevronRight, ArrowRight } from 'lucide-react'

type SimuladorViewProps = {
  token: string | null
  onCrearSolicitud: () => void
}

type SimResult = {
  monto: number
  tasaMensual: number
  tasaAnual: number
  plazoMeses: number
  frecuencia: string
  cuotaFija: number
  totalPagar: number
  totalInteres: number
  cronograma: Array<{
    numero: number
    fecha: string
    capital: number
    interes: number
    total: number
    saldo: number
  }>
}

const MONTO_MIN = 100000
const MONTO_MAX = 5000000
const MONTO_STEP = 50000
const PLAZO_MIN = 1
const PLAZO_MAX = 24
const TARIFA_PLATAFORMA = 4900

export function SimuladorView({ token, onCrearSolicitud }: SimuladorViewProps) {
  const toast = useNbToast()
  const [monto, setMonto] = React.useState(500000)
  const [plazo, setPlazo] = React.useState(6)
  const [frecuencia, setFrecuencia] = React.useState<'MENSUAL' | 'QUINCENAL' | 'SEMANAL'>('MENSUAL')
  const [flexibilidad, setFlexibilidad] = React.useState<'ninguna' | 'basica' | 'premium'>('ninguna')
  const [resultado, setResultado] = React.useState<SimResult | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [verCronograma, setVerCronograma] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const cuotasSimuladas = React.useMemo(() => {
    if (frecuencia === 'QUINCENAL') return plazo * 2
    if (frecuencia === 'SEMANAL') return plazo * 4
    return plazo
  }, [frecuencia, plazo])

  const flexElegible = cuotasSimuladas >= 4
  const flexCosto = flexibilidad === 'basica' ? 15000 : flexibilidad === 'premium' ? 34900 : 0

  // === Disparar simulación al cambiar parámetros ===
  React.useEffect(() => {
    if (!token) return
    let active = true
    const debounce = setTimeout(async () => {
      setCargando(true)
      setError(null)
      try {
        const res = await fetch('/api/portal/simular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monto,
            plazoMeses: plazo,
            frecuencia,
            token,
            flexibilidadFinanciera: flexibilidad !== 'ninguna',
            flexibilidadModalidad: flexibilidad === 'ninguna' ? undefined : flexibilidad.toUpperCase(),
          }),
        })
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          setError(data.error || 'No se pudo simular')
          setResultado(null)
          return
        }
        const sim = data.simulacion || data
        setResultado({
          monto: Number(sim.monto ?? monto),
          tasaMensual: Number(sim.tasaMensual ?? 0),
          tasaAnual: Number(sim.tasaAnual ?? 0),
          plazoMeses: Number(sim.plazoMeses ?? plazo),
          frecuencia: sim.frecuencia ?? frecuencia,
          cuotaFija: Number(sim.cuotaFija ?? sim.cuota ?? 0),
          totalPagar: Number(sim.totalPagar ?? 0),
          totalInteres: Number(sim.totalInteres ?? 0),
          cronograma: data.cronograma ?? [],
        })
      } catch (e: any) {
        if (active) setError(e.message || 'Error de conexión')
      } finally {
        if (active) setCargando(false)
      }
    }, 350)
    return () => {
      active = false
      clearTimeout(debounce)
    }
  }, [monto, plazo, frecuencia, flexibilidad, token])

  const totalConCargos = (resultado?.totalPagar ?? 0) + TARIFA_PLATAFORMA + flexCosto
  const cuotaConCargoInicial =
    resultado && resultado.cronograma?.length > 0
      ? Number(resultado.cronograma[0].total) + TARIFA_PLATAFORMA + flexCosto
      : 0

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Simulador
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          Calcula tu cuota en tiempo real. Sin compromiso.
        </p>
      </header>

      {/* CONTROLES */}
      <GlassCard radius="lg">
        <div className="p-5 flex flex-col gap-5">
          {/* Monto */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)]">
                Monto del crédito
              </label>
              <span className="text-[18px] font-bold text-[var(--nb-fg)] nb-tabular">
                {formatCOP(monto)}
              </span>
            </div>
            <input
              type="range"
              min={MONTO_MIN}
              max={MONTO_MAX}
              step={MONTO_STEP}
              value={monto}
              onChange={(e) => setMonto(Number(e.target.value))}
              className="nb-range w-full"
              aria-label="Monto del crédito"
              style={
                {
                  '--nb-progress': `${((monto - MONTO_MIN) / (MONTO_MAX - MONTO_MIN)) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="flex justify-between text-[10px] text-[var(--nb-fg-subtle)] mt-1.5 nb-tabular">
              <span>{formatCOP(MONTO_MIN)}</span>
              <span>{formatCOP(MONTO_MAX)}</span>
            </div>
          </div>

          {/* Plazo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)]">
                Plazo
              </label>
              <span className="text-[18px] font-bold text-[var(--nb-fg)] nb-tabular">
                {plazo} {frecuencia === 'MENSUAL' ? 'meses' : frecuencia === 'QUINCENAL' ? 'quincenas' : 'semanas'}
              </span>
            </div>
            <input
              type="range"
              min={PLAZO_MIN}
              max={PLAZO_MAX}
              step={1}
              value={plazo}
              onChange={(e) => setPlazo(Number(e.target.value))}
              className="nb-range w-full"
              aria-label="Plazo"
              style={
                {
                  '--nb-progress': `${((plazo - PLAZO_MIN) / (PLAZO_MAX - PLAZO_MIN)) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="flex justify-between text-[10px] text-[var(--nb-fg-subtle)] mt-1.5">
              <span>{PLAZO_MIN}</span>
              <span>{PLAZO_MAX}</span>
            </div>
          </div>

          {/* Frecuencia */}
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 block">
              Frecuencia de pago
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

          {/* Flexibilidad financiera */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)]">
                Flexibilidad financiera
              </label>
              {!flexElegible && (
                <Chip tone="warning" size="sm">
                  Mín. 4 cuotas
                </Chip>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FlexOption
                active={flexibilidad === 'ninguna'}
                onClick={() => setFlexibilidad('ninguna')}
                title="Sin flexibilidad"
                subtitle="—"
              />
              <FlexOption
                active={flexibilidad === 'basica'}
                onClick={() => flexElegible && setFlexibilidad('basica')}
                title="Básica"
                subtitle="+ $15.000"
                disabled={!flexElegible}
                badge="1 uso"
              />
              <FlexOption
                active={flexibilidad === 'premium'}
                onClick={() => flexElegible && setFlexibilidad('premium')}
                title="Premium"
                subtitle="+ $34.900"
                disabled={!flexElegible}
                badge="2 usos"
              />
            </div>
            <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-2 leading-relaxed flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>
                Cambia la fecha de una cuota sin penalidad. Disponible solo para créditos con 4+ cuotas.
              </span>
            </p>
          </div>
        </div>
      </GlassCard>

      {/* RESULTADO */}
      {error ? (
        <GlassCard radius="lg">
          <EmptyState
            icon={<Info size={22} />}
            title="No pudimos simular"
            description={error}
          />
        </GlassCard>
      ) : cargando ? (
        <Skeleton className="h-44 w-full rounded-[24px]" />
      ) : resultado ? (
        <>
          <GlassCard variant="elevated" radius="xl">
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--nb-fg-muted)] font-semibold">
                    Cuota {frecuencia.toLowerCase()}
                  </p>
                  <p className="text-[36px] font-extrabold text-[var(--nb-fg)] nb-tabular tracking-[-0.025em] leading-tight">
                    {formatCOP(resultado.cuotaFija)}
                  </p>
                </div>
                <div className="text-right">
                  <Chip tone="brand" size="sm">
                    <Sparkles size={11} /> Tasa {resultado.tasaAnual.toFixed(0)}% EA
                  </Chip>
                  <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-1.5">
                    {resultado.plazoMeses} {frecuencia === 'MENSUAL' ? 'cuotas' : frecuencia === 'QUINCENAL' ? 'quincenas' : 'semanas'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBox
                  label="Primera cuota"
                  value={formatCOP(cuotaConCargoInicial)}
                  hint={`incluye ${formatCOP(TARIFA_PLATAFORMA + flexCosto)} en cargos`}
                />
                <StatBox
                  label="Total a pagar"
                  value={formatCOP(totalConCargos)}
                  hint={`${formatCOP(resultado.totalInteres)} de intereses`}
                />
              </div>

              {/* Desglose de cargos */}
              <div className="rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] p-3.5 flex flex-col gap-2">
                <CargoRow label="Tarifa de plataforma" value={formatCOP(TARIFA_PLATAFORMA)} obligatorio />
                {flexibilidad !== 'ninguna' && (
                  <CargoRow
                    label={`Flexibilidad ${flexibilidad === 'premium' ? 'Premium' : 'Básica'}`}
                    value={formatCOP(flexCosto)}
                  />
                )}
                <CargoRow label="Capital + intereses" value={formatCOP(resultado.totalPagar)} />
                <div className="h-px bg-[var(--nb-divider)] my-1" />
                <CargoRow label="Total" value={formatCOP(totalConCargos)} strong />
              </div>

              <GlassButton
                fullWidth
                variant="primary"
                size="lg"
                iconRight={<ArrowRight size={16} />}
                onClick={onCrearSolicitud}
              >
                Solicitar este crédito
              </GlassButton>
              <button
                onClick={() => setVerCronograma(true)}
                className="nb-press w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--nb-primary)] hover:underline"
              >
                <CalendarDays size={13} />
                Ver cronograma completo
              </button>
            </div>
          </GlassCard>
        </>
      ) : null}

      {/* Cronograma sheet */}
      <Sheet open={verCronograma} onClose={() => setVerCronograma(false)} title="Cronograma de pagos">
        {resultado && (
          <div className="flex flex-col gap-2 pb-4">
            {resultado.cronograma.map((c, i) => {
              const isFirst = i === 0
              const totalCuota = Number(c.total) + (isFirst ? TARIFA_PLATAFORMA + flexCosto : 0)
              return (
                <div
                  key={c.numero}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)]"
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center text-[12px] font-bold">
                    {c.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--nb-fg)]">
                      {new Date(c.fecha).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-0.5 nb-tabular">
                      Capital {formatCOP(c.capital)} · Interés {formatCOP(c.interes)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {formatCOP(totalCuota)}
                    </p>
                    {isFirst && (TARIFA_PLATAFORMA + flexCosto) > 0 && (
                      <p className="text-[10px] text-[var(--nb-warning)] font-semibold">incluye cargos</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Sheet>

      {/* Estilos range slider */}
      <style jsx>{`
        :global(.nb-range) {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            var(--nb-primary) 0%,
            var(--nb-primary) var(--nb-progress, 50%),
            var(--nb-surface-2) var(--nb-progress, 50%),
            var(--nb-surface-2) 100%
          );
          outline: none;
        }
        :global(.nb-range::-webkit-slider-thumb) {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          border: 3px solid var(--nb-primary);
          cursor: pointer;
          box-shadow: 0 4px 12px -2px rgba(91, 91, 247, 0.4);
          transition: transform 0.15s;
        }
        :global(.nb-range::-webkit-slider-thumb:active) {
          transform: scale(1.15);
        }
        :global(.nb-range::-moz-range-thumb) {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          border: 3px solid var(--nb-primary);
          cursor: pointer;
          box-shadow: 0 4px 12px -2px rgba(91, 91, 247, 0.4);
        }
      `}</style>
    </div>
  )
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="p-3 rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)]">
      <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
        {label}
      </p>
      <p className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-[var(--nb-fg-subtle)] mt-0.5">{hint}</p>}
    </div>
  )
}

function CargoRow({
  label,
  value,
  strong,
  obligatorio,
}: {
  label: string
  value: string
  strong?: boolean
  obligatorio?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[12px] ${strong ? 'font-bold text-[var(--nb-fg)]' : 'text-[var(--nb-fg-muted)]'}`}
        >
          {label}
        </span>
        {obligatorio && (
          <Chip tone="neutral" size="sm">
            obligatorio
          </Chip>
        )}
      </div>
      <span
        className={`text-[13px] nb-tabular ${strong ? 'font-extrabold text-[var(--nb-fg)]' : 'font-semibold text-[var(--nb-fg-muted)]'}`}
      >
        {value}
      </span>
    </div>
  )
}

function FlexOption({
  active,
  onClick,
  title,
  subtitle,
  badge,
  disabled,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
  badge?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`nb-press relative flex flex-col items-start gap-0.5 p-3 rounded-2xl border transition-all text-left ${
        active
          ? 'border-[var(--nb-primary)] bg-[var(--nb-primary-soft)] shadow-[0_8px_24px_-8px_rgba(91,91,247,0.4)]'
          : 'border-[var(--nb-border)] bg-[var(--nb-surface-2)] hover:border-[var(--nb-border-strong)]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {badge && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--nb-primary)]">
          {badge}
        </span>
      )}
      <span
        className={`text-[12px] font-bold ${active ? 'text-[var(--nb-primary)]' : 'text-[var(--nb-fg)]'}`}
      >
        {title}
      </span>
      <span className="text-[11px] font-semibold text-[var(--nb-fg-muted)] nb-tabular">{subtitle}</span>
    </button>
  )
}
