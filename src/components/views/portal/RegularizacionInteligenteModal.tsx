'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  AlertTriangle,
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  Calculator,
  Handshake,
  CheckCircle2,
  Info,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Loader2,
  CalendarClock,
  X,
  DollarSign,
  Lightbulb,
  FileText,
  Wallet,
} from 'lucide-react'

// =====================================================
// RegularizacionInteligenteModal
// -----------------------------------------------------
// Asistente conversacional que ayuda al cliente a
// regularizar sus cuotas vencidas. Calcula escenarios
// dinámicos según fecha de pago propuesta, muestra el
// costo de esperar, y permite elegir alternativas.
// =====================================================

interface CuotaVencida {
  numero: number
  fechaVencimiento: string
  capital: number
  interes: number
  montoCuota: number
  diasMora: number
  moraActual: number
  moraDiariaPesos: number
  pagadoCuota: number
  pendienteCuota: number
}

interface Escenario {
  fecha: string
  diasDesdeHoy: number
  capitalPendiente: number
  interesAcumulado: number
  moraAcumulada: number
  otrosCargos: number
  total: number
  diferenciaFrenteHoy: number
}

interface PrestamoVencido {
  prestamoId: string
  codigo: string
  modalidad: string
  montoPrincipal: number
  tasaMoraDiaria: number
  cuotasVencidas: CuotaVencida[]
  totalPendienteHoy: number
  totalCapital: number
  totalInteres: number
  totalMora: number
  cargosIniciales: number
}

interface DataRegularizar {
  cliente: { nombre: string; cedula: string }
  tieneVencidas: boolean
  totalCuotasVencidas: number
  totalPendienteHoy: number
  totalMora: number
  totalCapital: number
  totalInteres: number
  cargosIniciales: number
  prestamos: PrestamoVencido[]
  escenariosComparativos: Record<string, Escenario[]>
  escenariosHoy: Escenario[]
}

type Paso =
  | 'resumen'           // 0. Mostrar cuotas vencidas + total
  | 'fecha'             // 1. Preguntar fecha de pago
  | 'no_seguro'         // 1b. Si no está seguro, preguntar días
  | 'escenario'         // 2. Mostrar escenario calculado
  | 'capacidad'         // 3. Preguntar cuánto puede pagar
  | 'alternativas'      // 4. Mostrar alternativas
  | 'confirmacion'      // 5. Resumen final antes de confirmar
  | 'enviado'           // 6. Confirmación de envío

interface Props {
  open: boolean
  onClose: () => void
  cedula: string
  token: string
}

export function RegularizacionInteligenteModal({ open, onClose, cedula, token }: Props) {
  const { toast } = useToast()

  const [data, setData] = useState<DataRegularizar | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selección de préstamo (si hay varios)
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<PrestamoVencido | null>(null)

  // Paso actual del flujo
  const [paso, setPaso] = useState<Paso>('resumen')

  // Fecha propuesta por el cliente
  const [fechaPropuesta, setFechaPropuesta] = useState<string>('')
  const [diasPropuestos, setDiasPropuestos] = useState<number>(15)

  // Escenario calculado (de la API)
  const [escenario, setEscenario] = useState<Escenario | null>(null)
  const [comparativa, setComparativa] = useState<Escenario[]>([])
  const [calculandoEsc, setCalculandoEsc] = useState(false)

  // Capacidad de pago del cliente
  const [montoCapacidad, setMontoCapacidad] = useState<string>('')

  // Tipo de acuerdo seleccionado
  const [tipoAcuerdo, setTipoAcuerdo] = useState<
    'PAGO_COMPLETO' | 'PAGO_PARCIAL' | 'ACUERDO_REGULARIZACION' | 'PROMESA_PAGO' | null
  >(null)

  // Guardando compromiso
  const [guardando, setGuardando] = useState(false)
  const [compromisoId, setCompromisoId] = useState<string | null>(null)

  // === Cargar datos iniciales al abrir ===
  useEffect(() => {
    if (!open || !cedula || !token) return
    cargarDatos()
  }, [open, cedula, token])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/${cedula}/regularizar`, {
        headers: { 'x-portal-token': token },
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        // Si solo hay un préstamo, seleccionarlo automáticamente
        if (json.data.prestamos.length === 1) {
          setPrestamoSeleccionado(json.data.prestamos[0])
        }
      } else {
        setError(json.error || 'No se pudo cargar la información')
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // === Calcular escenario para una fecha específica ===
  const calcularEscenario = async (fecha: string) => {
    if (!prestamoSeleccionado) return
    setCalculandoEsc(true)
    try {
      const res = await fetch(`/api/portal/${cedula}/regularizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': token,
        },
        body: JSON.stringify({
          accion: 'calcular_escenario',
          prestamoId: prestamoSeleccionado.prestamoId,
          fecha,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setEscenario(json.data.escenario)
        setComparativa(json.data.comparativa)
      } else {
        toast({
          title: 'No se pudo calcular',
          description: json.error || 'Intenta nuevamente',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de conexión',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setCalculandoEsc(false)
    }
  }

  // === Cuando el cliente selecciona una fecha ===
  const onSeleccionarFecha = (fechaISO: string) => {
    setFechaPropuesta(fechaISO)
    calcularEscenario(fechaISO)
    setPaso('escenario')
  }

  // === Cuando el cliente dice "No estoy seguro" ===
  const onNoSeguro = () => {
    setPaso('no_seguro')
  }

  // === Cuando el cliente propone días aproximados ===
  const onProponerDias = (dias: number) => {
    setDiasPropuestos(dias)
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    const fechaISO = fecha.toISOString().slice(0, 10)
    onSeleccionarFecha(fechaISO)
  }

  // === Calcular diferencia (lo que falta) ===
  const montoCapacidadNum = parseFloat(montoCapacidad) || 0
  const montoNecesario = escenario?.total || prestamoSeleccionado?.totalPendienteHoy || 0
  const diferencia = montoNecesario - montoCapacidadNum
  const puedeCubrirTodo = montoCapacidadNum >= montoNecesario

  // === Guardar acuerdo ===
  const guardarAcuerdo = async () => {
    if (!prestamoSeleccionado || !escenario || !tipoAcuerdo) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/portal/${cedula}/regularizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': token,
        },
        body: JSON.stringify({
          accion: 'guardar_compromiso',
          prestamoId: prestamoSeleccionado.prestamoId,
          tipoAcuerdo,
          fechaPago: fechaPropuesta,
          montoPropuesto: montoCapacidadNum,
          montoTotalAcordado: escenario.total,
          cuotasVencidasIncluidas: prestamoSeleccionado.cuotasVencidas.map(c => c.numero),
          saldoRestante: Math.max(0, diferencia),
          fechasPagosPosteriores: tipoAcuerdo === 'ACUERDO_REGULARIZACION'
            ? generarFechasPosteriores(fechaPropuesta, diferencia)
            : null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCompromisoId(json.data.compromisoId)
        setPaso('enviado')
        toast({
          title: 'Acuerdo registrado',
          description: json.data.mensaje,
          duration: 6000,
        })
      } else {
        toast({
          title: 'No se pudo registrar',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setGuardando(false)
    }
  }

  const generarFechasPosteriores = (fechaInicial: string, monto: number) => {
    if (monto <= 0) return []
    const cuotasSugeridas = Math.max(1, Math.ceil(monto / (prestamoSeleccionado?.cuotasVencidas[0]?.montoCuota || monto)))
    const fechas: string[] = []
    const f = new Date(fechaInicial)
    for (let i = 1; i <= Math.min(cuotasSugeridas, 4); i++) {
      const fn = new Date(f)
      fn.setDate(fn.getDate() + 15 * i)
      fechas.push(fn.toISOString().slice(0, 10))
    }
    return fechas
  }

  // === Reset al cerrar ===
  const cerrar = () => {
    onClose()
    setTimeout(() => {
      setPaso('resumen')
      setEscenario(null)
      setComparativa([])
      setFechaPropuesta('')
      setMontoCapacidad('')
      setTipoAcuerdo(null)
      setCompromisoId(null)
      setPrestamoSeleccionado(null)
    }, 300)
  }

  // === Render ===
  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-500/30">
        <VisuallyHidden>
          <DialogTitle>Regularización inteligente de cuotas vencidas</DialogTitle>
        </VisuallyHidden>

        {/* === HEADER === */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600/95 to-violet-600/95 backdrop-blur-md px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Handshake className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm leading-tight">Regularización inteligente</h2>
                <p className="text-[10px] text-white/70 leading-tight">Asistente de cuotas vencidas</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={cerrar}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* === BODY === */}
        <div className="px-5 py-5 space-y-4 text-white">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
              <p className="text-sm text-slate-300">Cargando información de tus cuotas...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-400/30">
              <p className="text-sm text-red-200">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={cargarDatos}
              >
                Reintentar
              </Button>
            </div>
          )}

          {!loading && !error && data && !data.tieneVencidas && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1">¡Estás al día!</h3>
              <p className="text-sm text-slate-300">
                No tienes cuotas vencidas. ¡Gracias por tu responsabilidad financiera!
              </p>
              <Button
                className="mt-5 bg-indigo-600 hover:bg-indigo-700"
                onClick={cerrar}
              >
                Cerrar
              </Button>
            </div>
          )}

          {/* === PASO 0: Selección de préstamo si hay varios === */}
          {!loading && !error && data && data.tieneVencidas && !prestamoSeleccionado && (
            <div className="space-y-3">
              <div className="text-center mb-2">
                <Sparkles className="w-7 h-7 mx-auto text-amber-400 mb-2" />
                <h3 className="text-white font-bold text-base">Tienes cuotas vencidas</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Selecciona el crédito que deseas regularizar:
                </p>
              </div>
              {data.prestamos.map((p) => (
                <button
                  key={p.prestamoId}
                  onClick={() => {
                    setPrestamoSeleccionado(p)
                    setPaso('resumen')
                  }}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/40 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-indigo-300">{p.codigo}</span>
                    <Badge className="bg-red-500/20 text-red-300 border border-red-400/30 text-[10px]">
                      {p.cuotasVencidas.length} vencidas
                    </Badge>
                  </div>
                  <p className="text-white font-bold">{formatearMoneda(p.totalPendienteHoy)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {p.cuotasVencidas.length} cuota(s) vencida(s) · Mora: {formatearMoneda(p.totalMora)}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* === PASO: resumen (cuotas vencidas) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'resumen' && (
            <div className="space-y-4">
              <div className="text-center mb-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-white font-bold text-base">Cuotas vencidas</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Crédito <span className="font-mono text-indigo-300">{prestamoSeleccionado.codigo}</span>
                </p>
              </div>

              {/* Lista de cuotas vencidas */}
              <div className="space-y-2">
                {prestamoSeleccionado.cuotasVencidas.map((c) => (
                  <div
                    key={c.numero}
                    className="p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white">
                        Cuota #{c.numero}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-red-400/40 text-red-300">
                        {c.diasMora} días de mora
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500">Vencimiento:</span>{' '}
                        <span className="font-medium text-white">{formatearFecha(c.fechaVencimiento)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Valor cuota:</span>{' '}
                        <span className="font-medium text-white">{formatearMoneda(c.montoCuota)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Capital:</span>{' '}
                        <span className="font-medium text-white">{formatearMoneda(c.capital)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Interés:</span>{' '}
                        <span className="font-medium text-white">{formatearMoneda(c.interes)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mora:</span>{' '}
                        <span className="font-medium text-red-300">{formatearMoneda(c.moraActual)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total para quedar al día hoy */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-emerald-400/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-300" />
                  <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                    Total para quedar al día hoy
                  </p>
                </div>
                <p className="text-3xl font-black text-white tracking-tight">
                  {formatearMoneda(prestamoSeleccionado.totalPendienteHoy)}
                </p>
                {prestamoSeleccionado.cargosIniciales > 0 && (
                  <p className="text-[10px] text-emerald-200/70 mt-1">
                    Incluye {formatearMoneda(prestamoSeleccionado.cargosIniciales)} en cargos iniciales pendientes
                  </p>
                )}
              </div>

              {/* Advertencia sobre mora futura */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/30 flex gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200">
                  <strong>Pagar más adelante puede aumentar el valor total</strong> debido a los intereses moratorios ({prestamoSeleccionado.tasaMoraDiaria}% diario sobre el capital).
                </p>
              </div>

              {/* Botón continuar */}
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => setPaso('fecha')}
              >
                Continuar
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* === PASO: fecha (preguntar fecha de pago) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'fecha' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center mb-2">
                  <Calendar className="w-6 h-6 text-indigo-300" />
                </div>
                <h3 className="text-white font-bold text-base">¿Para qué fecha podrías pagar?</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Selecciona una fecha en el calendario. Calcularemos el valor estimado para esa fecha.
                </p>
              </div>

              <div>
                <Label className="text-xs text-slate-300 mb-1.5 block">Fecha propuesta</Label>
                <Input
                  type="date"
                  value={fechaPropuesta}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFechaPropuesta(e.target.value)}
                  className="bg-white/5 border-white/15 text-white"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/15 text-white hover:bg-white/10"
                  onClick={() => setPaso('resumen')}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Atrás
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={!fechaPropuesta || calculandoEsc}
                  onClick={() => onSeleccionarFecha(fechaPropuesta)}
                >
                  {calculandoEsc ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Calculando...
                    </>
                  ) : (
                    <>
                      Calcular <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center">
                <button
                  className="text-[11px] text-slate-400 underline hover:text-slate-200"
                  onClick={onNoSeguro}
                >
                  No estoy seguro de la fecha
                </button>
              </div>
            </div>
          )}

          {/* === PASO: no_seguro (preguntar días) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'no_seguro' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 text-cyan-300" />
                </div>
                <h3 className="text-white font-bold text-base">Sin problema</h3>
                <p className="text-xs text-slate-300 mt-1">
                  ¿En cuántos días aproximadamente crees que podrías realizar el pago?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[7, 15, 30, 45, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => onProponerDias(d)}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all text-white font-bold"
                  >
                    {d} días
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full border-white/15 text-white hover:bg-white/10"
                onClick={() => setPaso('fecha')}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Volver al calendario
              </Button>
            </div>
          )}

          {/* === PASO: escenario (mostrar cálculo) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'escenario' && escenario && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                  <Calculator className="w-6 h-6 text-emerald-300" />
                </div>
                <h3 className="text-white font-bold text-base">
                  Si pagas el {formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Escenario calculado para esa fecha
                </p>
              </div>

              {/* Tarjeta del escenario */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-400/30">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Capital pendiente:</span>
                    <span className="text-white font-bold">{formatearMoneda(escenario.capitalPendiente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Intereses acumulados:</span>
                    <span className="text-white font-bold">{formatearMoneda(escenario.interesAcumulado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Mora acumulada:</span>
                    <span className="text-red-300 font-bold">{formatearMoneda(escenario.moraAcumulada)}</span>
                  </div>
                  {escenario.otrosCargos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">Otros cargos:</span>
                      <span className="text-white font-bold">{formatearMoneda(escenario.otrosCargos)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/15 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-emerald-200 font-bold">Total estimado:</span>
                      <span className="text-emerald-300 font-black text-lg">{formatearMoneda(escenario.total)}</span>
                    </div>
                    {escenario.diferenciaFrenteHoy > 0 && (
                      <div className="flex justify-between mt-1">
                        <span className="text-amber-200 text-xs">Diferencia vs. pagar hoy:</span>
                        <span className="text-amber-300 text-xs font-bold">+{formatearMoneda(escenario.diferenciaFrenteHoy)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla comparativa */}
              <div>
                <p className="text-xs text-slate-300 font-semibold mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Comparativa de fechas
                </p>
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-white/5 text-slate-300">
                        <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                        <th className="px-3 py-2 text-right font-semibold">Intereses</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativa.map((e, i) => {
                        const fechaStr = e.diasDesdeHoy === 0 ? 'Hoy' : formatearFecha(e.fecha)
                        const esSeleccionada = e.diasDesdeHoy === escenario.diasDesdeHoy
                        return (
                          <tr
                            key={i}
                            className={`border-t border-white/5 ${
                              esSeleccionada ? 'bg-indigo-500/15' : 'hover:bg-white/5'
                            }`}
                          >
                            <td className="px-3 py-2 text-white font-medium">{fechaStr}</td>
                            <td className="px-3 py-2 text-right text-amber-300">
                              {formatearMoneda(e.moraAcumulada + e.interesAcumulado)}
                            </td>
                            <td className="px-3 py-2 text-right text-white font-bold">{formatearMoneda(e.total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Advertencia */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 flex gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200">
                  Este valor es una estimación. El monto definitivo se calculará al momento de realizar el pago.
                </p>
              </div>

              {/* Botones */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={() => setPaso('fecha')}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Cambiar fecha
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => setPaso('capacidad')}
                >
                  Continuar
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* === PASO: capacidad (preguntar cuánto puede pagar) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'capacidad' && escenario && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-violet-500/20 flex items-center justify-center mb-2">
                  <Wallet className="w-6 h-6 text-violet-300" />
                </div>
                <h3 className="text-white font-bold text-base">¿Cuánto puedes pagar?</h3>
                <p className="text-xs text-slate-300 mt-1">
                  En la fecha seleccionada ({formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)})
                </p>
              </div>

              <div>
                <Label className="text-xs text-slate-300 mb-1.5 block">Monto que puedes pagar</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej: 500000"
                  value={montoCapacidad}
                  onChange={(e) => setMontoCapacidad(e.target.value)}
                  className="bg-white/5 border-white/15 text-white text-lg font-bold"
                />
              </div>

              {/* Comparación */}
              {montoCapacidadNum > 0 && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Puedes pagar:</span>
                    <span className="text-white font-bold">{formatearMoneda(montoCapacidadNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Necesario para quedar al día:</span>
                    <span className="text-white font-bold">{formatearMoneda(montoNecesario)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                    <span className={puedeCubrirTodo ? 'text-emerald-300' : 'text-amber-300'}>
                      {puedeCubrirTodo ? '✓ Te sobra:' : '⚠ Te falta:'}
                    </span>
                    <span className={`font-bold ${puedeCubrirTodo ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {formatearMoneda(Math.abs(diferencia))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={() => setPaso('escenario')}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Atrás
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={montoCapacidadNum <= 0}
                  onClick={() => setPaso('alternativas')}
                >
                  Ver alternativas
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* === PASO: alternativas === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'alternativas' && escenario && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                  <Lightbulb className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-white font-bold text-base">Alternativas disponibles</h3>
                <p className="text-xs text-slate-300 mt-1">
                  {puedeCubrirTodo
                    ? 'Tienes capacidad para cubrir el total. Elige cómo proceder:'
                    : `Con ${formatearMoneda(montoCapacidadNum)} podrías cubrir una parte. Elige:`}
                </p>
              </div>

              {/* Opción 1: Pago completo */}
              <button
                onClick={() => {
                  setTipoAcuerdo('PAGO_COMPLETO')
                  setPaso('confirmacion')
                }}
                className="w-full text-left p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-400/30 transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">Opción 1 — Pago completo</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Paga {formatearMoneda(escenario.total)} el {formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)}.
                    </p>
                  </div>
                </div>
              </button>

              {/* Opción 2: Pago parcial (solo si no puede cubrir todo) */}
              {!puedeCubrirTodo && (
                <button
                  onClick={() => {
                    setTipoAcuerdo('PAGO_PARCIAL')
                    setPaso('confirmacion')
                  }}
                  className="w-full text-left p-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-400/30 transition-all"
                >
                  <div className="flex items-start gap-2.5">
                    <DollarSign className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">Opción 2 — Pago parcial</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Paga {formatearMoneda(montoCapacidadNum)} el {formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)} + saldo restante ({formatearMoneda(Math.abs(diferencia))}) según acuerdo.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Opción 3: Acuerdo de regularización (dividir en pagos posteriores) */}
              {!puedeCubrirTodo && (
                <button
                  onClick={() => {
                    setTipoAcuerdo('ACUERDO_REGULARIZACION')
                    setPaso('confirmacion')
                  }}
                  className="w-full text-left p-3.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-400/30 transition-all"
                >
                  <div className="flex items-start gap-2.5">
                    <Handshake className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">Opción 3 — Acuerdo de regularización</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Pago inicial de {formatearMoneda(montoCapacidadNum)} + divide el saldo restante ({formatearMoneda(Math.abs(diferencia))}) en pagos quincenales posteriores.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Opción 4: Promesa de pago (solo fecha, sin monto confirmado) */}
              <button
                onClick={() => {
                  setTipoAcuerdo('PROMESA_PAGO')
                  setPaso('confirmacion')
                }}
                className="w-full text-left p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-400/30 transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <CalendarClock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">Opción 4 — Promesa de pago</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Te comprometes a pagar el {formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)}. Un asesor te contactará para confirmar.
                    </p>
                  </div>
                </div>
              </button>

              <Button
                variant="outline"
                className="w-full border-white/15 text-white hover:bg-white/10"
                onClick={() => setPaso('capacidad')}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Atrás
              </Button>
            </div>
          )}

          {/* === PASO: confirmación (resumen final antes de confirmar) === */}
          {!loading && !error && data && prestamoSeleccionado && paso === 'confirmacion' && escenario && tipoAcuerdo && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
                <h3 className="text-white font-bold text-base">Tu acuerdo de regularización</h3>
                <p className="text-xs text-slate-300 mt-1">Revisa antes de confirmar</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/15 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Crédito:</span>
                  <span className="text-white font-mono text-xs">{prestamoSeleccionado.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Cuotas vencidas:</span>
                  <span className="text-white font-bold">{prestamoSeleccionado.cuotasVencidas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Saldo vencido (capital):</span>
                  <span className="text-white font-bold">{formatearMoneda(escenario.capitalPendiente)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Intereses estimados:</span>
                  <span className="text-white font-bold">{formatearMoneda(escenario.interesAcumulado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Mora acumulada:</span>
                  <span className="text-red-300 font-bold">{formatearMoneda(escenario.moraAcumulada)}</span>
                </div>
                {escenario.otrosCargos > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Otros cargos:</span>
                    <span className="text-white font-bold">{formatearMoneda(escenario.otrosCargos)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-emerald-200 font-bold">Total estimado:</span>
                  <span className="text-emerald-300 font-black">{formatearMoneda(escenario.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Tipo de acuerdo:</span>
                  <span className="text-white font-bold text-xs">
                    {tipoAcuerdo === 'PAGO_COMPLETO' && 'Pago completo'}
                    {tipoAcuerdo === 'PAGO_PARCIAL' && 'Pago parcial'}
                    {tipoAcuerdo === 'ACUERDO_REGULARIZACION' && 'Acuerdo de regularización'}
                    {tipoAcuerdo === 'PROMESA_PAGO' && 'Promesa de pago'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Fecha del primer pago:</span>
                  <span className="text-white font-bold">{formatearFecha(escenario.fecha === 'hoy' ? new Date() : escenario.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Monto del primer pago:</span>
                  <span className="text-white font-bold">{formatearMoneda(montoCapacidadNum || escenario.total)}</span>
                </div>
                {!puedeCubrirTodo && tipoAcuerdo !== 'PAGO_COMPLETO' && tipoAcuerdo !== 'PROMESA_PAGO' && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Saldo restante:</span>
                    <span className="text-amber-300 font-bold">{formatearMoneda(Math.abs(diferencia))}</span>
                  </div>
                )}
              </div>

              {/* Advertencia */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 flex gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200">
                  Al confirmar, tu acuerdo quedará registrado y un asesor lo revisará en las próximas 24 horas. El valor final puede variar según los intereses del día del pago.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-white/15 text-white hover:bg-white/10"
                  onClick={() => setPaso('alternativas')}
                >
                  Otra alternativa
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={guardando}
                  onClick={guardarAcuerdo}
                >
                  {guardando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Confirmar acuerdo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* === PASO: enviado (confirmación de envío) === */}
          {!loading && !error && paso === 'enviado' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">¡Acuerdo registrado!</h3>
              <p className="text-sm text-slate-300 mb-1">
                Tu solicitud de regularización ha sido enviada correctamente.
              </p>
              <p className="text-xs text-slate-400 mb-5">
                Código de seguimiento: <span className="font-mono text-indigo-300">{compromisoId?.slice(-8).toUpperCase()}</span>
              </p>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-400/30 mb-4">
                <p className="text-[11px] text-indigo-200">
                  Un asesor revisará tu acuerdo en las próximas 24 horas. Si necesitas ajustes, puedes contactarnos por el centro de comunicaciones.
                </p>
              </div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={cerrar}
              >
                Listo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
