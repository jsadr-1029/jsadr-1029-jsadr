'use client'

// =====================================================
// 🕰️ Línea de Tiempo 360°
// =====================================================
// Vista premium de exploración histórica de la cartera.
// "Viaja al pasado. Descubre qué ocurrió. Entiende cómo llegó tu cartera hasta hoy."
// =====================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Calendar, Clock, ArrowLeft, ArrowRight as ArrowRightIcon, Play, Pause, SkipBack, SkipForward,
  Camera, Search, BarChart3, Users, AlertTriangle, ChevronRight, X, Eye,
  History, Sparkles, TrendingUp, TrendingDown, Building2, CreditCard, User,
  FileText, Activity, Zap, Info, ArrowUpRight, ArrowDownRight, Save, Download,
} from 'lucide-react'
import { formatCOP } from '@/lib/format'

// =====================================================
// Tipos (espejo del backend)
// =====================================================
interface PrestamoHistorico {
  id: string
  codigo: string
  clienteId: string
  clienteNombre: string
  clienteCedula: string
  montoPrincipal: number
  tasaInteresAnual: number
  plazoMeses: number
  frecuencia: string
  numeroCuotas: number
  montoCuota: number
  totalPagar: number
  estadoHistorico: string
  saldoTotalHistorico: number
  montoPagadoHistorico: number
  cuotasPagadasHistorico: number
  montoMoraHistorico: number
  diasMoraHistorico: number
  diasTranscurridos: number
  plazoTotalDias: number
  diasExcedidos: number
  estadoPlazo: string
  congelado: boolean
  fechaSolicitud: string
  fechaDesembolso: string | null
  fechaVencimiento: string | null
  fechaCancelacionReal: string | null
  existiaEnT: boolean
  eventosHastaT: number
  pagosHastaT: number
}

interface CarteraHistorica {
  fechaCorte: string
  totalPrestamosExistentes: number
  creditosActivos: number
  creditosDentroPlazo: number
  creditosPlazoCumplido: number
  creditosExcedidos: number
  creditosCancelados: number
  creditosEnMora: number
  creditosJuridico: number
  creditosSolicitud: number
  carteraPendiente: number
  carteraActiva: number
  carteraMora: number
  capitalPrestado: number
  dineroRecuperado: number
  prestamos: PrestamoHistorico[]
  advertencias: string[]
}

interface EventoTimeline {
  id: string
  prestamoId: string
  prestamoCodigo: string
  clienteId?: string
  clienteNombre?: string
  fecha: string
  hora: string
  tipo: string
  tipoDisplay: string
  icono: string
  titulo: string
  descripcion: string
  monto?: number
  usuarioNombre?: string
  metadata?: Record<string, any>
}

// =====================================================
// Helpers
// =====================================================
function fmt(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(d)
}

function fmtLargo(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(d)
}

function fechaInput(d: Date): string {
  // YYYY-MM-DD en hora Colombia
  const y = d.toLocaleString('en-US', { timeZone: 'America/Bogota', year: 'numeric' })
  const m = d.toLocaleString('en-US', { timeZone: 'America/Bogota', month: '2-digit' })
  const day = d.toLocaleString('en-US', { timeZone: 'America/Bogota', day: '2-digit' })
  return `${y}-${m}-${day}`
}

function fechaCortaCol(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(d)
}

const ESTADO_PLAZO_COLORS: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  DENTRO:      { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Dentro del plazo', emoji: '🟢' },
  CUMPLIDO:    { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', label: 'Plazo cumplido', emoji: '🟡' },
  EXCEDIDO:    { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', label: 'Excedido', emoji: '🔴' },
  CANCELADO:   { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', label: 'Cancelado', emoji: '🔵' },
  NO_APLICA:   { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', label: 'No aplica', emoji: '⚪' },
}

const ESTADO_HISTORICO_COLORS: Record<string, string> = {
  ACTIVO: 'bg-emerald-500',
  EN_MORA: 'bg-orange-500',
  JURIDICO: 'bg-red-600',
  CANCELADO: 'bg-blue-500',
  SOLICITUD: 'bg-slate-400',
  PENDIENTE_ACEPTACION: 'bg-yellow-400',
  RECHAZADO: 'bg-rose-700',
  NO_EXISTIA: 'bg-slate-300',
}

// =====================================================
// Componente principal
// =====================================================
export function LineaTiempoView() {
  const [tab, setTab] = useState<'cartera' | 'cliente'>('cartera')
  const [fecha, setFecha] = useState<string>(fechaInput(new Date()))
  const [modo, setModo] = useState<'PRESENTE' | 'HISTORICO'>('PRESENTE')
  const [cartera, setCartera] = useState<CarteraHistorica | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado de reproducción
  const [playing, setPlaying] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Modal de comparación
  const [showComparar, setShowComparar] = useState(false)
  // Modal de crédito seleccionado
  const [prestamoSel, setPrestamoSel] = useState<string | null>(null)
  // Modal de cliente seleccionado
  const [clienteSel, setClienteSel] = useState<string | null>(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')

  // === Cargar cartera cuando cambia la fecha ===
  const cargarCartera = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/linea-tiempo/cartera?fecha=${fecha}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCartera(data)
      setModo(data.modo || 'PRESENTE')
    } catch (e: any) {
      setError(e?.message || 'Error cargando cartera')
    } finally {
      setLoading(false)
    }
  }, [fecha])

  useEffect(() => {
    const t = setTimeout(cargarCartera, 300) // debounce
    return () => clearTimeout(t)
  }, [cargarCartera])

  // === Modo reproducción ===
  useEffect(() => {
    if (playing) {
      playIntervalRef.current = setInterval(() => {
        setFecha(prev => {
          const d = new Date(prev + 'T12:00:00')
          d.setDate(d.getDate() + 1)
          return fechaInput(d)
        })
      }, 1500 / velocidad)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [playing, velocidad])

  // === Helpers de navegación temporal ===
  const volverAlPresente = () => {
    setPlaying(false)
    setFecha(fechaInput(new Date()))
  }
  const avanzarDia = (delta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFecha(fechaInput(d))
  }
  const avanzarSemana = (delta: number) => avanzarDia(delta * 7)
  const avanzarMes = (delta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setFecha(fechaInput(d))
  }

  // === Filtro de solicitudes ===
  const prestamosFiltrados = useMemo(() => {
    if (!cartera) return []
    return cartera.prestamos.filter(p => {
      if (filtroBusqueda) {
        const q = filtroBusqueda.toLowerCase()
        if (!p.codigo.toLowerCase().includes(q) &&
            !p.clienteNombre.toLowerCase().includes(q) &&
            !p.clienteCedula.toLowerCase().includes(q)) return false
      }
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'activos' && !['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(p.estadoHistorico)) return false
        if (filtroEstado === 'dentro' && p.estadoPlazo !== 'DENTRO') return false
        if (filtroEstado === 'cumplido' && p.estadoPlazo !== 'CUMPLIDO') return false
        if (filtroEstado === 'excedidos' && p.estadoPlazo !== 'EXCEDIDO') return false
        if (filtroEstado === 'cancelados' && p.estadoHistorico !== 'CANCELADO') return false
        if (filtroEstado === 'mora' && !['EN_MORA', 'JURIDICO'].includes(p.estadoHistorico)) return false
      }
      return true
    })
  }, [cartera, filtroEstado, filtroBusqueda])

  // === Guardar fotografía ===
  const guardarFotografia = async () => {
    const nombre = window.prompt('Nombre de la fotografía histórica:', `Corte ${fmtLargo(fecha)}`)
    if (!nombre) return
    try {
      const res = await fetch('/api/linea-tiempo/fotografias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, nombre, descripcion: 'Generado desde Línea de Tiempo 360°' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      alert('📸 Fotografía histórica guardada correctamente')
    } catch (e: any) {
      alert('Error guardando fotografía: ' + e.message)
    }
  }

  const fechaActual = new Date(fecha + 'T12:00:00')
  const esHoy = fechaInput(new Date()) === fecha

  return (
    <div className="space-y-6 relative">
      {/* Fondo decorativo premium */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-amber-500/10 via-pink-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* === ENCABEZADO PREMIUM === */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-black p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.03)_50%,transparent_75%)] bg-[length:250px_250px] animate-[shimmer_8s_infinite]" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-300 text-sm font-medium mb-2">
              <Sparkles className="w-4 h-4" />
              <span>SOLICITUDES</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white/70">Línea de tiempo 360°</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
              🕰️ Línea de Tiempo 360°
            </h1>
            <p className="mt-2 text-white/70 italic text-sm sm:text-base">
              "Viaja al pasado. Descubre qué ocurrió. Entiende cómo llegó tu cartera hasta hoy."
            </p>
            <p className="mt-1 text-white/50 text-xs sm:text-sm">
              Cartera completa, clientes y créditos. Todo tu historial, en una sola línea de tiempo.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {modo === 'HISTORICO' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs sm:text-sm font-medium animate-pulse">
                <Clock className="w-4 h-4" />
                ESTÁS VIAJANDO EN EL TIEMPO
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ESTÁS EN EL PRESENTE
              </div>
            )}
            <div className="text-2xl sm:text-3xl font-bold tabular-nums">
              {fmtLargo(fechaActual)}
            </div>
            {!esHoy && (
              <button
                onClick={volverAlPresente}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al presente
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === PESTAÑAS === */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setTab('cartera')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            tab === 'cartera'
              ? 'border-violet-500 text-violet-700 dark:text-violet-300'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          🏦 Cartera Completa
        </button>
        <button
          onClick={() => setTab('cliente')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            tab === 'cliente'
              ? 'border-violet-500 text-violet-700 dark:text-violet-300'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          👤 Por Cliente
        </button>
      </div>

      {/* === CONTENIDO === */}
      {tab === 'cartera' && cartera && (
        <>
          {/* Selector de fecha + controles */}
          <FechaSelector
            fecha={fecha}
            setFecha={setFecha}
            modo={modo}
            esHoy={esHoy}
            onAvanzarDia={avanzarDia}
            onAvanzarSemana={avanzarSemana}
            onAvanzarMes={avanzarMes}
            onVolverAlPresente={volverAlPresente}
            playing={playing}
            setPlaying={setPlaying}
            velocidad={velocidad}
            setVelocidad={setVelocidad}
            onGuardarFotografia={guardarFotografia}
            onShowComparar={() => setShowComparar(true)}
          />

          {/* KPIs históricos */}
          <DashboardHistorico cartera={cartera} loading={loading} />

          {/* Advertencias */}
          {cartera.advertencias && cartera.advertencias.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 text-amber-800 dark:text-amber-200 text-sm">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Información histórica no disponible</p>
                  {cartera.advertencias.map((a, i) => (
                    <p key={i} className="text-xs">{a}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filtros + tabla de créditos */}
          <ListaPrestamosHistoricos
            prestamos={prestamosFiltrados}
            total={cartera.prestamos.length}
            filtroEstado={filtroEstado}
            setFiltroEstado={setFiltroEstado}
            filtroBusqueda={filtroBusqueda}
            setFiltroBusqueda={setFiltroBusqueda}
            onSelectPrestamo={setPrestamoSel}
            onSelectCliente={setClienteSel}
            modo={modo}
          />
        </>
      )}

      {tab === 'cliente' && (
        <BuscadorClientesHistorico onSelectCliente={setClienteSel} />
      )}

      {/* === MODALES === */}
      {prestamoSel && (
        <PrestamoTimelineModal
          prestamoId={prestamoSel}
          fechaCorte={fecha}
          onClose={() => setPrestamoSel(null)}
          onSelectCliente={(cid) => {
            setPrestamoSel(null)
            setClienteSel(cid)
          }}
        />
      )}

      {clienteSel && (
        <ClienteTimelineModal
          clienteId={clienteSel}
          fechaCorte={fecha}
          onClose={() => setClienteSel(null)}
          onSelectPrestamo={(pid) => {
            setClienteSel(null)
            setPrestamoSel(pid)
          }}
        />
      )}

      {showComparar && (
        <CompararModal onClose={() => setShowComparar(false)} />
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg bg-red-600 text-white text-sm shadow-lg">
          {error}
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -250px 0; }
          100% { background-position: 250px 0; }
        }
      `}</style>
    </div>
  )
}

// =====================================================
// Selector de fecha + controles de reproducción
// =====================================================
function FechaSelector(props: {
  fecha: string
  setFecha: (s: string) => void
  modo: string
  esHoy: boolean
  onAvanzarDia: (n: number) => void
  onAvanzarSemana: (n: number) => void
  onAvanzarMes: (n: number) => void
  onVolverAlPresente: () => void
  playing: boolean
  setPlaying: (b: boolean) => void
  velocidad: number
  setVelocidad: (n: number) => void
  onGuardarFotografia: () => void
  onShowComparar: () => void
}) {
  const {
    fecha, setFecha, modo, esHoy,
    onAvanzarDia, onAvanzarSemana, onAvanzarMes, onVolverAlPresente,
    playing, setPlaying, velocidad, setVelocidad,
    onGuardarFotografia, onShowComparar,
  } = props

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha de visualización</span>
        </div>
        <input
          type="date"
          value={fecha}
          max={fechaInput(new Date())}
          onChange={(e) => setFecha(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
        />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {fmtLargo(new Date(fecha + 'T12:00:00'))}
        </span>
      </div>

      {/* Controles de navegación temporal */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => onAvanzarMes(-1)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all" title="Retroceder 1 mes">
            ⏮ 1m
          </button>
          <button onClick={() => onAvanzarSemana(-1)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all" title="Retroceder 1 semana">
            ◀ 1s
          </button>
          <button onClick={() => onAvanzarDia(-1)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all" title="Retroceder 1 día">
            -1d
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            disabled={esHoy && !playing}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              playing
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={playing ? 'Pausar' : 'Reproducir'}
          >
            {playing ? <><Pause className="w-3 h-3" /> Pausar</> : <><Play className="w-3 h-3" /> Reproducir</>}
          </button>
          <button onClick={() => onAvanzarDia(1)} disabled={esHoy} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Avanzar 1 día">
            +1d
          </button>
          <button onClick={() => onAvanzarSemana(1)} disabled={esHoy} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Avanzar 1 semana">
            1s ▶
          </button>
          <button onClick={() => onAvanzarMes(1)} disabled={esHoy} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Avanzar 1 mes">
            1m ⏭
          </button>
        </div>

        {/* Velocidad */}
        {playing && (
          <div className="flex items-center gap-1 ml-1">
            <span className="text-xs text-slate-500">Velocidad:</span>
            {[0.5, 1, 2, 5, 10].map(v => (
              <button
                key={v}
                onClick={() => setVelocidad(v)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  velocidad === v ? 'bg-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {v}x
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {!esHoy && (
          <button
            onClick={onVolverAlPresente}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-all flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al presente
          </button>
        )}

        <button
          onClick={onShowComparar}
          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-all flex items-center gap-1"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          🔍 ¿Qué cambió?
        </button>

        <button
          onClick={onGuardarFotografia}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium transition-all flex items-center gap-1"
        >
          <Camera className="w-3.5 h-3.5" />
          📸 Guardar fotografía
        </button>
      </div>
    </div>
  )
}

// =====================================================
// Dashboard histórico (KPIs)
// =====================================================
function DashboardHistorico({ cartera, loading }: { cartera: CarteraHistorica; loading: boolean }) {
  const kpis = [
    { label: 'Cartera pendiente', value: formatCOP(cartera.carteraPendiente), icon: TrendingUp, color: 'from-violet-500 to-purple-600', textColor: 'text-white' },
    { label: 'Créditos activos', value: cartera.creditosActivos.toString(), icon: CreditCard, color: 'from-emerald-500 to-teal-600', textColor: 'text-white' },
    { label: '🟢 Dentro del plazo', value: cartera.creditosDentroPlazo.toString(), icon: Activity, color: 'from-green-500 to-emerald-600', textColor: 'text-white' },
    { label: '🟡 Plazo cumplido', value: cartera.creditosPlazoCumplido.toString(), icon: Clock, color: 'from-yellow-400 to-amber-500', textColor: 'text-white' },
    { label: '🔴 Excedidos', value: cartera.creditosExcedidos.toString(), icon: AlertTriangle, color: 'from-red-500 to-rose-600', textColor: 'text-white' },
    { label: '🔵 Cancelados', value: cartera.creditosCancelados.toString(), icon: CheckIcon, color: 'from-blue-500 to-indigo-600', textColor: 'text-white' },
    { label: 'Capital prestado', value: formatCOP(cartera.capitalPrestado), icon: Building2, color: 'from-slate-600 to-slate-800', textColor: 'text-white' },
    { label: 'Dinero recuperado', value: formatCOP(cartera.dineroRecuperado), icon: TrendingUp, color: 'from-cyan-500 to-blue-600', textColor: 'text-white' },
  ]

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${kpi.color} p-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] ${kpi.textColor}`}
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <kpi.icon className="w-4 h-4 opacity-80" />
            </div>
            <div className="text-xs font-medium opacity-90">{kpi.label}</div>
            <div className="text-lg sm:text-xl font-bold mt-1 tabular-nums">{kpi.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CheckIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><polyline points="20 6 9 17 4 12" /></svg>
}

// =====================================================
// Lista de solicitudes históricos
// =====================================================
function ListaPrestamosHistoricos(props: {
  prestamos: PrestamoHistorico[]
  total: number
  filtroEstado: string
  setFiltroEstado: (s: string) => void
  filtroBusqueda: string
  setFiltroBusqueda: (s: string) => void
  onSelectPrestamo: (id: string) => void
  onSelectCliente: (id: string) => void
  modo: string
}) {
  const {
    prestamos, total, filtroEstado, setFiltroEstado,
    filtroBusqueda, setFiltroBusqueda,
    onSelectPrestamo, onSelectCliente, modo,
  } = props

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Créditos en la fecha seleccionada
        </h3>
        <span className="text-xs text-slate-500">
          Mostrando {prestamos.length} de {total} créditos
        </span>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="🔍 Buscar por código, cliente o cédula..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-full sm:w-72"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="dentro">Dentro del plazo</option>
          <option value="cumplido">Plazo cumplido</option>
          <option value="excedidos">Excedidos</option>
          <option value="cancelados">Cancelados</option>
          <option value="mora">En mora / Jurídico</option>
        </select>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
            <tr className="text-left text-slate-600 dark:text-slate-300">
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium text-right">Monto</th>
              <th className="px-3 py-2 font-medium text-right">Saldo</th>
              <th className="px-3 py-2 font-medium text-center">Conteo</th>
              <th className="px-3 py-2 font-medium text-center">Estado</th>
              <th className="px-3 py-2 font-medium text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {prestamos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                  No hay créditos que coincidan con los filtros en la fecha seleccionada.
                </td>
              </tr>
            )}
            {prestamos.map(p => {
              const ep = ESTADO_PLAZO_COLORS[p.estadoPlazo] || ESTADO_PLAZO_COLORS.NO_APLICA
              const eh = ESTADO_HISTORICO_COLORS[p.estadoHistorico] || 'bg-slate-400'
              return (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => onSelectPrestamo(p.id)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{p.codigo}</div>
                    <div className="text-[10px] text-slate-400">{p.frecuencia.toLowerCase()}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{p.clienteNombre}</div>
                    <div className="text-[10px] text-slate-400">{p.clienteCedula}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    ${p.montoPrincipal.toLocaleString('es-CO')}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      ${p.saldoTotalHistorico.toLocaleString('es-CO')}
                    </div>
                    {p.montoMoraHistorico > 0 && (
                      <div className="text-[10px] text-red-500">+${p.montoMoraHistorico.toLocaleString('es-CO')} mora</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {p.estadoPlazo !== 'NO_APLICA' ? (
                      <div>
                        <div className="text-xs font-bold tabular-nums">
                          {p.diasTranscurridos}/{p.plazoTotalDias}
                        </div>
                        {p.diasExcedidos > 0 && (
                          <div className="text-[10px] text-red-500">+{p.diasExcedidos}d</div>
                        )}
                        {p.congelado && (
                          <div className="text-[10px] text-blue-500 italic">congelado</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${eh}`}>
                        {p.estadoHistorico}
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ep.bg} ${ep.text}`}>
                        {ep.emoji} {ep.label}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectPrestamo(p.id) }}
                        className="px-2 py-1 rounded text-xs bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-800/40 text-violet-700 dark:text-violet-300 font-medium transition-all"
                      >
                        Ver crédito
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectCliente(p.clienteId) }}
                        className="px-2 py-1 rounded text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-all"
                      >
                        Cliente
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =====================================================
// Modal: Línea de tiempo de un solicitud
// =====================================================
function PrestamoTimelineModal(props: {
  prestamoId: string
  fechaCorte: string
  onClose: () => void
  onSelectCliente: (id: string) => void
}) {
  const { prestamoId, fechaCorte, onClose, onSelectCliente } = props
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'eventos' | 'detalle' | 'que-cambio'>('eventos')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/linea-tiempo/prestamo/${prestamoId}?fecha=${fechaCorte}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setLoading(false); console.error(e) } })
    return () => { cancelled = true }
  }, [prestamoId, fechaCorte])

  return (
    <Modal onClose={onClose} title="💳 Vida del Crédito" subtitle={data?.prestamo?.codigo}>
      {loading ? (
        <Loading />
      ) : data?.success ? (
        <div className="space-y-4">
          {/* Header del crédito */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  {data.prestamo.clienteNombre}
                </h3>
                <p className="text-sm text-slate-500">CC: {data.prestamo.clienteCedula}</p>
                <button
                  onClick={() => onSelectCliente(data.prestamo.clienteId)}
                  className="mt-2 text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  Ver hoja de vida del cliente →
                </button>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  ${data.prestamo.saldoTotalHistorico.toLocaleString('es-CO')}
                </div>
                <div className="text-xs text-slate-500">Saldo al {fmt(fechaCorte)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Stat label="Monto" value={`$${data.prestamo.montoPrincipal.toLocaleString('es-CO')}`} />
              <Stat label="Pagado" value={`$${data.prestamo.montoPagadoHistorico.toLocaleString('es-CO')}`} />
              <Stat label="Cuotas" value={`${data.prestamo.cuotasPagadasHistorico}/${data.prestamo.numeroCuotas}`} />
              <Stat label="Conteo" value={`${data.prestamo.diasTranscurridos}/${data.prestamo.plazoTotalDias} días`} />
            </div>
            {data.prestamo.congelado && (
              <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs">
                🔵 Conteo detenido por cancelación. Fecha real de cancelación: {fmt(data.prestamo.fechaCancelacionReal)}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {(['eventos', 'detalle', 'que-cambio'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 ${
                  tab === t ? 'border-violet-500 text-violet-700 dark:text-violet-300' : 'border-transparent text-slate-500'
                }`}
              >
                {t === 'eventos' ? '📋 Eventos' : t === 'detalle' ? '📊 Detalle' : '🔍 ¿Qué cambió?'}
              </button>
            ))}
          </div>

          {tab === 'eventos' && (
            <div className="max-h-[400px] overflow-y-auto">
              <TimelineEventos eventos={data.eventos || []} onSelectFecha={() => {}} />
            </div>
          )}

          {tab === 'detalle' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetalleItem label="Estado histórico" value={data.prestamo.estadoHistorico} />
                <DetalleItem label="Estado del plazo" value={data.prestamo.estadoPlazo} />
                <DetalleItem label="Frecuencia" value={data.prestamo.frecuencia} />
                <DetalleItem label="Tasa anual" value={`${data.prestamo.tasaInteresAnual}%`} />
                <DetalleItem label="Días mora" value={`${data.prestamo.diasMoraHistorico}`} />
                <DetalleItem label="Monto mora" value={`$${data.prestamo.montoMoraHistorico.toLocaleString('es-CO')}`} />
                <DetalleItem label="Fecha desembolso" value={data.prestamo.fechaDesembolso ? fmt(data.prestamo.fechaDesembolso) : 'N/A'} />
                <DetalleItem label="Fecha vencimiento" value={data.prestamo.fechaVencimiento ? fmt(data.prestamo.fechaVencimiento) : 'N/A'} />
              </div>
            </div>
          )}

          {tab === 'que-cambio' && data.primerCambio && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${
                data.primerCambio.tipo === 'SIN_CAMBIOS'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      {data.primerCambio.titulo}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {data.primerCambio.descripcion}
                    </p>
                  </div>
                </div>
              </div>
              {data.primerCambio.evidenciaAdicional?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Evidencia posterior</p>
                  <div className="space-y-1.5">
                    {data.primerCambio.evidenciaAdicional.map((ev: any, i: number) => (
                      <div key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="font-mono text-slate-400">Día {ev.dia}</span>
                        <span>•</span>
                        <span>{ev.titulo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[10px] text-slate-400 italic mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                ℹ️ Análisis basado en datos reales de pagos registrados. No es una inferencia probabilística.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-red-500 p-4">{data?.error || 'Error cargando crédito'}</div>
      )}
    </Modal>
  )
}

// =====================================================
// Modal: Línea de tiempo de un cliente
// =====================================================
function ClienteTimelineModal(props: {
  clienteId: string
  fechaCorte: string
  onClose: () => void
  onSelectPrestamo: (id: string) => void
}) {
  const { clienteId, fechaCorte, onClose, onSelectPrestamo } = props
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/linea-tiempo/cliente/${clienteId}?fecha=${fechaCorte}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setLoading(false); console.error(e) } })
    return () => { cancelled = true }
  }, [clienteId, fechaCorte])

  return (
    <Modal onClose={onClose} title="👤 Hoja de Vida Histórica" subtitle={data?.cliente?.nombre}>
      {loading ? (
        <Loading />
      ) : data?.success ? (
        <div className="space-y-4">
          {/* Resumen del cliente */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Total solicitudes" value={data.estadisticas.totalPrestamos.toString()} />
            <Stat label="Activos" value={data.estadisticas.prestamosActivos.toString()} />
            <Stat label="Cancelados" value={data.estadisticas.prestamosCanceladosHistorico.toString()} />
            <Stat label="En mora" value={data.estadisticas.prestamosEnMora.toString()} />
            <Stat label="Total prestado" value={`$${Math.round(data.estadisticas.totalPrestadoHistorico).toLocaleString('es-CO')}`} />
            <Stat label="Total pagado" value={`$${Math.round(data.estadisticas.totalPagadoHistorico).toLocaleString('es-CO')}`} />
            <Stat label="Saldo actual" value={`$${Math.round(data.estadisticas.saldoActualHistorico).toLocaleString('es-CO')}`} />
            <Stat label="Puntualidad" value={`${data.estadisticas.puntualidad}%`} />
          </div>

          {/* Nivel de riesgo */}
          <div className={`p-3 rounded-lg border ${
            data.comportamiento.nivelRiesgo === 'ALTO' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' :
            data.comportamiento.nivelRiesgo === 'MEDIO' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' :
            'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>Nivel de riesgo histórico: <strong>{data.comportamiento.nivelRiesgo}</strong></span>
              <span className="text-xs">· Promedio días atraso: {data.comportamiento.promedioDiasAtraso}</span>
            </div>
          </div>

          {/* Solicitudes del cliente */}
          <div>
            <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-2">
              Créditos al {fmt(fechaCorte)}
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.prestamos.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  El cliente no tenía créditos en esta fecha.
                </p>
              )}
              {data.prestamos.map((p: PrestamoHistorico) => {
                const ep = ESTADO_PLAZO_COLORS[p.estadoPlazo] || ESTADO_PLAZO_COLORS.NO_APLICA
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectPrestamo(p.id)}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">{p.codigo}</div>
                        <div className="text-xs text-slate-500">
                          ${p.montoPrincipal.toLocaleString('es-CO')} · Saldo: ${p.saldoTotalHistorico.toLocaleString('es-CO')}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${ESTADO_HISTORICO_COLORS[p.estadoHistorico] || 'bg-slate-400'}`}>
                          {p.estadoHistorico}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ep.bg} ${ep.text}`}>
                          {ep.emoji}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Línea de tiempo de eventos */}
          {data.eventos?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-2">
                Eventos al {fmt(fechaCorte)}
              </h4>
              <div className="max-h-[300px] overflow-y-auto">
                <TimelineEventos eventos={data.eventos} onSelectFecha={() => {}} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-red-500 p-4">{data?.error || 'Error cargando cliente'}</div>
      )}
    </Modal>
  )
}

// =====================================================
// Buscador de clientes (tab "Por Cliente")
// =====================================================
function BuscadorClientesHistorico({ onSelectCliente }: { onSelectCliente: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.length < 2) {
      setResultados([])
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/clientes?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : (d.clientes || d.data || [])
          setResultados(list)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Búsqueda de cliente</h3>
        </div>
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nombre, cédula, teléfono o código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
        />
        {loading && <p className="mt-2 text-xs text-slate-500">Buscando...</p>}
        {resultados.length > 0 && (
          <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
            {resultados.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onSelectCliente(c.id)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{c.nombre}</div>
                    <div className="text-xs text-slate-500">CC: {c.cedula} · {c.telefono}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
        {q.length >= 2 && !loading && resultados.length === 0 && (
          <p className="mt-4 text-sm text-slate-400 text-center">No se encontraron clientes.</p>
        )}
      </div>
    </div>
  )
}

// =====================================================
// Modal comparar fechas
// =====================================================
function CompararModal({ onClose }: { onClose: () => void }) {
  const hoy = fechaInput(new Date())
  const hace3meses = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return fechaInput(d)
  })()
  const [fechaA, setFechaA] = useState(hace3meses)
  const [fechaB, setFechaB] = useState(hoy)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const comparar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/linea-tiempo/comparar?fechaA=${fechaA}&fechaB=${fechaB}`)
      const d = await res.json()
      setData(d)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (fechaA && fechaB) comparar()
  }, [fechaA, fechaB])

  return (
    <Modal onClose={onClose} title="🔍 ¿Qué cambió?" subtitle="Comparación entre dos fechas">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha A</label>
            <input type="date" value={fechaA} max={hoy} onChange={(e) => setFechaA(e.target.value)} className="block px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha B</label>
            <input type="date" value={fechaB} max={hoy} onChange={(e) => setFechaB(e.target.value)} className="block px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
          </div>
        </div>

        {loading && <Loading />}

        {!loading && data?.success && (
          <>
            {/* Comparación de KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CompararKPI
                label="Créditos activos"
                valorA={data.metricasA.creditosActivos}
                valorB={data.metricasB.creditosActivos}
                formato="entero"
              />
              <CompararKPI
                label="Cartera pendiente"
                valorA={data.metricasA.carteraPendiente}
                valorB={data.metricasB.carteraPendiente}
                formato="pesos"
              />
              <CompararKPI
                label="Créditos excedidos"
                valorA={data.metricasA.creditosExcedidos}
                valorB={data.metricasB.creditosExcedidos}
                formato="entero"
              />
              <CompararKPI
                label="Créditos cancelados"
                valorA={data.metricasA.creditosCancelados}
                valorB={data.metricasB.creditosCancelados}
                formato="entero"
              />
            </div>

            {/* Desglose del cambio en cartera */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-3">
                Desglose del cambio en cartera pendiente
              </h4>
              <div className="space-y-2 text-sm">
                <LineaDesglose label="Nuevos desembolsos" valor={data.desgloseCambios.nuevosDesembolsos} signo="+" color="emerald" />
                <LineaDesglose label="Pagos recibidos" valor={-data.desgloseCambios.pagosRecibidos} signo="−" color="blue" />
                <LineaDesglose label="Créditos cancelados (n)" valor={data.desgloseCambios.creditosCancelados.length} signo="" color="slate" />
                <LineaDesglose label="Nuevos créditos (n)" valor={data.desgloseCambios.nuevosCreditos.length} signo="+" color="emerald" />
              </div>
            </div>

            {/* Ver origen: créditos que pasaron a excedidos */}
            {data.desgloseCambios.creditsExcedidos.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-950/30">
                <h4 className="font-semibold text-sm text-red-700 dark:text-red-300 mb-2">
                  🔎 Ver origen — Créditos que pasaron a EXCEDIDO ({data.desgloseCambios.creditsExcedidos.length})
                </h4>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {data.desgloseCambios.creditsExcedidos.map((c: any) => (
                    <div key={c.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="font-mono">{c.codigo}</span>
                      <span>{c.cliente}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ver origen: créditos cancelados */}
            {data.desgloseCambios.creditosCancelados.length > 0 && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-4 bg-blue-50 dark:bg-blue-950/30">
                <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-2">
                  🔎 Ver origen — Créditos cancelados en el periodo ({data.desgloseCambios.creditosCancelados.length})
                </h4>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {data.desgloseCambios.creditosCancelados.map((c: any) => (
                    <div key={c.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="font-mono">{c.codigo}</span>
                      <span>{c.cliente}</span>
                      <span className="text-blue-600 dark:text-blue-400">−${c.saldoCancelado.toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function CompararKPI({ label, valorA, valorB, formato }: { label: string; valorA: number; valorB: number; formato: 'entero' | 'pesos' }) {
  const diff = valorB - valorA
  const pct = valorA !== 0 ? (diff / valorA) * 100 : 0
  const fmtVal = formato === 'pesos' ? (n: number) => `$${Math.round(n).toLocaleString('es-CO')}` : (n: number) => n.toString()
  const signo = diff > 0 ? '+' : ''
  const esPositivo = diff > 0
  const esNegativo = diff < 0

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-slate-500 line-through tabular-nums">{fmtVal(valorA)}</span>
        <ArrowRightIcon className="w-3 h-3 text-slate-400" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">{fmtVal(valorB)}</span>
      </div>
      <div className={`text-sm font-semibold mt-1 ${esPositivo ? 'text-emerald-600 dark:text-emerald-400' : esNegativo ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
        {signo}{fmtVal(diff)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
      </div>
    </div>
  )
}

function ArrowRight(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
}

function LineaDesglose({ label, valor, signo, color }: { label: string; valor: number; signo: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    slate: 'text-slate-600 dark:text-slate-400',
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`font-semibold tabular-nums ${colors[color]}`}>
        {signo}{typeof valor === 'number' && Math.abs(valor) > 1000 ? `$${Math.round(valor).toLocaleString('es-CO')}` : valor}
      </span>
    </div>
  )
}

// =====================================================
// Componente: Timeline de eventos (vertical)
// =====================================================
function TimelineEventos({ eventos, onSelectFecha }: { eventos: EventoTimeline[]; onSelectFecha: (fecha: Date) => void }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No hay eventos registrados en esta fecha.</p>
  }

  // Agrupar por día
  const porDia = new Map<string, EventoTimeline[]>()
  for (const ev of eventos) {
    const dia = new Date(ev.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
    if (!porDia.has(dia)) porDia.set(dia, [])
    porDia.get(dia)!.push(ev)
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500 via-slate-300 to-transparent dark:via-slate-700" />
      {Array.from(porDia.entries()).map(([dia, evs]) => (
        <div key={dia} className="relative mb-4">
          <div className="absolute -left-[18px] w-4 h-4 rounded-full bg-violet-500 border-2 border-white dark:border-slate-900 shadow" />
          <div className="ml-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{dia}</div>
            <div className="space-y-2">
              {evs.map(ev => (
                <div
                  key={ev.id}
                  className="group p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all cursor-pointer"
                  onClick={() => onSelectFecha(new Date(ev.fecha))}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{ev.icono}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ev.titulo}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{ev.hora}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{ev.descripcion}</p>
                      {ev.usuarioNombre && (
                        <p className="text-[10px] text-slate-400 mt-0.5">por {ev.usuarioNombre}</p>
                      )}
                    </div>
                    {ev.monto !== undefined && ev.monto !== 0 && (
                      <span className={`text-xs font-semibold tabular-nums ${ev.monto > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {ev.monto > 0 ? '+' : ''}{ev.monto > 0 ? `$${ev.monto.toLocaleString('es-CO')}` : `-$${Math.abs(ev.monto).toLocaleString('es-CO')}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// Componentes auxiliares
// =====================================================
function Modal({ children, onClose, title, subtitle }: { children: React.ReactNode; onClose: () => void; title: string; subtitle?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 font-mono">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
    </div>
  )
}

function DetalleItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
