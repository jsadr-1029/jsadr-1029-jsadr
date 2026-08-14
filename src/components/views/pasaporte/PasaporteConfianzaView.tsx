'use client'

// =====================================================
// 🏆 PASAPORTE DE CONFIANZA — Componente principal
// =====================================================
// Convierte el comportamiento de pago del cliente en una
// trayectoria visible, dinámica y motivadora.
//
// "CADA PAGO CONSTRUYE TU SIGUIENTE OPORTUNIDAD."
// =====================================================

import { useState, useEffect } from 'react'
import {
  Trophy, TrendingUp, CreditCard, Target, Sparkles, Clock,
  AlertCircle, MessageCircle, Calendar, CheckCircle2, Lock,
  RefreshCw, Award, History, ChevronRight, Info, Zap, Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/shared/ui'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCOP, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { CompromisoModal, ActualizarSituacionModal } from './compromiso-modal'
import { RenovacionModal } from './renovacion-modal'
import { TrayectoriaTimeline, HistorialPagosModal } from './trayectoria'

type PasaporteData = {
  cliente: { id: string; nombre: string; cedula: string }
  indicadores: {
    pagosPuntuales: number
    pagosAnticipados: number
    pagosPosteriores: number
    pagosTotales: number
    creditosCompletados: number
    creditosActivos: number
    creditosTotales: number
    cumplimientoHistorico: number
    antiguedadMeses: number
    antiguedadLegible: string
  }
  nivel: {
    actual: string
    etiqueta: string
    color: string
    emoji: string
    descripcion: string
    mensaje: string
  }
  creditoActual: any | null
  proximaMeta: any | null
  loQueEstasConstruyendo: {
    elegibleRenovacion: boolean
    razonesElegibilidad: string[]
    razonesBloqueo: string[]
    mensaje: string
    opcionesDisponibles: string[]
  }
  trayectoria: {
    totalCreditos: number
    completados: number
    activos: number
    totalPagos: number
    creditos: any[]
  }
  compromisos: {
    registrados: number
    cumplidos: number
    pendientes: number
    incumplidos: number
    cumplimiento: number
  }
  novedades: any[]
  notificaciones: any[]
  generadoEn: string
}

export function PasaporteConfianzaView({ token }: { token: string }) {
  const [data, setData] = useState<PasaporteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [compromisoModalOpen, setCompromisoModalOpen] = useState(false)
  const [actualizarModalOpen, setActualizarModalOpen] = useState(false)
  const [renovacionModalOpen, setRenovacionModalOpen] = useState(false)
  const [novedadSeleccionada, setNovedadSeleccionada] = useState<any | null>(null)
  const [historialPagosPrestamo, setHistorialPagosPrestamo] = useState<any | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/portal/pasaporte?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data)
        else toast.error(d.error || 'No se pudo cargar el pasaporte')
      })
      .catch(e => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [token, refreshKey])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gradient-to-r from-violet-200 to-blue-200 rounded-2xl" />
          <div className="h-24 bg-slate-200 rounded-xl" />
          <div className="h-48 bg-slate-200 rounded-xl" />
        </div>
        <p className="text-center text-sm text-slate-500">Cargando tu Pasaporte de Confianza...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">No se pudo cargar tu Pasaporte de Confianza.</p>
        <Button variant="outline" className="mt-3" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reintentar
        </Button>
      </Card>
    )
  }

  const nombreArr = data.cliente.nombre.split(' ')
  const primerNombre = nombreArr[0] || 'Amigo'

  const novedadesCount = data.novedades.filter(n => n.tipo === 'PAGO_EXCEDIDO' || n.tipo === 'COMPROMISO_VENCIDO').length

  return (
    <div className="space-y-6 pb-8">
      {/* === ENCABEZADO PREMIUM === */}
      <HeaderPasaporte
        nombreCliente={primerNombre}
        nivel={data.nivel}
        cumplimiento={data.indicadores.cumplimientoHistorico}
      />

      {/* === ESTADO GENERAL + INDICADORES === */}
      <EstadoGeneral indicadores={data.indicadores} nivel={data.nivel} />

      {/* === NOTIFICACIONES Y NOVEDADES === */}
      {data.notificaciones.length > 0 && (
        <NotificacionesPanel
          notificaciones={data.notificaciones}
          onInformar={(n) => {
            setNovedadSeleccionada(n)
            setCompromisoModalOpen(true)
          }}
        />
      )}

      {/* === CRÉDITO ACTUAL === */}
      {data.creditoActual && (
        <CreditoActualCard credito={data.creditoActual} />
      )}

      {/* === PRÓXIMA META === */}
      {data.proximaMeta && (
        <ProximaMetaCard meta={data.proximaMeta} />
      )}

      {/* === LO QUE ESTÁS CONSTRUYENDO === */}
      <LoQueEstasConstruyendoCard
        data={data.loQueEstasConstruyendo}
        onExplorarRenovacion={() => setRenovacionModalOpen(true)}
        valorActual={data.creditoActual?.montoPrincipal || 0}
      />

      {/* === COMPROMISOS === */}
      <CompromisosCard compromisos={data.compromisos} />

      {/* === TRAYECTORIA HISTÓRICA === */}
      <TrayectoriaCard
        trayectoria={data.trayectoria}
        onVerPagos={(credito) => setHistorialPagosPrestamo(credito)}
      />

      {/* === MENSAJE FINAL INSPIRADOR === */}
      <Card className="bg-gradient-to-br from-violet-600 via-purple-600 to-blue-700 text-white border-0">
        <div className="p-6 text-center">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h3 className="text-xl font-bold mb-2">TU TRAYECTORIA ES TU HISTORIA</h3>
          <p className="text-sm opacity-90 max-w-md mx-auto">
            Y tu historia puede ser el próximo paso. Sigue construyendo con cada pago puntual, cada compromiso cumplido y cada crédito completado.
          </p>
          <p className="text-xs mt-3 opacity-75">
            Sujeto a evaluación, aprobación y condiciones vigentes.
          </p>
        </div>
      </Card>

      {/* === MODALES === */}
      {compromisoModalOpen && (
        <CompromisoModal
          token={token}
          novedad={novedadSeleccionada}
          onClose={() => {
            setCompromisoModalOpen(false)
            setNovedadSeleccionada(null)
          }}
          onRegistrado={() => {
            setCompromisoModalOpen(false)
            setNovedadSeleccionada(null)
            setRefreshKey(k => k + 1)
            toast.success('Compromiso registrado. ¡Gracias por tu comunicación!')
          }}
        />
      )}

      {actualizarModalOpen && (
        <ActualizarSituacionModal
          token={token}
          compromiso={novedadSeleccionada}
          onClose={() => {
            setActualizarModalOpen(false)
            setNovedadSeleccionada(null)
          }}
          onActualizado={() => {
            setActualizarModalOpen(false)
            setNovedadSeleccionada(null)
            setRefreshKey(k => k + 1)
            toast.success('Tu situación ha sido actualizada')
          }}
        />
      )}

      {renovacionModalOpen && (
        <RenovacionModal
          token={token}
          valorActual={data.creditoActual?.montoPrincipal || 0}
          onClose={() => setRenovacionModalOpen(false)}
        />
      )}

      {historialPagosPrestamo && (
        <HistorialPagosModal
          token={token}
          credito={historialPagosPrestamo}
          onClose={() => setHistorialPagosPrestamo(null)}
        />
      )}
    </div>
  )
}

// =====================================================
// HEADER DEL PASAPORTE
// =====================================================

function HeaderPasaporte({ nombreCliente, nivel, cumplimiento }: any) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
      style={{
        background: `linear-gradient(135deg, ${nivel.color} 0%, ${nivel.color}dd 50%, #1e3a8a 100%)`,
      }}
    >
      {/* Patrón decorativo */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 -ml-24 -mb-24" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-6 h-6" />
          <span className="text-sm font-semibold uppercase tracking-wide opacity-90">
            Tu Pasaporte de Confianza
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-1">Hola, {nombreCliente}</h1>
        <p className="text-base opacity-90 mb-4">
          Cada pago construye tu siguiente oportunidad.
        </p>

        {/* Indicador circular de cumplimiento */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(cumplimiento / 100) * 264} 264`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="text-center">
              <p className="text-2xl font-bold">{cumplimiento}%</p>
            </div>
          </div>
          <div>
            <p className="text-lg font-bold flex items-center gap-2">
              <span>{nivel.emoji}</span>
              <span>Tu trayectoria {nivel.etiqueta.toLowerCase()}</span>
            </p>
            <p className="text-sm opacity-90 mt-1 max-w-xs">
              {nivel.mensaje}
            </p>
          </div>
        </div>

        <div className="mt-3 text-xs opacity-80">
          Cumplimiento histórico · NO es un score crediticio
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ESTADO GENERAL CON INDICADORES
// =====================================================

function EstadoGeneral({ indicadores, nivel }: any) {
  const indicadoresList = [
    { label: 'Pagos puntuales', value: indicadores.pagosPuntuales, emoji: '🟢' },
    { label: 'Pagos anticipados', value: indicadores.pagosAnticipados, emoji: '⚡' },
    { label: 'Créditos completados', value: indicadores.creditosCompletados, emoji: '🏆' },
    { label: 'Créditos activos', value: indicadores.creditosActivos, emoji: '💳' },
    { label: 'Pagos registrados', value: indicadores.pagosTotales, emoji: '📊' },
    { label: 'Antigüedad', value: indicadores.antiguedadLegible, emoji: '⏳' },
  ]

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tu trayectoria</h2>
          <p className="text-xs text-slate-500">Indicadores calculados con datos reales</p>
        </div>
        <Badge
          style={{
            backgroundColor: `${nivel.color}15`,
            color: nivel.color,
            borderColor: `${nivel.color}40`,
          }}
          className="text-xs font-semibold border"
        >
          {nivel.emoji} {nivel.etiqueta}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {indicadoresList.map((ind, i) => (
          <div
            key={i}
            className="p-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm transition-shadow"
          >
            <div className="text-xl mb-1">{ind.emoji}</div>
            <p className="text-xs text-slate-500 mb-0.5">{ind.label}</p>
            <p className="text-base font-bold text-slate-900">{ind.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progreso del nivel */}
      <div className="mt-4 p-3 rounded-xl bg-slate-50">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-600">Cumplimiento histórico</span>
          <span className="font-bold text-slate-900">{indicadores.cumplimientoHistorico}%</span>
        </div>
        <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${indicadores.cumplimientoHistorico}%`,
              background: `linear-gradient(90deg, ${nivel.color} 0%, ${nivel.color}cc 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>🟡 En construcción</span>
          <span>🟢 Confiable</span>
          <span>🔵 Destacado</span>
          <span>🟣 Preferente</span>
        </div>
      </div>
    </Card>
  )
}

// =====================================================
// NOTIFICACIONES PANEL
// =====================================================

function NotificacionesPanel({ notificaciones, onInformar }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-bold text-slate-900">Notificaciones</h2>
        <Badge variant="secondary" className="ml-auto">{notificaciones.length}</Badge>
      </div>
      <div className="space-y-2">
        {notificaciones.map((n: any, i: number) => (
          <div
            key={i}
            className="p-3 rounded-lg border-l-4 flex items-start gap-3"
            style={{
              borderLeftColor: n.color,
              backgroundColor: `${n.color}08`,
            }}
          >
            <span className="text-lg">{n.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{n.titulo}</p>
              <p className="text-xs text-slate-600">{n.mensaje}</p>
              {(n.tipo === 'PAGO_EXCEDIDO' || n.tipo === 'COMPROMISO_INCUMPLIDO') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                  onClick={() => onInformar(n)}
                >
                  <MessageCircle className="w-3 h-3 mr-1" />
                  {n.tipo === 'COMPROMISO_INCUMPLIDO' ? 'Actualizar mi situación' : 'Cuéntanos qué ocurrió'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BellRing(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

// =====================================================
// CRÉDITO ACTUAL CARD
// =====================================================

function CreditoActualCard({ credito }: any) {
  const estadoVigenciaInfo: Record<string, { emoji: string; label: string; color: string }> = {
    DENTRO_PLAZO: { emoji: '🟢', label: 'Dentro del plazo', color: '#16a34a' },
    PROXIMO_VENCER: { emoji: '🟡', label: 'Próximo a vencer', color: '#ca8a04' },
    EXCEDIDO: { emoji: '🔴', label: 'Excedido', color: '#dc2626' },
    VIGENTE: { emoji: '🟢', label: 'Vigente', color: '#16a34a' },
  }

  const estado = estadoVigenciaInfo[credito.estadoVigencia] || estadoVigenciaInfo.VIGENTE

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Crédito actual</h2>
        <Badge
          style={{ backgroundColor: `${estado.color}15`, color: estado.color, borderColor: `${estado.color}40` }}
          className="ml-auto text-xs border"
        >
          {estado.emoji} {estado.label}
        </Badge>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-slate-500">Progreso del crédito</p>
            <p className="text-3xl font-bold text-slate-900">
              {credito.progresoPorcentaje.toFixed(0)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Cuotas</p>
            <p className="text-xl font-bold text-slate-900">
              {credito.cuotasPagadas}/{credito.numeroCuotas}
            </p>
          </div>
        </div>
        <div className="h-3 bg-white rounded-full overflow-hidden border border-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-1000"
            style={{ width: `${credito.progresoPorcentaje}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Inicio</span>
          <span>Fin</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
          <p className="text-xs text-emerald-700">Pagado</p>
          <p className="text-base font-bold text-emerald-900">{formatCOP(credito.montoPagado)}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-700">Pendiente</p>
          <p className="text-base font-bold text-amber-900">{formatCOP(credito.saldoPendiente)}</p>
        </div>
      </div>

      {credito.proximoPago && (
        <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <p className="text-xs font-semibold text-blue-900">Próximo pago · Cuota {credito.proximoPago.numeroCuota}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-slate-600">Vence: <span className="font-semibold text-slate-900">{formatDate(credito.proximoPago.fechaVencimiento)}</span></p>
              <p className="text-xs text-slate-500">
                {credito.proximoPago.diasParaVencer > 0
                  ? `En ${credito.proximoPago.diasParaVencer} ${credito.proximoPago.diasParaVencer === 1 ? 'día' : 'días'}`
                  : credito.proximoPago.diasParaVencer === 0
                  ? 'Hoy es la fecha pactada'
                  : `Excedido por ${Math.abs(credito.proximoPago.diasParaVencer)} días`}
              </p>
            </div>
            <p className="font-bold text-blue-900">{formatCOP(credito.proximoPago.monto)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <p className="text-slate-400">Desembolso</p>
          <p className="font-medium">{formatDate(credito.fechaDesembolso)}</p>
        </div>
        <div>
          <p className="text-slate-400">Vencimiento</p>
          <p className="font-medium">{formatDate(credito.fechaVencimiento)}</p>
        </div>
        <div>
          <p className="text-slate-400">Días transcurridos</p>
          <p className="font-medium">{credito.diasTranscurridos}</p>
        </div>
        <div>
          <p className="text-slate-400">Días restantes</p>
          <p className="font-medium">{credito.diasRestantes}</p>
        </div>
      </div>
    </Card>
  )
}

// =====================================================
// PRÓXIMA META CARD
// =====================================================

function ProximaMetaCard({ meta }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-violet-600" />
        <h2 className="text-lg font-bold text-slate-900">Tu próxima meta</h2>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 mb-3">
        <p className="text-sm text-slate-700 mb-2">{meta.descripcion}</p>
        <p className="text-xl font-bold text-slate-900 mb-2">
          Te faltan <span className="text-violet-700">{meta.cuotasRestantes}</span> {meta.cuotasRestantes === 1 ? 'pago' : 'pagos'}
        </p>
        <div className="h-3 bg-white rounded-full overflow-hidden border border-violet-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-1000"
            style={{ width: `${meta.progresoActual}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{meta.progresoActual}%</span>
          <span>100%</span>
        </div>
      </div>

      {meta.mensajeHito && (
        <div className="p-3 rounded-lg bg-amber-50 border-2 border-amber-200 text-center animate-pulse">
          <p className="text-sm font-semibold text-amber-900">{meta.mensajeHito}</p>
        </div>
      )}

      {meta.hitoAlcanzado && meta.hitoAlcanzado < 100 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Award className="w-3.5 h-3.5" />
          <span>Hitos: 25% · 50% · 75% · 90% · 100%</span>
        </div>
      )}
    </Card>
  )
}

// =====================================================
// LO QUE ESTÁS CONSTRUYENDO CARD
// =====================================================

function LoQueEstasConstruyendoCard({ data, onExplorarRenovacion, valorActual }: any) {
  return (
    <Card className="p-5 border-2 border-violet-200 bg-gradient-to-br from-violet-50/50 to-white">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-violet-600" />
        <h2 className="text-lg font-bold text-slate-900">Lo que estás construyendo</h2>
      </div>

      <p className="text-sm text-slate-700 mb-3 italic">
        Tu comportamiento actual está construyendo tu próxima oportunidad.
      </p>

      <div className={`p-3 rounded-lg mb-3 ${data.elegibleRenovacion ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
        <p className={`text-sm ${data.elegibleRenovacion ? 'text-emerald-800' : 'text-slate-600'}`}>
          {data.mensaje}
        </p>
      </div>

      {data.elegibleRenovacion ? (
        <>
          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-slate-700">Opciones disponibles:</p>
            {data.opcionesDisponibles.includes('MISMO_VALOR') && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-lg">🔄</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Renovación por el mismo valor</p>
                  <p className="text-xs text-slate-500">Mantén un cupo similar al actual</p>
                </div>
              </div>
            )}
            {data.opcionesDisponibles.includes('VALOR_DIFERENTE') && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-lg">📈</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Renovación por un valor diferente</p>
                  <p className="text-xs text-slate-500">Solicita un monto mayor o menor</p>
                </div>
              </div>
            )}
            {data.opcionesDisponibles.includes('NUEVA_SOLICITUD') && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                <span className="text-lg">💰</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">Nueva solicitud</p>
                  <p className="text-xs text-slate-500">Inicia un crédito independiente</p>
                </div>
              </div>
            )}
          </div>

          {data.razonesElegibilidad.length > 0 && (
            <div className="p-2 rounded-lg bg-emerald-50 mb-3">
              <p className="text-[11px] font-semibold text-emerald-800 mb-1">Por qué eres elegible:</p>
              <ul className="space-y-0.5">
                {data.razonesElegibilidad.map((r: string, i: number) => (
                  <li key={i} className="text-[11px] text-emerald-700 flex items-start gap-1">
                    <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            className="w-full"
            onClick={onExplorarRenovacion}
          >
            <Sparkles className="w-4 h-4 mr-1" /> Explorar renovación
          </Button>
        </>
      ) : (
        <>
          {data.razonesBloqueo.length > 0 && (
            <div className="p-2 rounded-lg bg-slate-100 mb-3">
              <p className="text-[11px] font-semibold text-slate-700 mb-1">Para desbloquear esta opción:</p>
              <ul className="space-y-0.5">
                {data.razonesBloqueo.map((r: string, i: number) => (
                  <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                    <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-100">
        <p className="text-[11px] text-amber-800 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Toda nueva operación está sujeta a evaluación, aprobación y condiciones vigentes.</span>
        </p>
      </div>
    </Card>
  )
}

// =====================================================
// COMPROMISOS CARD
// =====================================================

function CompromisosCard({ compromisos }: any) {
  if (compromisos.registrados === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Cumplimiento de compromisos</h2>
        </div>
        <p className="text-sm text-slate-600">
          Aún no has registrado compromisos de pago. Tu historial está limpio. ¡Sigue así!
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">Cumplimiento de compromisos</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-slate-50 text-center">
          <p className="text-xs text-slate-500">Registrados</p>
          <p className="text-xl font-bold text-slate-900">{compromisos.registrados}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-50 text-center">
          <p className="text-xs text-emerald-700">Cumplidos</p>
          <p className="text-xl font-bold text-emerald-900">{compromisos.cumplidos}</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-50 text-center">
          <p className="text-xs text-amber-700">Pendientes</p>
          <p className="text-xl font-bold text-amber-900">{compromisos.pendientes}</p>
        </div>
        <div className="p-2 rounded-lg bg-red-50 text-center">
          <p className="text-xs text-red-700">Incumplidos</p>
          <p className="text-xl font-bold text-red-900">{compromisos.incumplidos}</p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-600">Cumplimiento</span>
          <span className="font-bold text-emerald-700">{compromisos.cumplimiento}%</span>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden border border-emerald-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000"
            style={{ width: `${compromisos.cumplimiento}%` }}
          />
        </div>
      </div>
    </Card>
  )
}

// =====================================================
// TRAYECTORIA CARD (envoltorio)
// =====================================================

function TrayectoriaCard({ trayectoria, onVerPagos }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Mi trayectoria</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-50 text-center">
          <p className="text-xs text-blue-700">Créditos totales</p>
          <p className="text-xl font-bold text-blue-900">{trayectoria.totalCreditos}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-50 text-center">
          <p className="text-xs text-emerald-700">Completados</p>
          <p className="text-xl font-bold text-emerald-900">{trayectoria.completados}</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-50 text-center">
          <p className="text-xs text-amber-700">Activos</p>
          <p className="text-xl font-bold text-amber-900">{trayectoria.activos}</p>
        </div>
      </div>

      <TrayectoriaTimeline creditos={trayectoria.creditos} onVerPagos={onVerPagos} />
    </Card>
  )
}
