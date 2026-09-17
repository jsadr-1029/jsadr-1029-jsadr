'use client'

// =====================================================
// CentroComunicacionesView — Panel Admin
// Layout 3 columnas: lista | chat | info+notas
// =====================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  MessageSquare,
  Send,
  Paperclip,
  Download,
  Check,
  CheckCheck,
  FileText,
  User,
  Star,
  Trash2,
  Search,
  Plus,
  Settings,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
} from 'lucide-react'
import { BotIcons } from '@/components/views/BotIcons'
import { AsistenteIAPanel } from '@/components/views/AsistenteIAPanel'

// === Tipos ===
interface ConversacionListItem {
  id: string
  codigo: string
  asunto: string
  estado: string
  ultimaActividad: string
  otpVerificado: boolean
  cliente: {
    id: string
    nombre: string
    cedula: string
    telefono: string
    email: string | null
  }
  asesor: { id: string; nombre: string; username: string } | null
  _count: { mensajes: number; notasInternas: number }
}

interface ConversacionDetalle extends ConversacionListItem {
  moduloReferencia: string | null
  entidadRefId: string | null
  fechaCierre: string | null
  motivoCierre: string | null
  createdAt: string
  cliente: ConversacionListItem['cliente'] & {
    direccion: string | null
    ciudad: string | null
    activo: boolean
    prestamos: {
      id: string
      codigo: string
      montoPrincipal: number
      saldoTotal: number
      estado: string
    }[]
  }
  mensajes: Mensaje[]
  notasInternas: NotaInterna[]
}

interface Mensaje {
  id: string
  remitenteTipo: string // CLIENTE | ASESOR | SISTEMA
  remitenteId: string | null
  remitenteNombre: string
  contenido: string
  tipoMensaje: string
  archivoUrl: string | null
  archivoNombre: string | null
  fechaEnvio: string
  fechaLeido: string | null
  estado: string // ENVIADO | ENTREGADO | LEIDO
}

interface NotaInterna {
  id: string
  contenido: string
  esImportante: boolean
  createdAt: string
  autor: { id: string; nombre: string; username: string }
}

interface ChatConfig {
  CHAT_INACTIVIDAD_MIN: { valor: string; descripcion: string }
  CHAT_OTP_EXPIRA_MIN: { valor: string; descripcion: string }
  CHAT_OTP_INTENTOS_MAX: { valor: string; descripcion: string }
  CHAT_OTP_BLOQUEO_MIN: { valor: string; descripcion: string }
  CHAT_CORREOS_HABILITADO: { valor: string; descripcion: string }
  CHAT_CORREO_REMITENTE: { valor: string; descripcion: string }
  CHAT_MENSAJE_BIENVENIDA: { valor: string; descripcion: string }
}

interface ClienteBusqueda {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string | null
}

// === Helpers ===
function fmtHora(f: string): string {
  const d = new Date(f)
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtFechaCorta(f: string): string {
  const d = new Date(f)
  const hoy = new Date()
  const esHoy = d.toDateString() === hoy.toDateString()
  if (esHoy) return fmtHora(f)
  return d.toLocaleDateString('es-CO', { month: '2-digit', day: '2-digit' })
}

function fmtMoneda(v: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v || 0)
}

const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: typeof Inbox }> = {
  ACTIVA: { label: 'Activa', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', icon: MessageSquare },
  FINALIZADA: { label: 'Finalizada', className: 'bg-sky-500/15 text-sky-300 border-sky-400/30', icon: CheckCircle2 },
  ARCHIVADA: { label: 'Archivada', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-400/30', icon: Archive },
}

// =====================================================
// Componente principal
// =====================================================
export function CentroComunicacionesView() {
  const { toast } = useToast()

  // Listado
  const [conversaciones, setConversaciones] = useState<ConversacionListItem[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')

  // Detalle
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<ConversacionDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  // Mensaje nuevo
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviandoMensaje, setEnviandoMensaje] = useState(false)

  // Notas
  const [nuevaNota, setNuevaNota] = useState('')
  const [notaImportante, setNotaImportante] = useState(false)
  const [guardandoNota, setGuardandoNota] = useState(false)

  // Dialogs
  const [dialogNueva, setDialogNueva] = useState(false)
  const [dialogConfig, setDialogConfig] = useState(false)
  const [dialogCerrar, setDialogCerrar] = useState(false)
  const [accionCerrar, setAccionCerrar] = useState<'FINALIZADA' | 'ARCHIVADA'>('FINALIZADA')
  const [motivoCierre, setMotivoCierre] = useState('')

  // Búsqueda de cliente
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<ClienteBusqueda[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>(null)
  const [asuntoNueva, setAsuntoNueva] = useState('')

  // Configuración
  const [config, setConfig] = useState<ChatConfig | null>(null)
  const [configEdit, setConfigEdit] = useState<Record<string, string>>({})
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  // Polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // === Cargar lista ===
  const cargarLista = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filtroEstado !== 'all') params.append('estado', filtroEstado)
      if (search.trim()) params.append('q', search.trim())
      const res = await fetch(`/api/chat/conversaciones?${params}`)
      const json = await res.json()
      if (json.success) {
        setConversaciones(json.data)
      }
    } catch (e) {
      console.error('Error cargando conversaciones:', e)
    } finally {
      setLoadingLista(false)
    }
  }, [filtroEstado, search])

  // === Cargar detalle ===
  const cargarDetalle = useCallback(async (id: string) => {
    try {
      setLoadingDetalle(true)
      const res = await fetch(`/api/chat/conversaciones/${id}`)
      const json = await res.json()
      if (json.success) {
        setDetalle(json.data)
        // Auto-scroll al final
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoadingDetalle(false)
    }
  }, [toast])

  // === Efecto: cargar lista inicial y cuando cambian filtros ===
  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  // === Efecto: cargar detalle cuando se selecciona ===
  useEffect(() => {
    if (selectedId) {
      cargarDetalle(selectedId)
    } else {
      setDetalle(null)
    }
  }, [selectedId, cargarDetalle])

  // === Polling cada 5s para refrescar mensajes ===
  useEffect(() => {
    if (!selectedId) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/conversaciones/${selectedId}`)
        const json = await res.json()
        if (json.success) {
          setDetalle((prev) => {
            // Solo actualizar si hay más mensajes o cambia ultimaActividad
            if (!prev) return json.data
            if (json.data.mensajes.length !== prev.mensajes.length) {
              return json.data
            }
            return prev
          })
        }
      } catch (e) {
        // Silencioso en polling
      }
    }, 5000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedId])

  // === Polling para refrescar lista cada 15s ===
  useEffect(() => {
    const t = setInterval(cargarLista, 15000)
    return () => clearInterval(t)
  }, [cargarLista])

  // === Enviar mensaje ===
  const enviarMensaje = async () => {
    if (!selectedId || !nuevoMensaje.trim()) return
    try {
      setEnviandoMensaje(true)
      const res = await fetch('/api/chat/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacionId: selectedId,
          contenido: nuevoMensaje.trim(),
          tipoMensaje: 'TEXTO',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setNuevoMensaje('')
        await cargarDetalle(selectedId)
        await cargarLista()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviandoMensaje(false)
    }
  }

  // === Guardar nota ===
  const guardarNota = async () => {
    if (!selectedId || !nuevaNota.trim()) return
    try {
      setGuardandoNota(true)
      const res = await fetch('/api/chat/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacionId: selectedId,
          contenido: nuevaNota.trim(),
          esImportante: notaImportante,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setNuevaNota('')
        setNotaImportante(false)
        await cargarDetalle(selectedId)
        toast({ title: 'Nota guardada', description: 'La nota interna fue registrada.' })
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoNota(false)
    }
  }

  // === Eliminar nota ===
  const eliminarNota = async (notaId: string) => {
    try {
      const res = await fetch(`/api/chat/notas/${notaId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        await cargarDetalle(selectedId!)
        toast({ title: 'Nota eliminada' })
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Buscar cliente para nueva conversación ===
  const buscarCliente = async () => {
    if (!busquedaCliente.trim()) return
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(busquedaCliente.trim())}`)
      const json = await res.json()
      if (json.success) {
        setResultadosCliente(json.data || [])
      } else {
        // Algunos endpoints devuelven array directo
        setResultadosCliente(Array.isArray(json) ? json : [])
      }
    } catch (e) {
      setResultadosCliente([])
    }
  }

  // === Crear conversación ===
  const crearConversacion = async () => {
    if (!clienteSeleccionado) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/chat/conversaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteSeleccionado.id,
          asunto: asuntoNueva || 'Conversación general',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Conversación creada', description: json.data.codigo })
        setDialogNueva(false)
        setClienteSeleccionado(null)
        setBusquedaCliente('')
        setResultadosCliente([])
        setAsuntoNueva('')
        await cargarLista()
        setSelectedId(json.data.id)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Cerrar / archivar conversación ===
  const ejecutarCerrar = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/chat/conversaciones/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: accionCerrar,
          motivoCierre: motivoCierre || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: accionCerrar === 'FINALIZADA' ? 'Conversación finalizada' : 'Conversación archivada',
        })
        setDialogCerrar(false)
        setMotivoCierre('')
        await cargarDetalle(selectedId)
        await cargarLista()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Reabrir conversación ===
  const reabrir = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/chat/conversaciones/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ACTIVA' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Conversación reabierta' })
        await cargarDetalle(selectedId)
        await cargarLista()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Descargar PDF (abre HTML imprimible en nueva pestaña) ===
  const descargarPdf = () => {
    if (!selectedId) return
    window.open(`/api/chat/historial-pdf?conversacionId=${selectedId}`, '_blank')
  }

  // === Cargar configuración ===
  const cargarConfig = async () => {
    try {
      const res = await fetch('/api/chat/config')
      const json = await res.json()
      if (json.success) {
        setConfig(json.data)
        const edit: Record<string, string> = {}
        for (const [k, v] of Object.entries(json.data)) {
          edit[k] = (v as { valor: string }).valor
        }
        setConfigEdit(edit)
      }
    } catch (e: any) {
      toast({ title: 'Error cargando configuración', description: e.message, variant: 'destructive' })
    }
  }

  // === Guardar configuración ===
  const guardarConfig = async () => {
    try {
      setGuardandoConfig(true)
      const res = await fetch('/api/chat/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: configEdit }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Configuración guardada' })
        setDialogConfig(false)
        await cargarConfig()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoConfig(false)
    }
  }

  // === KPIs ===
  const kpis = {
    activas: conversaciones.filter((c) => c.estado === 'ACTIVA').length,
    finalizadas: conversaciones.filter((c) => c.estado === 'FINALIZADA').length,
    archivadas: conversaciones.filter((c) => c.estado === 'ARCHIVADA').length,
  }

  // === Render estado mensaje ===
  const EstadoIcon = ({ estado, esAsesor }: { estado: string; esAsesor: boolean }) => {
    if (!esAsesor) return null
    if (estado === 'LEIDO') return <CheckCheck className="w-3.5 h-3.5 text-violet-300" />
    if (estado === 'ENTREGADO') return <CheckCheck className="w-3.5 h-3.5 text-white/60" />
    return <Check className="w-3.5 h-3.5 text-white/60" />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Centro de Comunicaciones"
        subtitle="Chat en tiempo real con clientes, OTP, notas internas e historial"
        icon={<MessageSquare className="w-5 h-5" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { cargarConfig(); setDialogConfig(true) }}>
              <Settings className="w-4 h-4" /> Configuración
            </Button>
            <Button size="sm" onClick={() => setDialogNueva(true)}>
              <Plus className="w-4 h-4" /> Nueva conversación
            </Button>
          </>
        }
      />

      {/* === BOTS DISPONIBLES === */}
      <BotIcons modulo="comunicaciones" />

      {/* === PANEL ASISTENTE IA DE CLIENTES === */}
      <AsistenteIAPanel />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{kpis.activas}</p>
              <p className="text-xs text-muted-foreground mt-1">Activas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{kpis.finalizadas}</p>
              <p className="text-xs text-muted-foreground mt-1">Finalizadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-500/15 flex items-center justify-center">
              <Archive className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{kpis.archivadas}</p>
              <p className="text-xs text-muted-foreground mt-1">Archivadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{conversaciones.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buscador + filtros */}
      <Card className="py-3">
        <CardContent className="px-4 py-0 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, asunto, cliente o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === 'Enter' && cargarLista()}
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="ACTIVA">Activas</SelectItem>
              <SelectItem value="FINALIZADA">Finalizadas</SelectItem>
              <SelectItem value="ARCHIVADA">Archivadas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={cargarLista}>
            <Search className="w-4 h-4" /> Buscar
          </Button>
        </CardContent>
      </Card>

      {/* Layout 3 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-4 h-[calc(100vh-380px)] min-h-[500px]">
        {/* === Columna 1: Lista de conversaciones === */}
        <Card className="py-0 overflow-hidden">
          <CardHeader className="py-3 border-b border-white/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Conversaciones ({conversaciones.length})
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-50px)]">
            {loadingLista ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : conversaciones.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No hay conversaciones
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {conversaciones.map((c) => {
                  const cfg = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.ACTIVA
                  const IconEstado = cfg.icon
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${
                        selectedId === c.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {c.cliente.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate">{c.cliente.nombre}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {fmtFechaCorta(c.ultimaActividad)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.asunto}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${cfg.className}`}>
                              <IconEstado className="w-2.5 h-2.5 mr-1" />
                              {cfg.label}
                            </Badge>
                            {c.otpVerificado && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-300 border-emerald-400/30">
                                OTP ✓
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {c._count.mensajes} msg
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* === Columna 2: Chat === */}
        <Card className="py-0 overflow-hidden flex flex-col">
          {!detalle ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">
                  Selecciona una conversación para ver el chat
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header del chat */}
              <div className="border-b border-white/10 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold shrink-0">
                  {detalle.cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{detalle.cliente.nombre}</p>
                    {(() => {
                      const cfg = ESTADO_CONFIG[detalle.estado] || ESTADO_CONFIG.ACTIVA
                      return (
                        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                      )
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {detalle.codigo} · {detalle.asesor ? `Asesor: ${detalle.asesor.nombre}` : 'Sin asesor'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title="Descargar PDF" onClick={descargarPdf}>
                    <Download className="w-4 h-4" />
                  </Button>
                  {detalle.estado === 'ACTIVA' ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setAccionCerrar('FINALIZADA'); setDialogCerrar(true) }}
                        title="Finalizar"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setAccionCerrar('ARCHIVADA'); setDialogCerrar(true) }}
                        title="Archivar"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={reabrir} title="Reabrir">
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mensajes */}
              <ScrollArea className="flex-1 px-4 py-3">
                {loadingDetalle ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Cargando mensajes...</div>
                ) : (
                  <div className="space-y-2">
                    {detalle.mensajes.map((m) => {
                      const esCliente = m.remitenteTipo === 'CLIENTE'
                      const esAsesor = m.remitenteTipo === 'ASESOR'
                      const esSistema = m.remitenteTipo === 'SISTEMA'

                      if (esSistema) {
                        return (
                          <div key={m.id} className="flex justify-center my-2">
                            <div className="bg-amber-500/15 text-amber-200 border border-amber-400/30 px-3 py-1.5 rounded-full text-xs text-center max-w-[80%]">
                              {m.contenido}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={m.id}
                          className={`flex ${esAsesor ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                              esAsesor
                                ? 'gradient-primary text-white rounded-br-sm'
                                : 'bg-white/10 text-foreground rounded-bl-sm border border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              {!esAsesor && (
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  {m.remitenteNombre}
                                </span>
                              )}
                              <span className="text-[10px] opacity-70 ml-auto">{fmtHora(m.fechaEnvio)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{m.contenido}</p>
                            {m.archivoUrl && (
                              <a
                                href={m.archivoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`mt-1 flex items-center gap-1 text-xs ${
                                  esAsesor ? 'text-white/80 hover:text-white' : 'text-primary hover:underline'
                                }`}
                              >
                                <Paperclip className="w-3 h-3" /> {m.archivoNombre || 'archivo'}
                              </a>
                            )}
                            <div className={`flex items-center justify-end gap-1 mt-0.5 ${esAsesor ? 'text-white/70' : 'text-muted-foreground'}`}>
                              <EstadoIcon estado={m.estado} esAsesor={esAsesor} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-white/10 p-3">
                {detalle.estado !== 'ACTIVA' ? (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    <XCircle className="w-4 h-4 inline mr-1" />
                    Conversación {detalle.estado.toLowerCase()}. Reabrirla para enviar mensajes.
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <Button size="icon" variant="ghost" title="Adjuntar (próximamente)" disabled>
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Textarea
                      placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          enviarMensaje()
                        }
                      }}
                      rows={1}
                      className="min-h-[40px] max-h-32 resize-none"
                    />
                    <Button
                      onClick={enviarMensaje}
                      disabled={!nuevoMensaje.trim() || enviandoMensaje}
                      size="icon"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* === Columna 3: Info cliente + Notas === */}
        <Card className="py-0 overflow-hidden flex flex-col">
          {!detalle ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <User className="w-12 h-12 opacity-20" />
            </div>
          ) : (
            <Tabs defaultValue="cliente" className="flex-1 flex flex-col">
              <div className="border-b border-white/10 px-2 pt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="cliente" className="flex-1">
                    <User className="w-3.5 h-3.5 mr-1" /> Cliente
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="flex-1">
                    <FileText className="w-3.5 h-3.5 mr-1" /> Notas ({detalle.notasInternas.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab: Cliente */}
              <TabsContent value="cliente" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-lg font-bold shrink-0">
                        {detalle.cliente.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{detalle.cliente.nombre}</p>
                        <p className="text-xs text-muted-foreground">CC {detalle.cliente.cedula}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-muted-foreground">Teléfono</span>
                        <span className="font-medium">{detalle.cliente.telefono}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium truncate ml-2">{detalle.cliente.email || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-muted-foreground">Ciudad</span>
                        <span className="font-medium">{detalle.cliente.ciudad || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-muted-foreground">Estado</span>
                        {detalle.cliente.activo ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-400/30">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-400/30">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {detalle.cliente.prestamos.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 mt-3">
                          Préstamos ({detalle.cliente.prestamos.length})
                        </p>
                        <div className="space-y-2">
                          {detalle.cliente.prestamos.map((p) => (
                            <div
                              key={p.id}
                              className="bg-white/5 rounded-lg p-2 border border-white/5"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-xs">{p.codigo}</span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {p.estado}
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Saldo:</span>
                                <span className="font-semibold">{fmtMoneda(p.saldoTotal)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="bg-primary/10 rounded-lg p-2 border border-primary/20 flex justify-between items-center">
                            <span className="text-xs font-medium">Saldo total</span>
                            <span className="font-bold text-primary">
                              {fmtMoneda(
                                detalle.cliente.prestamos.reduce((a, p) => a + (p.saldoTotal || 0), 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab: Notas internas */}
              <TabsContent value="notas" className="flex-1 m-0 flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {detalle.notasInternas.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        <FileText className="w-8 h-8 mx-auto mb-1 opacity-30" />
                        Sin notas internas
                      </p>
                    ) : (
                      detalle.notasInternas.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-lg p-2 border ${
                            n.esImportante
                              ? 'bg-red-500/10 border-red-400/30'
                              : 'bg-amber-500/10 border-amber-400/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {n.esImportante && <Star className="w-3 h-3 text-red-400 fill-red-400" />}
                            <span className="text-xs font-medium">{n.autor.nombre}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {fmtFechaCorta(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{n.contenido}</p>
                          <button
                            onClick={() => eliminarNota(n.id)}
                            className="text-[10px] text-muted-foreground hover:text-red-400 mt-1"
                          >
                            <Trash2 className="w-3 h-3 inline" /> Eliminar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="border-t border-white/10 p-3 space-y-2">
                  <Textarea
                    placeholder="Nota interna (visible solo para asesores)..."
                    value={nuevaNota}
                    onChange={(e) => setNuevaNota(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={notaImportante}
                      onCheckedChange={setNotaImportante}
                      id="nota-importante"
                    />
                    <Label htmlFor="nota-importante" className="text-xs cursor-pointer">
                      <Star className="w-3 h-3 inline mr-1" /> Marcar como importante
                    </Label>
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={guardarNota}
                      disabled={!nuevaNota.trim() || guardandoNota}
                    >
                      <Plus className="w-3.5 h-3.5" /> Guardar
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>

      {/* === Dialog: Nueva conversación === */}
      <Dialog open={dialogNueva} onOpenChange={setDialogNueva}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva conversación</DialogTitle>
            <DialogDescription>Busca un cliente para iniciar una nueva conversación.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre o cédula del cliente..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarCliente()}
              />
              <Button variant="outline" onClick={buscarCliente}>
                <Search className="w-4 h-4" /> Buscar
              </Button>
            </div>

            {resultadosCliente.length > 0 && (
              <ScrollArea className="max-h-48 border border-white/10 rounded-lg">
                <div className="divide-y divide-white/5">
                  {resultadosCliente.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setClienteSeleccionado(c)}
                      className={`w-full text-left p-2 hover:bg-white/5 transition-colors ${
                        clienteSeleccionado?.id === c.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <p className="text-sm font-medium">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">CC {c.cedula} · {c.telefono}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {clienteSeleccionado && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Cliente seleccionado:</p>
                <p className="text-sm font-medium">{clienteSeleccionado.nombre}</p>
                <p className="text-xs text-muted-foreground">CC {clienteSeleccionado.cedula}</p>
              </div>
            )}

            <div>
              <Label htmlFor="asunto">Asunto (opcional)</Label>
              <Input
                id="asunto"
                placeholder="Conversación general"
                value={asuntoNueva}
                onChange={(e) => setAsuntoNueva(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNueva(false)}>
              Cancelar
            </Button>
            <Button onClick={crearConversacion} disabled={!clienteSeleccionado}>
              <Plus className="w-4 h-4" /> Crear conversación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Configuración === */}
      <Dialog open={dialogConfig} onOpenChange={setDialogConfig}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuración del módulo</DialogTitle>
            <DialogDescription>
              Parámetros del Centro de Comunicaciones (inactividad, OTP, correos).
            </DialogDescription>
          </DialogHeader>

          {config && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-2">
                {Object.entries(config).map(([clave, info]) => (
                  <div key={clave} className="space-y-1">
                    <Label htmlFor={clave} className="text-xs font-mono">
                      {clave}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">{info.descripcion}</p>
                    {clave === 'CHAT_CORREOS_HABILITADO' ? (
                      <Select
                        value={configEdit[clave] || 'true'}
                        onValueChange={(v) => setConfigEdit({ ...configEdit, [clave]: v })}
                      >
                        <SelectTrigger id={clave}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Habilitado</SelectItem>
                          <SelectItem value="false">Deshabilitado</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={clave}
                        value={configEdit[clave] || ''}
                        onChange={(e) => setConfigEdit({ ...configEdit, [clave]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConfig(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarConfig} disabled={guardandoConfig}>
              {guardandoConfig ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === AlertDialog: Cerrar / Archivar === */}
      <AlertDialog open={dialogCerrar} onOpenChange={setDialogCerrar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accionCerrar === 'FINALIZADA' ? '¿Finalizar conversación?' : '¿Archivar conversación?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accionCerrar === 'FINALIZADA'
                ? 'La conversación se marcará como finalizada y no se podrán enviar más mensajes. Podrás reabrirla luego.'
                : 'La conversación se archivará. Podrás reabrirla si es necesario.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input
              id="motivo"
              placeholder="Ej: Caso resuelto, cliente no responde..."
              value={motivoCierre}
              onChange={(e) => setMotivoCierre(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={ejecutarCerrar}
              className={
                accionCerrar === 'FINALIZADA'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white'
                  : 'bg-zinc-600 hover:bg-zinc-700 text-white'
              }
            >
              {accionCerrar === 'FINALIZADA' ? 'Finalizar' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
