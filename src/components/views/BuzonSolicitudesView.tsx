'use client'

// =====================================================
// BuzonSolicitudesView v3.0 — Jsadr
// =====================================================
// Buzón de solicitudes web provenientes del portal del cliente.
// Muestra KPIs, buscador, filtros por estado y tabla con
// acciones: ver detalle, cambiar estado, observaciones,
// rechazar y convertir en solicitud de préstamo.
// =====================================================

import { useEffect, useState, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  Inbox,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Plus,
  RefreshCw,
  MessageCircle,
  Download,
  CheckSquare,
  Square,
  Trash2,
  Mail,
  LayoutGrid,
  List,
  ThumbsUp,
} from 'lucide-react'

// === Tipos ===

interface SolicitudWeb {
  id: string
  codigo: string
  clienteId: string
  clienteNombre: string
  clienteCedula: string
  clienteTelefono: string
  clienteEmail: string | null
  valorSolicitado: number
  numeroCuotas: number
  frecuencia: string
  tasaUtilizada: number
  tasaOrigen: string
  cuotaEstimada: number
  totalIntereses: number
  totalPagar: number
  primerPagoFecha: string | null
  tablaAmortizacion: string | null
  fechaCreacion: string
  ipOrigen: string | null
  navegador: string | null
  canalOrigen: string
  estado: string
  observaciones: string | null
  revisadoPor: string | null
  fechaRevision: string | null
  prestamoCreadoId: string | null
  fechaConversion: string | null
  historialEstados: string | null
}

interface SolicitudDetalle extends SolicitudWeb {
  tablaAmortizacionParseada?: any[] | null
  historialEstadosParseado?: any[] | null
  cliente?: {
    id: string
    nombre: string
    cedula: string
    telefono: string
    email: string | null
    municipio: string | null
    departamento: string | null
    activo: boolean
    tieneTasaPersonalizada: boolean
    tasaPersonalizada: number | null
    categoria?: { id: string; codigo: string; nombre: string } | null
  } | null
}

interface BuzonSolicitudesViewProps {
  onConvertir: (solicitud: SolicitudWeb) => void
}

// === Utilidades ===

const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  { value: 'EN_REVISION', label: 'En Revisión', color: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
  { value: 'APROBADA', label: 'Aprobada', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
  { value: 'RECHAZADA', label: 'Rechazada', color: 'bg-red-500/15 text-red-300 border-red-400/30' },
  { value: 'CONVERTIDA', label: 'Convertida', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
]

function getEstadoConfig(estado: string) {
  return (
    ESTADOS.find((e) => e.value === estado) || {
      value: estado,
      label: estado,
      color: 'bg-white/10 text-foreground border-white/20',
    }
  )
}

// =====================================================
// Componente
// =====================================================

export function BuzonSolicitudesView({ onConvertir }: BuzonSolicitudesViewProps) {
  const [solicitudes, setSolicitudes] = useState<SolicitudWeb[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')

  // Modal detalle
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // Modal cambiar estado
  const [modalEstado, setModalEstado] = useState<SolicitudWeb | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState<string>('PENDIENTE')

  // Modal observaciones
  const [modalObs, setModalObs] = useState<SolicitudWeb | null>(null)
  const [textoObs, setTextoObs] = useState('')

  // Modal rechazar
  const [modalRechazar, setModalRechazar] = useState<SolicitudWeb | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  const [guardando, setGuardando] = useState(false)
  const { toast } = useToast()

  // Nuevos estados para mejoras
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [vista, setVista] = useState<'tabla' | 'cards'>('tabla')
  const [bulkAction, setBulkAction] = useState<string>('')

  // === Cargar solicitudes ===
  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/solicitudes-web')
      const json = await res.json()
      if (json.success) setSolicitudes(json.data)
    } catch (e: any) {
      toast({
        title: 'Error al cargar',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  // === KPIs ===
  const kpis = useMemo(() => {
    const total = solicitudes.length
    const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length
    const enRevision = solicitudes.filter((s) => s.estado === 'EN_REVISION').length
    const convertidas = solicitudes.filter((s) => s.estado === 'CONVERTIDA').length
    const rechazadas = solicitudes.filter((s) => s.estado === 'RECHAZADA').length
    return { total, pendientes, enRevision, convertidas, rechazadas }
  }, [solicitudes])

  // === Filtros ===
  const solicitudesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return solicitudes.filter((s) => {
      const matchBusqueda =
        !q ||
        s.codigo.toLowerCase().includes(q) ||
        s.clienteNombre.toLowerCase().includes(q) ||
        s.clienteCedula.toLowerCase().includes(q)
      const matchEstado = filtroEstado === 'all' || s.estado === filtroEstado
      return matchBusqueda && matchEstado
    })
  }, [solicitudes, busqueda, filtroEstado])

  // === Acciones ===

  const verDetalle = async (solicitud: SolicitudWeb) => {
    try {
      setCargandoDetalle(true)
      const res = await fetch(`/api/solicitudes-web/${solicitud.id}`)
      const json = await res.json()
      if (json.success) {
        setDetalle(json.data)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setCargandoDetalle(false)
    }
  }

  const abrirModalEstado = (s: SolicitudWeb) => {
    setNuevoEstado(s.estado)
    setModalEstado(s)
  }

  const abrirModalObs = (s: SolicitudWeb) => {
    setTextoObs('')
    setModalObs(s)
  }

  const abrirModalRechazar = (s: SolicitudWeb) => {
    setMotivoRechazo('')
    setModalRechazar(s)
  }

  const cambiarEstado = async () => {
    if (!modalEstado) return
    try {
      setGuardando(true)
      const res = await fetch('/api/solicitudes-web', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalEstado.id,
          accion: 'cambiar_estado',
          estado: nuevoEstado,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Estado actualizado', description: `Nuevo estado: ${nuevoEstado}` })
        setModalEstado(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const agregarObservaciones = async () => {
    if (!modalObs || !textoObs.trim()) return
    try {
      setGuardando(true)
      const res = await fetch('/api/solicitudes-web', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalObs.id,
          accion: 'agregar_observaciones',
          observaciones: textoObs.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Observaciones agregadas' })
        setModalObs(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const rechazar = async () => {
    if (!modalRechazar) return
    try {
      setGuardando(true)
      const res = await fetch('/api/solicitudes-web', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalRechazar.id,
          accion: 'rechazar',
          observaciones: motivoRechazo.trim() || 'Solicitud rechazada',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Solicitud rechazada' })
        setModalRechazar(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const convertirSolicitud = (s: SolicitudWeb) => {
    onConvertir(s)
  }

  // =====================================================
  // MEJORAS: WhatsApp, Exportar CSV, Bulk actions
  // =====================================================

  // Generar link de WhatsApp para contactar al cliente
  const contactarWhatsApp = (s: SolicitudWeb) => {
    const telefono = s.clienteTelefono.replace(/[^\d]/g, '')
    const telCompleto = telefono.length === 10 ? `57${telefono}` : telefono
    const mensaje = `Hola ${s.clienteNombre}, nos comunicamos desde Jsadr · Jo*** Se*** Al*** D** R** respecto a tu solicitud de crédito ${s.codigo} por ${formatearMoneda(s.valorSolicitado)}. ¿Podemos conversar?`
    window.open(`https://wa.me/${telCompleto}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  // Generar link de WhatsApp rechazando amablemente
  const rechazarWhatsApp = (s: SolicitudWeb) => {
    const telefono = s.clienteTelefono.replace(/[^\d]/g, '')
    const telCompleto = telefono.length === 10 ? `57${telefono}` : telefono
    const mensaje = `Hola ${s.clienteNombre}, gracias por tu interés en Jsadr · Jo*** Se*** Al*** D** R**. Lamentablemente tu solicitud ${s.codigo} no pudo ser aprobada en este momento. Si deseas más información, contáctanos.`
    window.open(`https://wa.me/${telCompleto}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  // Enviar email al cliente (si tiene)
  const contactarEmail = (s: SolicitudWeb) => {
    if (!s.clienteEmail) {
      toast({ title: 'Sin correo', description: 'El cliente no tiene correo registrado', variant: 'destructive' })
      return
    }
    const asunto = `Solicitud de crédito ${s.codigo} — Jsadr · Jo*** Se*** Al*** D** R**`
    const cuerpo = `Hola ${s.clienteNombre},%0D%0A%0D%0ANos comunicamos desde Jsadr · Jo*** Se*** Al*** D** R** respecto a tu solicitud de crédito ${s.codigo} por ${formatearMoneda(s.valorSolicitado)}.%0D%0A%0D%0ASaludos cordiales,%0D%0AEquipo Jsadr`
    window.location.href = `mailto:${s.clienteEmail}?subject=${encodeURIComponent(asunto)}&body=${cuerpo}`
  }

  // Exportar a CSV las solicitudes filtradas
  const exportarCSV = () => {
    if (!solicitudesFiltradas.length) {
      toast({ title: 'Sin datos', description: 'No hay solicitudes para exportar', variant: 'destructive' })
      return
    }
    const headers = [
      'Código', 'Cliente', 'Cédula', 'Teléfono', 'Email',
      'Valor Solicitado', 'Cuotas', 'Frecuencia', 'Tasa', 'Tasa Origen',
      'Cuota Estimada', 'Total Intereses', 'Total a Pagar',
      'Fecha Creación', 'Estado', 'Observaciones',
    ]
    const rows = solicitudesFiltradas.map((s) => [
      s.codigo,
      s.clienteNombre,
      s.clienteCedula,
      s.clienteTelefono,
      s.clienteEmail || '',
      s.valorSolicitado,
      s.numeroCuotas,
      s.frecuencia,
      s.tasaUtilizada,
      s.tasaOrigen,
      s.cuotaEstimada,
      s.totalIntereses,
      s.totalPagar,
      new Date(s.fechaCreacion).toLocaleString('es-CO'),
      s.estado,
      (s.observaciones || '').replace(/\n/g, ' '),
    ])
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `solicitudes-web-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: 'CSV exportado', description: `${rows.length} solicitudes exportadas` })
  }

  // Toggle selección individual
  const toggleSeleccion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Seleccionar / deseleccionar todas las filtradas
  const toggleSeleccionarTodas = () => {
    if (selectedIds.size === solicitudesFiltradas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(solicitudesFiltradas.map((s) => s.id)))
    }
  }

  // Aplicar acción masiva
  const aplicarBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) {
      toast({ title: 'Selecciona una acción y al menos una solicitud', variant: 'destructive' })
      return
    }
    if (!confirm(`¿Aplicar "${bulkAction}" a ${selectedIds.size} solicitud(es)?`)) return

    setGuardando(true)
    let exito = 0
    let fallo = 0
    for (const id of Array.from(selectedIds)) {
      try {
        const body: any = { id, accion: 'cambiar_estado' }
        if (bulkAction === 'APROBAR') body.estado = 'APROBADA'
        else if (bulkAction === 'RECHAZAR') {
          body.accion = 'rechazar'
          body.observaciones = 'Rechazo masivo'
        }
        else if (bulkAction === 'REVISION') body.estado = 'EN_REVISION'
        else if (bulkAction === 'PENDIENTE') body.estado = 'PENDIENTE'

        const res = await fetch('/api/solicitudes-web', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (json.success) exito++
        else fallo++
      } catch {
        fallo++
      }
    }
    setGuardando(false)
    setBulkAction('')
    setSelectedIds(new Set())
    cargar()
    toast({
      title: 'Acción masiva completada',
      description: `${exito} exitosas, ${fallo} fallidas`,
      variant: fallo > 0 ? 'destructive' : 'default',
    })
  }

  // Aprobación rápida (1 clic)
  const aprobarRapido = async (s: SolicitudWeb) => {
    try {
      const res = await fetch('/api/solicitudes-web', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, accion: 'cambiar_estado', estado: 'APROBADA' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Solicitud aprobada', description: s.codigo })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // =====================================================
  // Render
  // =====================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buzón de Solicitudes Web"
        subtitle="Solicitudes de crédito generadas desde el portal del cliente"
        icon={<Inbox className="w-5 h-5" />}
        actions={
          <Button variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-2xl font-bold">{kpis.total}</div>
              </div>
              <Inbox className="w-7 h-7 text-primary/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Pendientes</div>
                <div className="text-2xl font-bold text-amber-400">{kpis.pendientes}</div>
              </div>
              <Clock className="w-7 h-7 text-amber-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">En Revisión</div>
                <div className="text-2xl font-bold text-sky-400">{kpis.enRevision}</div>
              </div>
              <Search className="w-7 h-7 text-sky-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Convertidas</div>
                <div className="text-2xl font-bold text-emerald-400">{kpis.convertidas}</div>
              </div>
              <CheckCircle className="w-7 h-7 text-emerald-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Rechazadas</div>
                <div className="text-2xl font-bold text-red-400">{kpis.rechazadas}</div>
              </div>
              <XCircle className="w-7 h-7 text-red-500/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nombre o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle vista tabla/cards */}
        <div className="flex rounded-md border border-white/10 overflow-hidden">
          <button
            onClick={() => setVista('tabla')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              vista === 'tabla' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'
            }`}
            title="Vista de tabla"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Tabla</span>
          </button>
          <button
            onClick={() => setVista('cards')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              vista === 'cards' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'
            }`}
            title="Vista de tarjetas (móvil)"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Tarjetas</span>
          </button>
        </div>

        <Button variant="outline" onClick={exportarCSV} disabled={!solicitudesFiltradas.length}>
          <Download className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">CSV</span>
        </Button>
      </div>

      {/* Barra de acciones masivas */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2 text-sm">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="font-medium">{selectedIds.size} seleccionada(s)</span>
          </div>
          <div className="flex-1" />
          <Select value={bulkAction} onValueChange={setBulkAction}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Acción masiva..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APROBAR">Aprobar todas</SelectItem>
              <SelectItem value="REVISION">Marcar en revisión</SelectItem>
              <SelectItem value="PENDIENTE">Marcar pendientes</SelectItem>
              <SelectItem value="RECHAZAR">Rechazar todas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={aplicarBulkAction}
            disabled={!bulkAction || guardando}
            className="h-8"
          >
            {guardando ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
            Aplicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-8"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Limpiar
          </Button>
        </div>
      )}

      {/* Tabla o Cards según vista */}
      {vista === 'tabla' ? (
      <Card className="bg-card/50 backdrop-blur-sm border-white/10 overflow-x-auto">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="w-10">
                  <button
                    onClick={toggleSeleccionarTodas}
                    className="p-1 rounded hover:bg-white/10"
                    title={selectedIds.size === solicitudesFiltradas.length ? "Deseleccionar todas" : "Seleccionar todas"}
                  >
                    {selectedIds.size === solicitudesFiltradas.length && solicitudesFiltradas.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Cuotas / Frec.</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
                <TableHead className="text-right">Cuota Est.</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando solicitudes...
                  </TableCell>
                </TableRow>
              ) : solicitudesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay solicitudes que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                solicitudesFiltradas.map((s) => {
                  const cfg = getEstadoConfig(s.estado)
                  const isSelected = selectedIds.has(s.id)
                  return (
                    <TableRow
                      key={s.id}
                      className={`border-white/5 hover:bg-white/5 cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                      onClick={() => verDetalle(s)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSeleccion(s.id)}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-primary">
                          {s.codigo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{s.clienteNombre}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {s.clienteCedula}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{s.clienteTelefono}</div>
                        {s.clienteEmail && (
                          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {s.clienteEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatearMoneda(s.valorSolicitado)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{s.numeroCuotas}</div>
                        <div className="text-xs text-muted-foreground">{s.frecuencia}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono text-sm font-semibold">
                          {s.tasaUtilizada}%
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            s.tasaOrigen === 'PERSONALIZADA'
                              ? 'border-purple-400/30 bg-purple-500/10 text-purple-300'
                              : 'border-slate-400/30 bg-slate-500/10 text-slate-300'
                          }`}
                        >
                          {s.tasaOrigen === 'PERSONALIZADA' ? 'Personal' : 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-emerald-300">
                        {formatearMoneda(s.cuotaEstimada)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {formatearFecha(s.fechaCreacion)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => verDetalle(s)}
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => contactarWhatsApp(s)}
                            title="Contactar por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-400" />
                          </Button>
                          {s.clienteEmail && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => contactarEmail(s)}
                              title="Enviar correo"
                            >
                              <Mail className="w-4 h-4 text-sky-400" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => aprobarRapido(s)}
                            title="Aprobación rápida"
                            disabled={s.estado === 'CONVERTIDA' || s.estado === 'RECHAZADA' || s.estado === 'APROBADA'}
                          >
                            <ThumbsUp className="w-4 h-4 text-emerald-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirModalEstado(s)}
                            title="Cambiar estado"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirModalObs(s)}
                            title="Agregar observaciones"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirModalRechazar(s)}
                            title="Rechazar"
                            disabled={s.estado === 'RECHAZADA' || s.estado === 'CONVERTIDA'}
                          >
                            <XCircle className="w-4 h-4 text-red-400" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => convertirSolicitud(s)}
                            title="Crear solicitud de préstamo"
                            disabled={s.estado === 'CONVERTIDA' || s.estado === 'RECHAZADA'}
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Préstamo
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : null}

      {/* Vista de tarjetas (móvil o cuando se selecciona) */}
      {vista === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando solicitudes...
            </div>
          ) : solicitudesFiltradas.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No hay solicitudes que coincidan con el filtro.
            </div>
          ) : (
            solicitudesFiltradas.map((s) => {
              const cfg = getEstadoConfig(s.estado)
              const isSelected = selectedIds.has(s.id)
              return (
                <Card
                  key={s.id}
                  className={`bg-card/50 backdrop-blur-sm border-white/10 cursor-pointer transition-all hover:border-primary/30 ${
                    isSelected ? 'ring-2 ring-primary/50' : ''
                  }`}
                  onClick={() => verDetalle(s)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSeleccion(s.id)
                          }}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        <div className="font-mono text-xs font-semibold text-primary">
                          {s.codigo}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="font-semibold text-sm mb-1">{s.clienteNombre}</div>
                    <div className="text-xs text-muted-foreground font-mono mb-3">
                      CC {s.clienteCedula} · {s.clienteTelefono}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <div className="text-muted-foreground">Valor</div>
                        <div className="font-mono font-semibold">{formatearMoneda(s.valorSolicitado)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Cuota est.</div>
                        <div className="font-mono font-semibold text-emerald-300">{formatearMoneda(s.cuotaEstimada)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Cuotas</div>
                        <div className="font-medium">{s.numeroCuotas} ({s.frecuencia})</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tasa</div>
                        <div className="font-mono">{s.tasaUtilizada}%</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mb-3">
                      {formatearFecha(s.fechaCreacion)}
                    </div>
                    <div
                      className="flex gap-1 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => contactarWhatsApp(s)}
                        className="h-7 text-xs"
                      >
                        <MessageCircle className="w-3 h-3 mr-1 text-emerald-400" />
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aprobarRapido(s)}
                        disabled={s.estado === 'CONVERTIDA' || s.estado === 'RECHAZADA' || s.estado === 'APROBADA'}
                        className="h-7 text-xs"
                      >
                        <ThumbsUp className="w-3 h-3 mr-1 text-emerald-400" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => convertirSolicitud(s)}
                        disabled={s.estado === 'CONVERTIDA' || s.estado === 'RECHAZADA'}
                        className="h-7 text-xs bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Préstamo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* === Modal Detalle === */}
      <Dialog
        open={!!detalle}
        onOpenChange={(open) => !open && setDetalle(null)}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-white/10">
          {cargandoDetalle && !detalle ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Cargando detalle...</p>
            </div>
          ) : detalle ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-primary">{detalle.codigo}</span>
                  {(() => {
                    const cfg = getEstadoConfig(detalle.estado)
                    return (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    )
                  })()}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Info Cliente */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Información del Cliente
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nombre</Label>
                      <div className="font-medium">{detalle.clienteNombre}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cédula</Label>
                      <div className="font-mono">{detalle.clienteCedula}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Teléfono</Label>
                      <div className="font-mono">{detalle.clienteTelefono}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div className="text-sm">{detalle.clienteEmail || '—'}</div>
                    </div>
                    {detalle.cliente && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Ubicación</Label>
                          <div className="text-sm">
                            {[detalle.cliente.municipio, detalle.cliente.departamento]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Estado cliente</Label>
                          <div>
                            {detalle.cliente.activo ? (
                              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/30">
                                Activo
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Inactivo</Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Categoría</Label>
                          <div className="text-sm">
                            {detalle.cliente.categoria
                              ? `${detalle.cliente.categoria.codigo} — ${detalle.cliente.categoria.nombre}`
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tasa cliente</Label>
                          <div>
                            {detalle.cliente.tieneTasaPersonalizada ? (
                              <Badge className="bg-purple-500/15 text-purple-300 border-purple-400/30">
                                {detalle.cliente.tasaPersonalizada}% mensual
                              </Badge>
                            ) : (
                              <Badge variant="outline">Tasa general</Badge>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Info Simulación */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Información de la Simulación
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor solicitado</Label>
                      <div className="font-mono font-semibold">
                        {formatearMoneda(detalle.valorSolicitado)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cuotas</Label>
                      <div className="font-medium">
                        {detalle.numeroCuotas}{' '}
                        <span className="text-xs text-muted-foreground">
                          ({detalle.frecuencia})
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tasa utilizada</Label>
                      <div className="font-mono font-semibold">
                        {detalle.tasaUtilizada}%
                        <Badge
                          variant="outline"
                          className={`ml-2 text-[10px] ${
                            detalle.tasaOrigen === 'PERSONALIZADA'
                              ? 'border-purple-400/30 bg-purple-500/10 text-purple-300'
                              : 'border-slate-400/30 bg-slate-500/10 text-slate-300'
                          }`}
                        >
                          {detalle.tasaOrigen}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cuota estimada</Label>
                      <div className="font-mono font-semibold text-emerald-300">
                        {formatearMoneda(detalle.cuotaEstimada)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Total intereses</Label>
                      <div className="font-mono">{formatearMoneda(detalle.totalIntereses)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Total a pagar</Label>
                      <div className="font-mono font-semibold">
                        {formatearMoneda(detalle.totalPagar)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Primer pago</Label>
                      <div className="text-sm">
                        {detalle.primerPagoFecha ? formatearFecha(detalle.primerPagoFecha) : '—'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Canal</Label>
                      <div className="text-sm">{detalle.canalOrigen}</div>
                    </div>
                  </div>
                  {detalle.ipOrigen && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-muted-foreground">
                      <span>IP origen: </span>
                      <span className="font-mono">{detalle.ipOrigen}</span>
                      {detalle.navegador && (
                        <>
                          <span className="ml-3">User-Agent: </span>
                          <span className="font-mono truncate inline-block max-w-[400px] align-bottom">
                            {detalle.navegador}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabla de Amortización */}
                {detalle.tablaAmortizacionParseada &&
                  Array.isArray(detalle.tablaAmortizacionParseada) &&
                  detalle.tablaAmortizacionParseada.length > 0 && (
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Tabla de Amortización ({detalle.tablaAmortizacionParseada.length} cuotas)
                      </h4>
                      <div className="max-h-72 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Vencimiento</TableHead>
                              <TableHead className="text-right">Cuota</TableHead>
                              <TableHead className="text-right">Capital</TableHead>
                              <TableHead className="text-right">Interés</TableHead>
                              <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detalle.tablaAmortizacionParseada.map((c: any, idx: number) => (
                              <TableRow key={idx} className="border-white/5">
                                <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                                <TableCell className="text-xs">
                                  {formatearFecha(c.fechaVencimiento)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold">
                                  {formatearMoneda(c.montoCuota)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {formatearMoneda(c.capital)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-amber-300">
                                  {formatearMoneda(c.interes)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {formatearMoneda(c.saldoCapital)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                {/* Historial de Estados */}
                {detalle.historialEstadosParseado &&
                  Array.isArray(detalle.historialEstadosParseado) &&
                  detalle.historialEstadosParseado.length > 0 && (
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Historial de Estados
                      </h4>
                      <ul className="space-y-2">
                        {detalle.historialEstadosParseado.map((h: any, idx: number) => {
                          const cfg = getEstadoConfig(h.estado)
                          return (
                            <li key={idx} className="flex items-start gap-3 text-sm">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color} whitespace-nowrap mt-0.5`}
                              >
                                {cfg.label}
                              </span>
                              <div className="flex-1">
                                <div className="text-xs text-muted-foreground">
                                  {formatearFechaHora(h.fecha)}
                                  {h.usuario && <span> · {h.usuario}</span>}
                                </div>
                                {h.observacion && (
                                  <div className="text-sm">{h.observacion}</div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                {/* Observaciones */}
                {detalle.observaciones && (
                  <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-400/20">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-200">
                      <FileText className="w-4 h-4" />
                      Observaciones
                    </h4>
                    <div className="text-sm whitespace-pre-wrap text-amber-100/90">
                      {detalle.observaciones}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Creada: <span className="font-mono">{formatearFechaHora(detalle.fechaCreacion)}</span>
                    </div>
                    {detalle.fechaRevision && (
                      <div>
                        Revisada: <span className="font-mono">{formatearFechaHora(detalle.fechaRevision)}</span>
                        {detalle.revisadoPor && <span> · {detalle.revisadoPor}</span>}
                      </div>
                    )}
                    {detalle.fechaConversion && (
                      <div>
                        Convertida: <span className="font-mono">{formatearFechaHora(detalle.fechaConversion)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => contactarWhatsApp(detalle)}
                      className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                    </Button>
                    {detalle.clienteEmail && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => contactarEmail(detalle)}
                        className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                      >
                        <Mail className="w-4 h-4 mr-1" /> Correo
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => aprobarRapido(detalle)}
                      disabled={detalle.estado === 'CONVERTIDA' || detalle.estado === 'RECHAZADA' || detalle.estado === 'APROBADA'}
                      className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" /> Aprobar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalObs(detalle)}
                    >
                      <FileText className="w-4 h-4 mr-1" /> Observación
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalEstado(detalle)}
                      disabled={detalle.estado === 'CONVERTIDA'}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" /> Cambiar estado
                    </Button>
                    {detalle.estado !== 'RECHAZADA' && detalle.estado !== 'CONVERTIDA' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrirModalRechazar(detalle)}
                          className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Rechazar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => convertirSolicitud(detalle)}
                          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Crear Préstamo
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* === Modal Cambiar Estado === */}
      <Dialog open={!!modalEstado} onOpenChange={(open) => !open && setModalEstado(null)}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Cambiar Estado
            </DialogTitle>
          </DialogHeader>
          {modalEstado && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                <div className="font-mono text-primary text-xs">{modalEstado.codigo}</div>
                <div className="font-semibold">{modalEstado.clienteNombre}</div>
                <div className="text-xs text-muted-foreground">
                  Estado actual: <span className="font-medium">{getEstadoConfig(modalEstado.estado).label}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nuevo estado</Label>
                <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEstado(null)}>
              Cancelar
            </Button>
            <Button onClick={cambiarEstado} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Observaciones === */}
      <Dialog open={!!modalObs} onOpenChange={(open) => !open && setModalObs(null)}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Agregar Observaciones
            </DialogTitle>
          </DialogHeader>
          {modalObs && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                <div className="font-mono text-primary text-xs">{modalObs.codigo}</div>
                <div className="font-semibold">{modalObs.clienteNombre}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="texto-obs">Observación</Label>
                <Textarea
                  id="texto-obs"
                  placeholder="Escribe una observación interna..."
                  rows={4}
                  value={textoObs}
                  onChange={(e) => setTextoObs(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalObs(null)}>
              Cancelar
            </Button>
            <Button onClick={agregarObservaciones} disabled={guardando || !textoObs.trim()}>
              {guardando ? 'Guardando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Rechazar === */}
      <Dialog open={!!modalRechazar} onOpenChange={(open) => !open && setModalRechazar(null)}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-300">
              <XCircle className="w-4 h-4" />
              Rechazar Solicitud
            </DialogTitle>
          </DialogHeader>
          {modalRechazar && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-400/20 text-sm">
                <div className="font-mono text-primary text-xs">{modalRechazar.codigo}</div>
                <div className="font-semibold">{modalRechazar.clienteNombre}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Esta acción cambiará el estado a <strong className="text-red-300">RECHAZADA</strong>.
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo-rechazo">Motivo del rechazo (opcional)</Label>
                <Textarea
                  id="motivo-rechazo"
                  placeholder="Explica el motivo del rechazo..."
                  rows={3}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRechazar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={rechazar}
              disabled={guardando}
              className="bg-red-600 hover:bg-red-500 text-white border-0"
            >
              {guardando ? 'Procesando...' : 'Rechazar Solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
