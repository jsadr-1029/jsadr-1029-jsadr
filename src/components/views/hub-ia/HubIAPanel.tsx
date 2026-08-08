'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Bot, Send, Loader2, ShieldCheck, ShieldAlert, Pause, Play,
  Settings, MessageSquare, Trash2, AlertTriangle, CheckCircle2,
  XCircle, Clock, DollarSign, Zap, Cpu, History, Plus,
  CircleDot, Ban, Search, GitCompare, Brain,
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
  modo?: string | null
  mensajeCount: number
  totalTokens: number
  totalCosto: number
  createdAt: string
  updatedAt: string
}

type EstadoAgente = 'operativo' | 'solo_consulta' | 'bloqueado'

interface ConfigResponse {
  providers: {
    zai: { disponible: boolean; configured: boolean; error?: string; modeloDefault: string }
    openai: { disponible: boolean; configured: boolean; error?: string; modeloDefault: string; apiKeySet: boolean }
  }
  estadoAgente: EstadoAgente
  agentePausado: boolean
  providerDefault: string
  modoDefault: string
  limiteMensualUsd: number
  usoMensual: { ok: boolean; gastado: number; limite: number; restante: number; porcentaje: number }
}

interface PendienteAprobacion {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  riesgo: string
  descripcion: string
  moduloAfectado?: string
  registrosEstimados?: number
  accionMasiva?: boolean
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
  pendienteAprobacion?: PendienteAprobacion
  herramientaEjecutada?: {
    toolName: string
    ok: boolean
    resultado?: unknown
    error?: string
    verificado?: boolean
  }
  multiIAResultado?: {
    zai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
    openai?: { contenido: string; modelo: string; tokensInput: number; tokensOutput: number; costo: number; error?: string }
    comparacion?: {
      coincidencias: string[]
      diferencias: string[]
      ventajasZai: string[]
      ventajasOpenAI: string[]
      recomendacion: string
    }
  }
  estadoAgente?: EstadoAgente
  estadoProcesamiento?: string
  limiteMensual?: { gastado: number; limite: number; restante: number; porcentaje: number }
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
  const [providerSel, setProviderSel] = useState<'auto' | 'zai' | 'openai' | 'multi'>('auto')
  const [pendienteAprobacion, setPendienteAprobacion] = useState<PendienteAprobacion | null>(null)
  const [tab, setTab] = useState<'chat' | 'historial' | 'config' | 'uso' | 'herramientas'>('chat')
  const [uso, setUso] = useState<any>(null)
  const [herramientas, setHerramientas] = useState<any[]>([])
  const [searchHist, setSearchHist] = useState('')
  const [estadoProcesando, setEstadoProcesando] = useState<string>('')
  const [multiIAResultado, setMultiIAResultado] = useState<NonNullable<ChatResponse['multiIAResultado']> | null>(null)
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
        setMultiIAResultado(null)
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
    setMultiIAResultado(null)
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
    setEstadoProcesando('Analizando solicitud...')
    // Mensaje optimista
    const tempUserMsg: Mensaje = {
      id: `temp_${Date.now()}`,
      role: 'user',
      contenido: msg,
      createdAt: new Date().toISOString(),
    }
    setMensajes((prev) => [...prev, tempUserMsg])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    // Simulación de estados para feedback visual
    const timer1 = setTimeout(() => setEstadoProcesando(providerSel === 'multi' ? 'Consultando ZAI + OpenAI en paralelo...' : 'Consultando IA...'), 800)
    const timer2 = setTimeout(() => setEstadoProcesando('Procesando respuesta...'), 2500)

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
        setEstadoProcesando('Verificando respuesta...')
        // Refrescar conversación completa
        if (data.conversationId) {
          await cargarConversacion(data.conversationId)
          await cargarConversaciones()
        }
        if (data.pendienteAprobacion) {
          setEstadoProcesando('Esperando autorización...')
          setPendienteAprobacion(data.pendienteAprobacion)
        }
        if (data.multiIAResultado) {
          setMultiIAResultado(data.multiIAResultado)
        }
        if (data.error && !data.respuesta) {
          toast({ title: 'Error', description: data.error, variant: 'destructive' })
        }
        if (data.bloqueado) {
          toast({
            title: '⚠️ Operación bloqueada',
            description: data.error || data.motivoBloqueo,
            variant: 'destructive',
          })
        }
        setTimeout(() => setEstadoProcesando('Completado'), 300)
      } else {
        toast({ title: 'Error', description: d.error || 'Error desconocido', variant: 'destructive' })
        setMensajes((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      }
    } catch (e: any) {
      toast({ title: 'Error de conexión', description: e.message, variant: 'destructive' })
      setMensajes((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setLoading(false)
      setTimeout(() => setEstadoProcesando(''), 1000)
    }
  }

  // ---------- Confirmar herramienta pendiente ----------
  const confirmarHerramienta = async () => {
    if (!pendienteAprobacion || !conversacionActual) return
    setLoading(true)
    setEstadoProcesando('Ejecutando acción autorizada...')
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
        setEstadoProcesando('Completado')
      } else {
        toast({ title: 'Error', description: d.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setTimeout(() => setEstadoProcesando(''), 1500)
    }
  }

  const cancelarHerramienta = () => {
    setPendienteAprobacion(null)
    toast({ title: 'Acción cancelada' })
  }

  // ---------- Cambiar estado del agente (3 estados) ----------
  const cambiarEstadoAgente = async (nuevoEstado: EstadoAgente) => {
    try {
      const r = await fetch('/api/hub-ia/pausar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const d = await r.json()
      if (d.success) {
        await cargarConfig()
        toast({
          title: `Agente IA: ${nuevoEstado === 'operativo' ? '🟢 Operativo' : nuevoEstado === 'solo_consulta' ? '🟡 Solo Consulta' : '🔴 Bloqueado'}`,
          description:
            nuevoEstado === 'operativo' ? 'El agente puede ejecutar todas las acciones autorizadas.'
            : nuevoEstado === 'solo_consulta' ? 'Solo se permiten consultas. Las modificaciones están bloqueadas.'
            : 'Chat y herramientas completamente deshabilitados.',
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

  // ---------- Cargar herramientas ----------
  const cargarHerramientas = useCallback(async () => {
    try {
      const r = await fetch('/api/hub-ia/herramientas')
      const d = await r.json()
      if (d.success) setHerramientas(d.data.herramientas || [])
    } catch (e) {
      console.error('Error cargando herramientas:', e)
    }
  }, [])

  // ---------- Init ----------
  useEffect(() => {
    cargarConfig()
    cargarConversaciones()
  }, [cargarConfig, cargarConversaciones])

  useEffect(() => {
    if (tab === 'uso' && !uso) cargarUso()
    if (tab === 'herramientas' && herramientas.length === 0) cargarHerramientas()
  }, [tab, uso, herramientas, cargarUso, cargarHerramientas])

  // ---------- Render ----------
  const estadoInfo = (() => {
    const e = config?.estadoAgente || 'operativo'
    if (e === 'operativo') return { label: '🟢 Operativo', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' }
    if (e === 'solo_consulta') return { label: '🟡 Solo Consulta', color: 'bg-amber-100 text-amber-700 hover:bg-amber-100' }
    return { label: '🔴 Bloqueado', color: 'bg-red-100 text-red-700 hover:bg-red-100' }
  })()

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
                  ) : (
                    <Badge className={`text-[10px] ${estadoInfo.color}`}>{estadoInfo.label}</Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hub multi-IA: Z.AI + OpenAI · orquestador con tools, security gateway y auditoría · 20 herramientas
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
                  {config.usoMensual && (
                    <Badge variant="outline" className="text-[10px]" title={`Gastado $${config.usoMensual.gastado.toFixed(2)} de $${config.usoMensual.limite.toFixed(2)}`}>
                      💰 {config.usoMensual.porcentaje.toFixed(0)}% uso mensual
                    </Badge>
                  )}
                  <Select value={config.estadoAgente} onValueChange={(v) => cambiarEstadoAgente(v as EstadoAgente)}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operativo">🟢 Operativo</SelectItem>
                      <SelectItem value="solo_consulta">🟡 Solo Consulta</SelectItem>
                      <SelectItem value="bloqueado">🔴 Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs internos */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { key: 'chat', label: 'Chat', icon: MessageSquare },
          { key: 'historial', label: 'Historial', icon: History },
          { key: 'herramientas', label: 'Herramientas', icon: Cpu },
          { key: 'config', label: 'Configuración', icon: Settings },
          { key: 'uso', label: 'Uso y costos', icon: DollarSign },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.key === 'herramientas' && herramientas.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{herramientas.length}</Badge>
            )}
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
            <Input
              placeholder="Buscar..."
              value={searchHist}
              onChange={(e) => setSearchHist(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="max-h-96 lg:max-h-[600px] overflow-y-auto space-y-1">
              {conversaciones.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Sin conversaciones</p>
              ) : (
                conversaciones
                  .filter((c) => !searchHist || c.titulo.toLowerCase().includes(searchHist.toLowerCase()))
                  .map((c) => (
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
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">⚙️ Automático</SelectItem>
                  <SelectItem value="zai">🤖 Z.AI (GLM)</SelectItem>
                  <SelectItem value="openai">🧠 OpenAI / ChatGPT</SelectItem>
                  <SelectItem value="multi">🔀 Multi-IA (ZAI + OpenAI + comparación)</SelectItem>
                </SelectContent>
              </Select>
              {providerSel === 'multi' && (
                <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300">
                  <GitCompare className="w-3 h-3 mr-1" /> Comparación
                </Badge>
              )}
              {config?.estadoAgente !== 'operativo' && (
                <Badge variant="destructive" className="text-[10px]">
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  {config?.estadoAgente === 'solo_consulta' ? 'Solo consulta' : 'Bloqueado'}
                </Badge>
              )}
            </div>

            {/* Indicador de estado durante procesamiento */}
            {estadoProcesando && (
              <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-md">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{estadoProcesando}</span>
              </div>
            )}

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
                    <p>• "Analiza el módulo de préstamos"</p>
                    <p>• "Genera un reporte de cartera"</p>
                    <p>• "Detecta errores de las últimas 24h"</p>
                    <p>• "Crea una alerta sobre riesgo de liquidez"</p>
                    <p>• "Consulta a ZAI y ChatGPT sobre cómo mejorar el módulo"</p>
                  </div>
                </div>
              ) : (
                mensajes.map((m) => <MensajeItem key={m.id} mensaje={m} />)
              )}
              {loading && !estadoProcesando && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Procesando...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pendiente de aprobación — modal mejorado */}
            {pendienteAprobacion && (
              <Dialog open={!!pendienteAprobacion} onOpenChange={(o) => !o && cancelarHerramienta()}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-5 h-5" />
                      Cambio propuesto — Riesgo {pendienteAprobacion.riesgo.toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                      La IA quiere ejecutar una acción que requiere tu autorización explícita.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-slate-500">Herramienta</div>
                        <div className="font-mono font-semibold">{pendienteAprobacion.toolName}</div>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-slate-500">Módulo afectado</div>
                        <div className="font-semibold">{pendienteAprobacion.moduloAfectado || 'general'}</div>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-slate-500">Nivel de riesgo</div>
                        <Badge variant={
                          pendienteAprobacion.riesgo === 'critico' ? 'destructive'
                          : pendienteAprobacion.riesgo === 'alto' ? 'destructive'
                          : pendienteAprobacion.riesgo === 'medio' ? 'secondary'
                          : 'outline'
                        } className="text-[10px] uppercase">
                          {pendienteAprobacion.riesgo}
                        </Badge>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-slate-500">Registros afectados</div>
                        <div className="font-semibold">
                          {pendienteAprobacion.accionMasiva
                            ? '⚠️ Acción masiva (indeterminado)'
                            : `${pendienteAprobacion.registrosEstimados || 1} registro(s)`}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Descripción</Label>
                      <p className="text-xs text-slate-700 mt-1">{pendienteAprobacion.descripcion}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Parámetros</Label>
                      <pre className="text-[11px] bg-slate-100 p-2 rounded overflow-x-auto max-h-32 mt-1">
                        {JSON.stringify(pendienteAprobacion.args, null, 2)}
                      </pre>
                    </div>
                    {pendienteAprobacion.accionMasiva && (
                      <Alert className="border-red-300 bg-red-50">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-red-900 text-xs">
                          <strong>⚠️ Acción masiva detectada.</strong> Esta operación afecta múltiples registros.
                          Verifica cuidadosamente antes de confirmar. No se puede deshacer.
                        </AlertDescription>
                      </Alert>
                    )}
                    {pendienteAprobacion.riesgo === 'critico' && (
                      <Alert className="border-red-500 bg-red-100">
                        <Ban className="w-4 h-4 text-red-700" />
                        <AlertDescription className="text-red-900 text-xs font-semibold">
                          🚨 ACCIÓN CRÍTICA — Esta operación puede ser irreversible. Confirma solo si estás completamente seguro.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={cancelarHerramienta} disabled={loading}>
                      <XCircle className="w-3 h-3 mr-1" /> Cancelar
                    </Button>
                    <Button onClick={confirmarHerramienta} disabled={loading}
                      className={pendienteAprobacion.riesgo === 'critico' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}>
                      {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                      Confirmar y ejecutar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                disabled={loading || config?.estadoAgente === 'bloqueado'}
              />
              <Button
                onClick={enviarMensaje}
                disabled={loading || !input.trim() || config?.estadoAgente === 'bloqueado'}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {config?.estadoAgente === 'bloqueado' && (
              <p className="text-[10px] text-red-600 text-center">Chat deshabilitado: el agente IA está BLOQUEADO</p>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: HISTORIAL ===== */}
      {tab === 'historial' && <HistorialPanel />}

      {/* ===== TAB: HERRAMIENTAS ===== */}
      {tab === 'herramientas' && (
        <HerramientasPanel herramientas={herramientas} onRefresh={cargarHerramientas} />
      )}

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
// Subcomponente: Mensaje (con renderizado Markdown básico)
// =====================================================

function renderMarkdownLite(text: string): React.ReactNode {
  // Renderizado Markdown ligero: títulos, listas, negritas, código
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let inList = false
  let listItems: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  const flushList = () => {
    if (inList) {
      out.push(<ul key={`ul-${out.length}`} className="list-disc pl-4 my-1 space-y-0.5">{listItems.map((li, i) => <li key={i} className="text-xs">{renderInline(li)}</li>)}</ul>)
      listItems = []
      inList = false
    }
  }
  const flushCode = () => {
    if (inCodeBlock) {
      out.push(<pre key={`pre-${out.length}`} className="bg-slate-800 text-slate-100 p-2 rounded text-[10px] overflow-x-auto my-1">{codeLines.join('\n')}</pre>)
      codeLines = []
      inCodeBlock = false
    }
  }
  function renderInline(s: string): React.ReactNode {
    // **bold** + `code`
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
      if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="bg-slate-200 px-0.5 rounded text-[10px]">{p.slice(1, -1)}</code>
      return <span key={i}>{p}</span>
    })
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) { flushList(); if (inCodeBlock) flushCode(); else inCodeBlock = true; continue }
    if (inCodeBlock) { codeLines.push(line); continue }
    if (line.startsWith('### ')) { flushList(); out.push(<h4 key={`h4-${out.length}`} className="text-xs font-semibold mt-2">{line.slice(4)}</h4>); continue }
    if (line.startsWith('## ')) { flushList(); out.push(<h3 key={`h3-${out.length}`} className="text-sm font-semibold mt-2">{line.slice(3)}</h3>); continue }
    if (line.startsWith('# ')) { flushList(); out.push(<h2 key={`h2-${out.length}`} className="text-base font-bold mt-2">{line.slice(2)}</h2>); continue }
    if (/^\s*[-*•]\s+/.test(line)) { inList = true; listItems.push(line.replace(/^\s*[-*•]\s+/, '')); continue }
    flushList()
    if (line.trim() === '') { out.push(<div key={`br-${out.length}`} className="h-1" />); continue }
    out.push(<p key={`p-${out.length}`} className="text-xs">{renderInline(line)}</p>)
  }
  flushList()
  flushCode()
  return <>{out}</>
}

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
          {isAssistant ? renderMarkdownLite(mensaje.contenido) : <div className="whitespace-pre-wrap">{mensaje.contenido}</div>}
        </div>
        {isAssistant && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 flex-wrap">
            {mensaje.provider && <Badge variant="outline" className="text-[9px] h-3.5 px-1">{mensaje.provider}</Badge>}
            {mensaje.modelo && <span>· {mensaje.modelo}</span>}
            {(mensaje.tokensInput || mensaje.tokensOutput) && (
              <span>· {mensaje.tokensInput || 0}↑ {mensaje.tokensOutput || 0}↓ tok</span>
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
                ✓ aprobado
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
              <Label className="text-[10px] text-slate-600">API Key (cifrada AES-256)</Label>
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
                <SelectItem value="multi">Multi-IA (ZAI + OpenAI + comparación)</SelectItem>
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
            {config.usoMensual && (
              <div className="mt-2 text-[10px] text-slate-500">
                Uso actual: ${config.usoMensual.gastado.toFixed(2)} / ${config.usoMensual.limite.toFixed(2)} ({config.usoMensual.porcentaje.toFixed(1)}%)
                <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full ${config.usoMensual.porcentaje > 80 ? 'bg-red-500' : config.usoMensual.porcentaje > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, config.usoMensual.porcentaje)}%` }} />
                </div>
              </div>
            )}
          </div>
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-[11px] text-blue-800">
              🔒 Las API keys se cifran con AES-256-CBC antes de almacenarse y nunca se exponen al frontend.
              Las herramientas de modificación requieren confirmación explícita del administrador.
              El agente opera bajo Zero Trust: ningún input externo es tratado como instrucción confiable.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// Subcomponente: Panel de Herramientas (nuevo)
// =====================================================

function HerramientasPanel({ herramientas, onRefresh }: { herramientas: any[]; onRefresh: () => void }) {
  const [filtroRiesgo, setFiltroRiesgo] = useState<string>('todos')
  const [search, setSearch] = useState('')

  const filtradas = herramientas.filter((h) => {
    if (filtroRiesgo !== 'todos' && h.riesgo !== filtroRiesgo) return false
    if (search && !h.name.includes(search.toLowerCase()) && !h.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const riesgoColor = (r: string) =>
    r === 'critico' ? 'bg-red-100 text-red-700'
    : r === 'alto' ? 'bg-orange-100 text-orange-700'
    : r === 'medio' ? 'bg-amber-100 text-amber-700'
    : 'bg-emerald-100 text-emerald-700'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Herramientas del Agente IA
            <Badge variant="secondary" className="text-[10px]">{herramientas.length} herramientas</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs w-40"
            />
            <Select value={filtroRiesgo} onValueChange={setFiltroRiesgo}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los riesgos</SelectItem>
                <SelectItem value="bajo">🟢 Bajo</SelectItem>
                <SelectItem value="medio">🟡 Medio</SelectItem>
                <SelectItem value="alto">🟠 Alto</SelectItem>
                <SelectItem value="critico">🔴 Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={onRefresh} className="h-7 text-xs">
              <Zap className="w-3 h-3 mr-1" /> Refrescar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtradas.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Sin herramientas que coincidan</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtradas.map((h) => (
              <div key={h.name} className="p-2 border border-slate-200 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-[11px] font-semibold text-indigo-700">{h.name}</code>
                  <Badge className={`text-[9px] ${riesgoColor(h.riesgo)}`}>{h.riesgo}</Badge>
                </div>
                <p className="text-[10px] text-slate-600">{h.description}</p>
                {h.parameters?.properties && Object.keys(h.parameters.properties).length > 0 && (
                  <div className="mt-1 text-[9px] text-slate-500">
                    <span className="font-medium">Parámetros:</span>{' '}
                    {Object.keys(h.parameters.properties).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
        const r = await fetch('/api/hub-ia/conversaciones')
        const d = await r.json()
        if (d.success) {
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
                <div className="text-[10px] text-slate-500 mt-1 flex gap-3 flex-wrap">
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
