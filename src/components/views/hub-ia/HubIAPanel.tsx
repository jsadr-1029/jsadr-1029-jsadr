'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bot, Send, Loader2, ShieldCheck, ShieldAlert, Pause, Play,
  Settings, MessageSquare, Trash2, AlertTriangle, CheckCircle2,
  XCircle, Clock, DollarSign, Zap, Cpu, History, Plus,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'

// =====================================================
// Tipos
// =====================================================

interface Mensaje {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  contenido: string
  provider?: string | null
  modelo?: string | null
  toolName?: string | null
  toolArgs?: string | null
  toolResult?: string | null
  tokensInput?: number
  tokensOutput?: number
  costo?: number
  aprobado?: boolean | null
  createdAt: string
}

interface Conversacion {
  id: string
  titulo: string
  provider?: string | null
  modelo?: string | null
  mensajeCount: number
  totalTokens: number
  totalCosto: number
  createdAt: string
  updatedAt: string
}

interface ConfigResponse {
  providers: {
    zai: { disponible: boolean; configured: boolean; error?: string; modeloDefault: string }
    openai: { disponible: boolean; configured: boolean; error?: string; modeloDefault: string; apiKeySet: boolean }
  }
  agentePausado: boolean
  providerDefault: string
  modoDefault: string
  limiteMensualUsd: number
}

interface ChatResponse {
  ok: boolean
  conversationId: string
  respuesta: string
  providerUsado: string
  modeloUsado: string
  tokensInput: number
  tokensOutput: number
  costo: number
  pendienteAprobacion?: {
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    riesgo: string
    descripcion: string
  }
  herramientaEjecutada?: {
    toolName: string
    ok: boolean
    resultado?: unknown
    error?: string
  }
  error?: string
  bloqueado?: boolean
  motivoBloqueo?: string
}

// =====================================================
// Componente principal
// =====================================================

export function HubIAPanel() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionActual, setConversacionActual] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [providerSel, setProviderSel] = useState<'auto' | 'zai' | 'openai'>('auto')
  const [pendienteAprobacion, setPendienteAprobacion] = useState<ChatResponse['pendienteAprobacion'] | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [tab, setTab] = useState<'chat' | 'historial' | 'config' | 'uso'>('chat')
  const [uso, setUso] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // ---------- Cargar configuración ----------
  const cargarConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const r = await fetch('/api/hub-ia/config')
      const d = await r.json()
      if (d.success) {
        setConfig(d.data)
        setProviderSel(d.data.providerDefault || 'auto')
      }
    } catch (e) {
      console.error('Error cargando config:', e)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  // ---------- Cargar conversaciones ----------
  const cargarConversaciones = useCallback(async () => {
    try {
      const r = await fetch('/api/hub-ia/conversaciones')
      const d = await r.json()
      if (d.success) setConversaciones(d.data.conversaciones || [])
    } catch (e) {
      console.error('Error cargando conversaciones:', e)
    }
  }, [])

  // ---------- Cargar conversación específica ----------
  const cargarConversacion = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/hub-ia/conversaciones/${id}`)
      const d = await r.json()
      if (d.success) {
        setConversacionActual(d.data.conversation)
        setMensajes(d.data.conversation.mensajes || [])
        setPendienteAprobacion(null)
        // Si hay mensajes pendientes de aprobación, mostrarlos
        const pendiente = (d.data.conversation.mensajes || []).find(
          (m: Mensaje) => m.role === 'assistant' && m.aprobado === false && m.toolName
        )
        if (pendiente) {
          setPendienteAprobacion({
            toolCallId: pendiente.toolCallId || '',
            toolName: pendiente.toolName || '',
            args: pendiente.toolArgs ? JSON.parse(pendiente.toolArgs) : {},
            riesgo: 'medio',
            descripcion: '',
          })
        }
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (e) {
      console.error('Error cargando conversación:', e)
    }
  }, [])

  // ---------- Nueva conversación ----------
  const nuevaConversacion = () => {
    setConversacionActual(null)
    setMensajes([])
    setInput('')
    setPendienteAprobacion(null)
  }

  // ---------- Eliminar conversación ----------
  const eliminarConversacion = async (id: string) => {
    if (!confirm('¿Eliminar esta conversación permanentemente?')) return
    try {
      const r = await fetch(`/api/hub-ia/conversaciones/${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) {
        toast({ title: 'Conversación eliminada' })
        if (conversacionActual?.id === id) nuevaConversacion()
        cargarConversaciones()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---------- Enviar mensaje ----------
  const enviarMensaje = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setLoading(true)
    // Mensaje optimista
    const tempUserMsg: Mensaje = {
      id: `temp_${Date.now()}`,
      role: 'user',
      contenido: msg,
      createdAt: new Date().toISOString(),
    }
    setMensajes((prev) => [...prev, tempUserMsg])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const r = await fetch('/api/hub-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: msg,
          conversationId: conversacionActual?.id,
          provider: providerSel,
        }),
      })
      const d = await r.json()
      if (d.success) {
        const data: ChatResponse = d.data
        // Refrescar conversación completa para mantener consistencia
        if (data.conversationId) {
          await cargarConversacion(data.conversationId)
          await cargarConversaciones()
        }
        if (data.pendienteAprobacion) {
          setPendienteAprobacion(data.pendienteAprobacion)
        }
        if (data.error && !data.respuesta) {
          toast({ title: 'Error', description: data.error, variant: 'destructive' })
        }
      } else {
        toast({ title: 'Error', description: d.error || 'Error desconocido', variant: 'destructive' })
        // Remover mensaje optimista
        setMensajes((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      }
    } catch (e: any) {
      toast({ title: 'Error de conexión', description: e.message, variant: 'destructive' })
      setMensajes((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      setLoading(false)
    }
  }

  // ---------- Confirmar herramienta pendiente ----------
  const confirmarHerramienta = async () => {
    if (!pendienteAprobacion || !conversacionActual) return
    setLoading(true)
    try {
      const r = await fetch('/api/hub-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'confirmar',
          conversationId: conversacionActual.id,
          toolCallId: pendienteAprobacion.toolCallId,
          confirmado: true,
        }),
      })
      const d = await r.json()
      if (d.success) {
        setPendienteAprobacion(null)
        await cargarConversacion(conversacionActual.id)
      } else {
        toast({ title: 'Error', description: d.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const cancelarHerramienta = () => {
    setPendienteAprobacion(null)
    toast({ title: 'Acción cancelada' })
  }

  // ---------- Pausar / reanudar agente ----------
  const togglePausa = async () => {
    if (!config) return
    try {
      const r = await fetch('/api/hub-ia/pausar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pausar: !config.agentePausado }),
      })
      const d = await r.json()
      if (d.success) {
        setConfig({ ...config, agentePausado: d.data.pausado })
        toast({
          title: d.data.pausado ? '🚨 Agente IA pausado' : '✅ Agente IA reanudado',
          description: d.data.pausado
            ? 'Las herramientas de modificación están bloqueadas.'
            : 'El agente puede ejecutar acciones autorizadas.',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ---------- Cargar uso ----------
  const cargarUso = useCallback(async () => {
    try {
      const r = await fetch('/api/hub-ia/uso?dias=30')
      const d = await r.json()
      if (d.success) setUso(d.data)
    } catch (e) {
      console.error('Error cargando uso:', e)
    }
  }, [])

  // ---------- Init ----------
  useEffect(() => {
    cargarConfig()
    cargarConversaciones()
  }, [cargarConfig, cargarConversaciones])

  useEffect(() => {
    if (tab === 'uso' && !uso) cargarUso()
  }, [tab, uso, cargarUso])

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Header con estado de IA */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Asistente IA Operativo
                  {loadingConfig ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : config?.agentePausado ? (
                    <Badge variant="destructive" className="text-[10px]">🔴 PAUSADO</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">🟢 ACTIVO</Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hub multi-IA: Z.AI + OpenAI · orquestador con tools, security gateway y auditoría
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {config && (
                <>
                  <Badge variant="outline" className="text-[10px]">
                    ZAI: {config.providers.zai.disponible ? '🟢' : '🔴'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    OpenAI: {config.providers.openai.configured ? (config.providers.openai.disponible ? '🟢' : '🟡') : '⚪'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={config.agentePausado ? 'default' : 'destructive'}
                    onClick={togglePausa}
                    className="h-7"
                  >
                    {config.agentePausado ? (
                      <><Play className="w-3 h-3 mr-1" /> Reanudar</>
                    ) : (
                      <><Pause className="w-3 h-3 mr-1" /> Pausar agente</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs internos */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'chat', label: 'Chat', icon: MessageSquare },
          { key: 'historial', label: 'Historial', icon: History },
          { key: 'config', label: 'Configuración', icon: Settings },
          { key: 'uso', label: 'Uso y costos', icon: DollarSign },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: CHAT ===== */}
      {tab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar conversaciones */}
          <div className="lg:col-span-1 space-y-2">
            <Button onClick={nuevaConversacion} variant="outline" size="sm" className="w-full">
              <Plus className="w-3 h-3 mr-1" /> Nueva conversación
            </Button>
            <div className="max-h-96 lg:max-h-[600px] overflow-y-auto space-y-1">
              {conversaciones.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Sin conversaciones</p>
              ) : (
                conversaciones.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2 rounded-md border text-xs cursor-pointer transition group ${
                      conversacionActual?.id === c.id
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                    onClick={() => cargarConversacion(c.id)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{c.titulo}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {c.mensajeCount} msgs · {formatearFechaHora(c.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarConversacion(c.id) }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat principal */}
          <div className="lg:col-span-3 space-y-3">
            {/* Selector de provider */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-slate-600">Proveedor:</Label>
              <Select value={providerSel} onValueChange={(v) => setProviderSel(v as any)}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="zai">Z.AI (GLM)</SelectItem>
                  <SelectItem value="openai">OpenAI / ChatGPT</SelectItem>
                </SelectContent>
              </Select>
              {config?.agentePausado && (
                <Badge variant="destructive" className="text-[10px]">
                  <ShieldAlert className="w-3 h-3 mr-1" /> Herramientas bloqueadas
                </Badge>
              )}
            </div>

            {/* Mensajes */}
            <div className="border border-slate-200 rounded-lg bg-white p-3 h-[400px] lg:h-[500px] overflow-y-auto space-y-3">
              {mensajes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <Bot className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Asistente IA Operativo</p>
                  <p className="text-xs mt-1 max-w-sm">
                    Escribe una instrucción en lenguaje natural. La IA puede consultar información real
                    de la plataforma y ejecutar acciones autorizadas.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-slate-500">
                    <p>• "¿Cuántos clientes están en mora?"</p>
                    <p>• "Muéstrame los préstamos activos"</p>
                    <p>• "Crea una alerta sobre el riesgo de liquidez"</p>
                    <p>• "Consulta el estado del sistema"</p>
                  </div>
                </div>
              ) : (
                mensajes.map((m) => <MensajeItem key={m.id} mensaje={m} />)
              )}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Procesando...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pendiente de aprobación */}
            {pendienteAprobacion && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <div className="space-y-2">
                    <div className="font-semibold">
                      ⚠️ Acción de riesgo {pendienteAprobacion.riesgo} requiere confirmación
                    </div>
                    <div className="text-xs">
                      Herramienta: <code className="bg-amber-100 px-1 rounded">{pendienteAprobacion.toolName}</code>
                    </div>
                    <pre className="text-[11px] bg-amber-100/50 p-2 rounded overflow-x-auto max-h-32">
                      {JSON.stringify(pendienteAprobacion.args, null, 2)}
                    </pre>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={confirmarHerramienta}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 h-7"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar y ejecutar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelarHerramienta}
                        disabled={loading}
                        className="h-7"
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviarMensaje()
                  }
                }}
                placeholder="Escribe lo que necesitas que haga..."
                className="text-sm resize-none"
                rows={2}
                disabled={loading}
              />
              <Button
                onClick={enviarMensaje}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: HISTORIAL ===== */}
      {tab === 'historial' && <HistorialPanel />}

      {/* ===== TAB: CONFIGURACIÓN ===== */}
      {tab === 'config' && config && (
        <ConfigPanel config={config} onSaved={cargarConfig} />
      )}

      {/* ===== TAB: USO ===== */}
      {tab === 'uso' && <UsoPanel uso={uso} onRefresh={cargarUso} />}
    </div>
  )
}

// =====================================================
// Subcomponente: Mensaje
// =====================================================

function MensajeItem({ mensaje }: { mensaje: Mensaje }) {
  const isUser = mensaje.role === 'user'
  const isAssistant = mensaje.role === 'assistant'
  const isTool = mensaje.role === 'tool'

  if (isTool) {
    return (
      <div className="flex justify-center">
        <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md max-w-md">
          <span className="font-mono">{mensaje.toolName}</span> →{' '}
          <span className="font-mono text-slate-500">
            {mensaje.toolResult?.slice(0, 200) || mensaje.contenido.slice(0, 200)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block text-xs px-3 py-2 rounded-lg ${
            isUser
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-100 text-slate-800'
          }`}
        >
          <div className="whitespace-pre-wrap">{mensaje.contenido}</div>
        </div>
        {isAssistant && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
            {mensaje.provider && <span>{mensaje.provider}</span>}
            {mensaje.modelo && <span>· {mensaje.modelo}</span>}
            {(mensaje.tokensInput || mensaje.tokensOutput) && (
              <span>
                · {mensaje.tokensInput || 0}↑ {mensaje.tokensOutput || 0}↓ tok
              </span>
            )}
            {mensaje.costo && mensaje.costo > 0 && (
              <span>· ${mensaje.costo.toFixed(4)}</span>
            )}
            {mensaje.aprobado === false && mensaje.toolName && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-amber-700 border-amber-300">
                pendiente
              </Badge>
            )}
            {mensaje.aprobado === true && (
              <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-emerald-700 border-emerald-300">
                aprobado
              </Badge>
            )}
            <span>· {formatearFechaHora(mensaje.createdAt)}</span>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-md bg-slate-300 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-slate-700">TÚ</span>
        </div>
      )}
    </div>
  )
}

// =====================================================
// Subcomponente: Panel de Configuración
// =====================================================

function ConfigPanel({ config, onSaved }: { config: ConfigResponse; onSaved: () => void }) {
  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiModelo, setOpenaiModelo] = useState(config.providers.openai.modeloDefault || 'gpt-4o-mini')
  const [providerDefault, setProviderDefault] = useState(config.providerDefault || 'auto')
  const [modoDefault, setModoDefault] = useState(config.modoDefault || 'supervisado')
  const [limiteUsd, setLimiteUsd] = useState(String(config.limiteMensualUsd || 50))
  const [guardando, setGuardando] = useState(false)
  const { toast } = useToast()

  const guardar = async (clave: string, valor: string) => {
    setGuardando(true)
    try {
      const r = await fetch('/api/hub-ia/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor }),
      })
      const d = await r.json()
      if (d.success) {
        toast({ title: 'Configuración guardada' })
        onSaved()
      } else {
        toast({ title: 'Error', description: d.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Proveedores IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ZAI */}
          <div className="p-3 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">Z.AI (GLM)</p>
                <p className="text-[10px] text-slate-500">SDK sandbox · sin API key</p>
              </div>
              <Badge variant={config.providers.zai.disponible ? 'default' : 'destructive'} className="text-[10px]">
                {config.providers.zai.disponible ? 'Conectado' : 'Error'}
              </Badge>
            </div>
            {config.providers.zai.error && (
              <p className="text-[10px] text-red-600">{config.providers.zai.error}</p>
            )}
          </div>

          {/* OpenAI */}
          <div className="p-3 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">OpenAI / ChatGPT</p>
                <p className="text-[10px] text-slate-500">API oficial · requiere API key</p>
              </div>
              <Badge
                variant={config.providers.openai.disponible ? 'default' : config.providers.openai.configured ? 'secondary' : 'outline'}
                className="text-[10px]"
              >
                {config.providers.openai.disponible
                  ? 'Conectado'
                  : config.providers.openai.configured
                  ? 'Configurado (error)'
                  : 'No configurado'}
              </Badge>
            </div>
            {config.providers.openai.error && config.providers.openai.configured && (
              <p className="text-[10px] text-red-600">{config.providers.openai.error}</p>
            )}
            <div>
              <Label className="text-[10px] text-slate-600">API Key</Label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={config.providers.openai.apiKeySet ? '•••••••• (configurada)' : 'sk-...'}
                className="h-7 text-xs"
              />
              <Button
                size="sm"
                onClick={() => guardar('openai_api_key', openaiKey)}
                disabled={!openaiKey || guardando}
                className="h-7 mt-1 text-xs"
              >
                {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                Guardar API key (cifrada)
              </Button>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Modelo</Label>
              <Select value={openaiModelo} onValueChange={(v) => { setOpenaiModelo(v); guardar('openai_modelo', v) }}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini (económico)</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o (avanzado)</SelectItem>
                  <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo (más barato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configuración general
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[10px] text-slate-600">Proveedor por defecto</Label>
            <Select
              value={providerDefault}
              onValueChange={(v) => { setProviderDefault(v); guardar('provider_default', v) }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (ZAI → OpenAI fallback)</SelectItem>
                <SelectItem value="zai">Z.AI (preferido)</SelectItem>
                <SelectItem value="openai">OpenAI (preferido)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-slate-600">Modo de operación</Label>
            <Select
              value={modoDefault}
              onValueChange={(v) => { setModoDefault(v); guardar('modo_default', v) }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consulta">Consulta (solo responde)</SelectItem>
                <SelectItem value="supervisado">Supervisado (confirma cada acción)</SelectItem>
                <SelectItem value="planificacion">Planificación (propone, no ejecuta)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-slate-600">Límite mensual (USD)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={limiteUsd}
                onChange={(e) => setLimiteUsd(e.target.value)}
                className="h-7 text-xs w-32"
              />
              <Button
                size="sm"
                onClick={() => guardar('limite_mensual_usd', limiteUsd)}
                disabled={guardando}
                className="h-7 text-xs"
              >
                Guardar
              </Button>
            </div>
          </div>
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-[11px] text-blue-800">
              🔒 Las API keys se cifran con AES-256-CBC antes de almacenarse y nunca se exponen al frontend.
              Las herramientas de modificación requieren confirmación explícita del administrador.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// Subcomponente: Panel de Historial (acciones IA)
// =====================================================

function HistorialPanel() {
  const [acciones, setAcciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        // Reutilizamos la API de conversaciones para listar y luego cargamos acciones
        // En una versión futura podríamos tener /api/hub-ia/acciones
        const r = await fetch('/api/hub-ia/conversaciones')
        const d = await r.json()
        if (d.success) {
          // Por ahora mostramos las conversaciones como historial
          setAcciones(d.data.conversaciones || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (loading) return <div className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4" /> Historial de conversaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        {acciones.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Sin conversaciones registradas</p>
        ) : (
          <div className="space-y-2">
            {acciones.map((c) => (
              <div key={c.id} className="p-2 border border-slate-200 rounded-md text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{c.titulo}</span>
                  <Badge variant="outline" className="text-[10px]">{c.provider || 'auto'}</Badge>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex gap-3">
                  <span>{c.mensajeCount} mensajes</span>
                  <span>{c.totalTokens} tokens</span>
                  <span>${c.totalCosto.toFixed(4)}</span>
                  <span>{formatearFechaHora(c.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Subcomponente: Panel de Uso y Costos
// =====================================================

function UsoPanel({ uso, onRefresh }: { uso: any; onRefresh: () => void }) {
  if (!uso) {
    return (
      <div className="text-center py-8">
        <Button onClick={onRefresh} variant="outline" size="sm">
          <Zap className="w-3 h-3 mr-1" /> Cargar estadísticas
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500">Solicitudes</div>
            <div className="text-xl font-bold text-slate-700">{uso.total.solicitudes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500">Tokens input</div>
            <div className="text-xl font-bold text-slate-700">{uso.total.tokensInput.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500">Tokens output</div>
            <div className="text-xl font-bold text-slate-700">{uso.total.tokensOutput.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500">Costo total (USD)</div>
            <div className="text-xl font-bold text-emerald-700">${uso.total.costo.toFixed(4)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Por provider */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Por proveedor</CardTitle></CardHeader>
        <CardContent>
          {uso.porProvider.length === 0 ? (
            <p className="text-xs text-slate-400">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {uso.porProvider.map((p: any) => (
                <div key={p.provider} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{p.provider}</span>
                  <div className="flex gap-3 text-slate-500">
                    <span>{p._count} solicitudes</span>
                    <span>{(p._sum.tokensInput + p._sum.tokensOutput).toLocaleString()} tokens</span>
                    <span className="font-medium text-emerald-700">${(p._sum.costo || 0).toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por modelo */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Por modelo</CardTitle></CardHeader>
        <CardContent>
          {uso.porModelo.length === 0 ? (
            <p className="text-xs text-slate-400">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {uso.porModelo.map((m: any) => (
                <div key={m.modelo} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{m.modelo}</span>
                  <div className="flex gap-3 text-slate-500">
                    <span>{m._count} solicitudes</span>
                    <span>${(m._sum.costo || 0).toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
