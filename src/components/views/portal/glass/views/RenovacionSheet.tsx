'use client'

// =====================================================
// RenovacionSheet — Sheet para simular renovación de préstamo
// Muestra:
//   1. Resumen del préstamo actual (cuotas pendientes, saldo)
//   2. Form para monto solicitado + plazo + frecuencia
//   3. Resultado: excedente a entregar + nuevo cronograma
//   4. Disclaimer "sujeto a estudio"
// =====================================================

import * as React from 'react'
import { Sheet, GlassCard, GlassButton, GlassInput, SegmentedControl, Chip, Skeleton, useNbToast } from '../ui'
import { formatCOP, formatFechaCorta, type NbPrestamo } from '../useNeobancoPortal'
import { RefreshCw, Info, ArrowRight, CalendarClock, Wallet, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

type RenovacionSheetProps = {
  open: boolean
  onClose: () => void
  prestamo: NbPrestamo | null
  token: string | null
  onEnviarSolicitud?: () => void
}

type CuotaPendiente = {
  numero: number
  fechaVencimiento?: string | null
  montoTotal: number
  mora: number
  estado: string
}

type SimulacionRenovacion = {
  prestamoActual: {
    id: string
    codigo: string
    estado: string
    saldoPendiente: number
    moraTotal: number
    saldoTotalConMora: number
    cuotasPendientes: CuotaPendiente[]
    cantidadCuotasPendientes: number
  }
  nuevoPrestamo: {
    montoSolicitado: number
    plazoMeses: number
    frecuencia: string
    tasaAnual: number
    tasaMensual: number
    cuotaFija: number
    totalInteres: number
    totalPagar: number
    numeroCuotas: number
    cronograma: Array<{
      numero: number
      fechaVencimiento: string
      capital: number
      interes: number
      montoTotal: number
      saldoCapital: number
    }>
  }
  excedente: number
  explicacion: string
  disclaimer: string
  sujetoAEstudio: boolean
}

export function RenovacionSheet({ open, onClose, prestamo, token, onEnviarSolicitud }: RenovacionSheetProps) {
  const toast = useNbToast()
  const [monto, setMonto] = React.useState(0)
  const [plazo, setPlazo] = React.useState(6)
  const [frecuencia, setFrecuencia] = React.useState<'MENSUAL' | 'QUINCENAL' | 'SEMANAL'>('MENSUAL')
  const [resultado, setResultado] = React.useState<SimulacionRenovacion | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  // Sugerir monto inicial = saldo del préstamo + 50%
  React.useEffect(() => {
    if (prestamo && open) {
      const saldo = Number(prestamo.saldoTotal) || 0
      const sugerido = Math.max(saldo * 1.5, saldo + 500000)
      setMonto(Math.round(sugerido / 50000) * 50000)
      setResultado(null)
      setError(null)
    }
  }, [prestamo, open])

  // Disparar simulación al cambiar parámetros (debounce 500ms)
  React.useEffect(() => {
    if (!open || !token || !prestamo || monto <= 0) return
    let active = true
    const debounce = setTimeout(async () => {
      setCargando(true)
      setError(null)
      try {
        const res = await fetch('/api/portal/renovar/simular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            prestamoId: prestamo.id,
            montoSolicitado: monto,
            plazoMeses: plazo,
            frecuencia,
          }),
        })
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          setError(data.error || 'No se pudo simular')
          setResultado(null)
          return
        }
        setResultado(data.simulacion)
      } catch (e: any) {
        if (active) setError(e.message || 'Error de conexión')
      } finally {
        if (active) setCargando(false)
      }
    }, 500)
    return () => {
      active = false
      clearTimeout(debounce)
    }
  }, [open, token, prestamo, monto, plazo, frecuencia])

  const enviarSolicitud = async () => {
    if (!token || !prestamo) {
      toast.push('Sesión no disponible', 'danger')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/solicitudes-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: localStorage.getItem('portal_cliente_cedula'),
          montoSolicitado: monto,
          plazoMeses: plazo,
          frecuencia,
          notasCliente: `Solicitud de RENOVACIÓN del préstamo ${prestamo.codigo}. Saldo pendiente actual: ${resultado?.prestamoActual.saldoTotalConMora.toLocaleString('es-CO')} COP. Excedente solicitado: ${resultado?.excedente.toLocaleString('es-CO')} COP.`,
          origen: 'PORTAL_NEOBANCO_RENOVACION',
          prestamoARenovarId: prestamo.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la solicitud')
      toast.push('Solicitud de renovación enviada. Queda sujeta a estudio.', 'success')
      onEnviarSolicitud?.()
      onClose()
    } catch (e: any) {
      toast.push(e.message || 'Error al enviar solicitud', 'danger')
    } finally {
      setEnviando(false)
    }
  }

  if (!prestamo) return null

  return (
    <Sheet open={open} onClose={onClose} title={`Renovar ${prestamo.codigo}`}>
      <div className="flex flex-col gap-4 pb-4">
        {/* Banner explicativo */}
        <GlassCard radius="md" variant="soft">
          <div className="p-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center shrink-0">
              <RefreshCw size={16} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[var(--nb-fg)]">
                Renueva tu préstamo
              </p>
              <p className="text-[12px] text-[var(--nb-fg-muted)] mt-1 leading-relaxed">
                El sistema recoge las cuotas pendientes de tu préstamo actual y las paga
                con el monto que solicites. El excedente se te entrega. Tu nuevo préstamo
                queda con un cronograma fresh.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Resumen préstamo actual */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 px-1">
            Préstamo actual
          </h3>
          {cargando && !resultado ? (
            <Skeleton className="h-28 w-full rounded-[16px]" />
          ) : resultado ? (
            <GlassCard radius="lg">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Saldo pendiente
                  </span>
                  <span className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {formatCOP(resultado.prestamoActual.saldoTotalConMora)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Cuotas pendientes
                  </span>
                  <Chip tone={resultado.prestamoActual.moraTotal > 0 ? 'danger' : 'warning'} size="sm">
                    {resultado.prestamoActual.cantidadCuotasPendientes} cuota(s)
                  </Chip>
                </div>
                {resultado.prestamoActual.moraTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--nb-danger)]">
                      Mora incluida
                    </span>
                    <span className="text-[13px] font-bold text-[var(--nb-danger)] nb-tabular">
                      {formatCOP(resultado.prestamoActual.moraTotal)}
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard radius="lg">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--nb-fg-muted)]">
                    Saldo actual
                  </span>
                  <span className="text-[16px] font-bold text-[var(--nb-fg)] nb-tabular">
                    {formatCOP(prestamo.saldoTotal)}
                  </span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Form nueva solicitud */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 px-1">
            Nueva solicitud
          </h3>
          <div className="flex flex-col gap-3">
            <GlassInput
              label="Monto a solicitar (COP)"
              type="number"
              value={monto || ''}
              onChange={(e) => setMonto(Number(e.target.value) || 0)}
              min={100000}
              max={10000000}
              step={50000}
              prefix="$"
              hint="Debe ser mayor al saldo pendiente actual"
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
          </div>
        </div>

        {/* Error */}
        {error && (
          <GlassCard radius="md">
            <div className="p-3.5 flex items-start gap-3">
              <AlertTriangle size={16} className="text-[var(--nb-danger)] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--nb-danger)] font-medium">{error}</p>
            </div>
          </GlassCard>
        )}

        {/* Resultado */}
        {cargando && !resultado && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full rounded-[16px]" />
            <Skeleton className="h-32 w-full rounded-[16px]" />
          </div>
        )}

        {resultado && !error && (
          <>
            {/* Excedente destacado */}
            <GlassCard variant="elevated" radius="lg">
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--nb-success-soft)] text-[var(--nb-success)] flex items-center justify-center">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Excedente a recibir
                    </p>
                    <p className="text-[24px] font-extrabold text-[var(--nb-success)] nb-tabular tracking-[-0.02em]">
                      {formatCOP(resultado.excedente)}
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--nb-fg-muted)] leading-relaxed">
                  {resultado.explicacion}
                </p>
              </div>
            </GlassCard>

            {/* Nuevo cronograma resumido */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 px-1">
                Nuevo préstamo — resumen
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <GlassCard radius="md">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Cuota {frecuencia.toLowerCase()}
                    </p>
                    <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {formatCOP(resultado.nuevoPrestamo.cuotaFija)}
                    </p>
                  </div>
                </GlassCard>
                <GlassCard radius="md">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Cuotas
                    </p>
                    <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {resultado.nuevoPrestamo.numeroCuotas}
                    </p>
                  </div>
                </GlassCard>
                <GlassCard radius="md">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Total a pagar
                    </p>
                    <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {formatCOP(resultado.nuevoPrestamo.totalPagar)}
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>

            {/* Primeras 3 cuotas del nuevo cronograma */}
            {resultado.nuevoPrestamo.cronograma.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-fg-muted)] mb-2 px-1">
                  Primeras cuotas
                </h3>
                <GlassCard radius="lg">
                  <div className="p-3 flex flex-col gap-2">
                    {resultado.nuevoPrestamo.cronograma.slice(0, 3).map((c) => (
                      <div key={c.numero} className="flex items-center gap-3 py-1.5 border-b border-[var(--nb-divider)] last:border-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--nb-gradient-brand)] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                          {c.numero}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--nb-fg)]">
                            {formatFechaCorta(c.fechaVencimiento)}
                          </p>
                          <p className="text-[10px] text-[var(--nb-fg-subtle)] nb-tabular">
                            Capital {formatCOP(c.capital)} · Interés {formatCOP(c.interes)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-[var(--nb-fg)] nb-tabular">
                            {formatCOP(c.montoTotal)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {resultado.nuevoPrestamo.cronograma.length > 3 && (
                      <p className="text-[11px] text-[var(--nb-fg-subtle)] text-center pt-1">
                        + {resultado.nuevoPrestamo.cronograma.length - 3} cuota(s) más
                      </p>
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Disclaimer */}
            <GlassCard radius="md" variant="soft">
              <div className="p-3.5 flex items-start gap-3">
                <Info size={14} className="text-[var(--nb-warning)] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[var(--nb-fg-muted)] leading-relaxed">
                  {resultado.disclaimer}
                </p>
              </div>
            </GlassCard>

            {/* Botón enviar solicitud */}
            <GlassButton
              fullWidth
              variant="primary"
              size="lg"
              loading={enviando}
              iconRight={<ArrowRight size={16} />}
              onClick={enviarSolicitud}
            >
              Enviar solicitud de renovación
            </GlassButton>
            <p className="text-[10px] text-[var(--nb-fg-subtle)] text-center">
              Al enviar aceptas que esta es una propuesta sujeta a estudio.
              Un asesor la revisará en menos de 24h.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
