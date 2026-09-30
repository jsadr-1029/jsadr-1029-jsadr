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
import { Sliders, Sparkles, Info, CalendarDays, TrendingUp, ChevronRight, ArrowRight, CheckCircle2 } from 'lucide-react'

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
    fechaVencimiento?: string
    fecha?: string
    capital: number
    interes: number
    montoTotal?: number
    total?: number
    saldoCapital?: number
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
  const [verConfirmacion, setVerConfirmacion] = React.useState(false)
  const [enviandoSolicitud, setEnviandoSolicitud] = React.useState(false)
  const [solicitudEnviada, setSolicitudEnviada] = React.useState(false)

  // Enviar solicitud directamente (sin OTP, sin Clave Dinámica)
  const enviarSolicitud = async () => {
    if (!token) {
      toast.push('Sesión no disponible. Inicia sesión de nuevo.', 'danger')
      return
    }
    setEnviandoSolicitud(true)
    try {
      const cedula = typeof window !== 'undefined' ? localStorage.getItem('portal_cliente_cedula') : null
      const res = await fetch('/api/solicitudes-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: cedula || undefined,
          token,
          montoSolicitado: monto,
          plazoMeses: plazo,
          frecuencia,
          flexibilidadFinanciera: flexibilidad !== 'ninguna',
          flexibilidadModalidad: flexibilidad === 'ninguna' ? undefined : flexibilidad.toUpperCase(),
          notasCliente: `Solicitud creada desde simulador. Cuota estimada: ${formatCOP(resultado?.cuotaFija ?? 0)}. Total a pagar: ${formatCOP(totalConCargos)}.`,
          origen: 'PORTAL_NEOBANCO_SIMULADOR',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar la solicitud')
      }
      setSolicitudEnviada(true)
      toast.push('¡Solicitud enviada con éxito!', 'success')
    } catch (e: any) {
      toast.push(e.message || 'Error al enviar solicitud', 'danger')
    } finally {
      setEnviandoSolicitud(false)
    }
  }
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
          Pedir crédito
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          Simula tu cuota y envía la solicitud. Sin compromiso.
        </p>
      </header>

      {/* CONTROLES */}
      <GlassCard radius="lg">
        <div className="p-5 flex flex-col gap-5">
          {/* 1. FRECUENCIA DE PAGO (primero) */}
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 block">
              ¿Con qué frecuencia quieres pagar?
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
            <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-2 leading-relaxed">
              {frecuencia === 'MENSUAL' && 'Pagas una cuota cada mes, en la misma fecha del desembolso.'}
              {frecuencia === 'QUINCENAL' && 'Pagas una cuota cada 15 días. Ideal si recibes ingresos quincenales.'}
              {frecuencia === 'SEMANAL' && 'Pagas una cuota cada semana. Recomendado para comercios con flujo diario.'}
            </p>
          </div>

          {/* 2. MONTO DEL CRÉDITO (después de frecuencia) */}
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

          {/* 3. PLAZO */}
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

          {/* 4. FLEXIBILIDAD FINANCIERA con explicación completa */}
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

            {/* Explicación del servicio */}
            <div className="mb-3 p-3 rounded-2xl bg-[var(--nb-primary-soft)] border border-[var(--nb-primary)]/15">
              <p className="text-[11px] text-[var(--nb-fg)] leading-relaxed flex items-start gap-1.5">
                <Sparkles size={12} className="text-[var(--nb-primary)] shrink-0 mt-0.5" />
                <span>
                  <strong>¿Qué es?</strong> Un beneficio opcional que te permite cambiar la fecha de pago de una cuota
                  cuando tengas un imprevisto, sin que se te cobre mora ni te reporten a centrales de riesgo.
                </span>
              </p>
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

            {/* Detalle de cada plan */}
            <div className="mt-3 space-y-2">
              {flexibilidad === 'ninguna' && (
                <div className="p-3 rounded-xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)]">
                  <p className="text-[12px] font-bold text-[var(--nb-fg)] mb-1">Sin flexibilidad financiera</p>
                  <p className="text-[11px] text-[var(--nb-fg-muted)] leading-relaxed">
                    Pagas cada cuota en su fecha de vencimiento. Si te atrasas, se cobra mora diaria y podrías
                    ser reportado a centrales de riesgo. No se puede cambiar la fecha de ninguna cuota.
                  </p>
                </div>
              )}
              {flexibilidad === 'basica' && (
                <div className="p-3 rounded-xl bg-[var(--nb-success-soft)] border border-[var(--nb-success)]/20">
                  <p className="text-[12px] font-bold text-[var(--nb-success)] mb-1">Plan Básica · $15.000</p>
                  <p className="text-[11px] text-[var(--nb-fg)] leading-relaxed mb-2">
                    Puedes cambiar la fecha de pago de <strong>1 cuota</strong> durante todo el crédito.
                    El costo ($15.000) se suma a tu primera cuota.
                  </p>
                  <ul className="text-[11px] text-[var(--nb-fg-muted)] space-y-0.5 ml-3 list-disc">
                    <li>1 uso disponible durante toda la vigencia del crédito</li>
                    <li>Cambio de fecha sin cobro de mora</li>
                    <li>No te reporta a centrales de riesgo</li>
                    <li>La cuota se traslada al final del plazo</li>
                  </ul>
                </div>
              )}
              {flexibilidad === 'premium' && (
                <div className="p-3 rounded-xl bg-[var(--nb-primary-soft)] border border-[var(--nb-primary)]/25">
                  <p className="text-[12px] font-bold text-[var(--nb-primary)] mb-1">Plan Premium · $34.900</p>
                  <p className="text-[11px] text-[var(--nb-fg)] leading-relaxed mb-2">
                    Puedes cambiar la fecha de pago de <strong>2 cuotas</strong> durante todo el crédito.
                    El costo ($34.900) se suma a tu primera cuota.
                  </p>
                  <ul className="text-[11px] text-[var(--nb-fg-muted)] space-y-0.5 ml-3 list-disc">
                    <li>2 usos disponibles durante toda la vigencia del crédito</li>
                    <li>Cambio de fecha sin cobro de mora</li>
                    <li>No te reporta a centrales de riesgo</li>
                    <li>Las cuotas se trasladan al final del plazo</li>
                    <li>Se genera documento "Otro Sí" firmado electrónicamente</li>
                  </ul>
                </div>
              )}
              {!flexElegible && (
                <p className="text-[11px] text-[var(--nb-warning)] flex items-center gap-1.5 mt-2">
                  <Info size={12} className="shrink-0" />
                  <span>
                    La flexibilidad financiera solo está disponible para créditos con <strong>4 o más cuotas</strong>.
                    Aumenta el plazo para habilitarla.
                  </span>
                </p>
              )}
            </div>
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
                onClick={() => setVerConfirmacion(true)}
              >
                Pedir este crédito
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
              // El backend devuelve fechaVencimiento (Date ISO) y montoTotal
              // (algunos responses antiguos usaban fecha/total — ser compatible con ambos)
              const fechaISO: string = (c as any).fechaVencimiento ?? (c as any).fecha ?? ''
              const capital = Number((c as any).capital ?? 0)
              const interes = Number((c as any).interes ?? 0)
              const totalBase = Number((c as any).montoTotal ?? (c as any).total ?? 0)
              const totalCuota = totalBase + (isFirst ? TARIFA_PLATAFORMA + flexCosto : 0)
              const saldoCapital = Number((c as any).saldoCapital ?? 0)
              let fechaStr = '—'
              try {
                if (fechaISO) {
                  fechaStr = new Date(fechaISO).toLocaleDateString('es-CO', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                }
              } catch {}

              return (
                <div
                  key={c.numero}
                  className={`p-3 rounded-2xl border transition-colors ${
                    isFirst
                      ? 'bg-[var(--nb-primary-soft)] border-[var(--nb-primary)]/30'
                      : 'bg-[var(--nb-surface-2)] border-[var(--nb-border)]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[var(--nb-gradient-brand)] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                      {c.numero}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--nb-fg)] capitalize">
                        {fechaStr}
                      </p>
                      {isFirst && (TARIFA_PLATAFORMA + flexCosto) > 0 && (
                        <p className="text-[10px] text-[var(--nb-warning)] font-semibold mt-0.5">
                          Incluye {formatCOP(TARIFA_PLATAFORMA + flexCosto)} en cargos iniciales
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[15px] font-extrabold text-[var(--nb-fg)] nb-tabular">
                        {formatCOP(totalCuota)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[var(--nb-divider)]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                        Capital
                      </p>
                      <p className="text-[11px] font-bold text-[var(--nb-fg)] nb-tabular">
                        {formatCOP(capital)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                        Interés
                      </p>
                      <p className="text-[11px] font-bold text-[var(--nb-warning)] nb-tabular">
                        {formatCOP(interes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                        Saldo
                      </p>
                      <p className="text-[11px] font-bold text-[var(--nb-fg-muted)] nb-tabular">
                        {formatCOP(saldoCapital)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Sheet>

      {/* Sheet de confirmación — pedir crédito */}
      <Sheet
        open={verConfirmacion}
        onClose={() => !enviandoSolicitud && !solicitudEnviada && setVerConfirmacion(false)}
        title={solicitudEnviada ? '¡Solicitud enviada!' : 'Confirma tu solicitud'}
      >
        {solicitudEnviada ? (
          <div className="flex flex-col items-center text-center py-6 pb-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--nb-success-soft)] text-[var(--nb-success)] flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-[18px] font-bold text-[var(--nb-fg)] mb-2">
              ¡Tu solicitud fue enviada!
            </h3>
            <p className="text-[13px] text-[var(--nb-fg-muted)] leading-relaxed max-w-[300px] mb-5">
              Nuestro equipo revisará tu solicitud y te contactará en menos de 24 horas.
              Puedes seguir el estado desde la sección "Solicitudes".
            </p>
            <GlassButton
              fullWidth
              variant="primary"
              size="lg"
              onClick={() => {
                setVerConfirmacion(false)
                setSolicitudEnviada(false)
                onCrearSolicitud()
              }}
            >
              Ver mis solicitudes
            </GlassButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {/* Resumen de lo que se va a pedir */}
            <GlassCard radius="lg" variant="soft">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Monto solicitado
                  </span>
                  <span className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {formatCOP(monto)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Plazo
                  </span>
                  <span className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {plazo} {frecuencia === 'MENSUAL' ? 'meses' : frecuencia === 'QUINCENAL' ? 'quincenas' : 'semanas'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Cuota {frecuencia.toLowerCase()}
                  </span>
                  <span className="text-[16px] font-bold text-[var(--nb-primary)] nb-tabular">
                    {formatCOP(resultado?.cuotaFija ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Total a pagar
                  </span>
                  <span className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {formatCOP(totalConCargos)}
                  </span>
                </div>
                {flexibilidad !== 'ninguna' && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                      Flexibilidad
                    </span>
                    <Chip tone="brand" size="sm">
                      {flexibilidad === 'premium' ? 'Premium' : 'Básica'}
                    </Chip>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Disclaimer */}
            <div className="p-3 rounded-xl bg-[var(--nb-warning-soft)] border border-[var(--nb-warning)]/20 flex items-start gap-2">
              <Info size={14} className="text-[var(--nb-warning)] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[var(--nb-fg-muted)] leading-relaxed">
                Esta es una <strong>solicitud de crédito</strong>, no un desembolso inmediato.
                Queda <strong>sujeta a estudio y aprobación</strong> por parte de nuestro equipo.
                Te contactaremos en menos de 24 horas.
              </p>
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2">
              <GlassButton
                fullWidth
                variant="primary"
                size="lg"
                loading={enviandoSolicitud}
                iconRight={!enviandoSolicitud ? <ArrowRight size={16} /> : undefined}
                onClick={enviarSolicitud}
              >
                {enviandoSolicitud ? 'Enviando...' : 'Sí, enviar solicitud'}
              </GlassButton>
              <GlassButton
                fullWidth
                variant="ghost"
                size="md"
                onClick={() => setVerConfirmacion(false)}
                disabled={enviandoSolicitud}
              >
                Cancelar
              </GlassButton>
            </div>
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
