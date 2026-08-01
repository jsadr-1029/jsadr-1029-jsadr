'use client'

// =====================================================
// AsistenteIAPanel — Panel del bot Clientes
// Muestra: interruptor ON/OFF, KPIs del bot, gestión de FAQs
// Se integra dentro de CentroComunicacionesView
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Bot,
  Sparkles,
  TrendingUp,
  Clock,
  HelpCircle,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Activity,
  MessageCircle,
} from 'lucide-react'

// === Tipos ===
interface Faq {
  id: string
  pregunta: string
  respuesta: string
  categoria: string | null
  palabrasClave: string | null
  activa: boolean
  vecesUsada: number
}

interface Stats {
  conversaciones: {
    total: number
    activas: number
    pendientes: number
    porDia: Array<{ dia: string; total: number; activas: number; finalizadas: number }>
    horaPico: number
    conversacionesEnHoraPico: number
  }
  mensajes: {
    total: number
    cliente: number
    asesor: number
    sistema: number
    tasaAutomatizacion: number
  }
  faqs: {
    total: number
    topUsadas: Array<{ id: string; pregunta: string; vecesUsada: number; categoria: string | null }>
  }
  tiempoPromedioRespuestaMs: number | null
  config: Record<string, string>
}

export function AsistenteIAPanel() {
  const { toast } = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [modoAuto, setModoAuto] = useState(true)
  const [llmActivado, setLlmActivado] = useState(false) // LLM desactivado por defecto
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [dialogFaq, setDialogFaq] = useState(false)
  const [faqEditando, setFaqEditando] = useState<Faq | null>(null)

  // Formulario FAQ
  const [faqPregunta, setFaqPregunta] = useState('')
  const [faqRespuesta, setFaqRespuesta] = useState('')
  const [faqCategoria, setFaqCategoria] = useState('')
  const [faqPalabras, setFaqPalabras] = useState('')
  const [guardandoFaq, setGuardandoFaq] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, faqsRes] = await Promise.all([
        fetch('/api/bots/stats'),
        fetch('/api/bots/faqs?activas=false'),
      ])
      const statsJson = await statsRes.json()
      const faqsJson = await faqsRes.json()

      if (statsJson.success) {
        setStats(statsJson.data)
        setModoAuto(statsJson.data.config?.asistente_ia_automatico !== 'false')
        setLlmActivado(statsJson.data.config?.asistente_ia_llm === 'true')
      }
      if (faqsJson.success) {
        setFaqs(faqsJson.data)
      }
    } catch (e: any) {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // === Guardar modo automático ===
  const toggleModoAuto = async (nuevoValor: boolean) => {
    setModoAuto(nuevoValor)
    setGuardandoConfig(true)
    try {
      const res = await fetch('/api/bots/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: 'asistente_ia_automatico',
          valor: nuevoValor ? 'true' : 'false',
          descripcion: 'Modo automático del bot Clientes',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: nuevoValor ? 'Asistente IA activado' : 'Asistente IA desactivado',
          description: nuevoValor
            ? 'El bot responderá automáticamente a los clientes.'
            : 'Las conversaciones serán atendidas manualmente por el administrador.',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
      setModoAuto(!nuevoValor) // revertir
    } finally {
      setGuardandoConfig(false)
    }
  }

  // === Toggle LLM ===
  const toggleLLM = async (nuevoValor: boolean) => {
    setLlmActivado(nuevoValor)
    setGuardandoConfig(true)
    try {
      const res = await fetch('/api/bots/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave: 'asistente_ia_llm',
          valor: nuevoValor ? 'true' : 'false',
          descripcion: 'Usar LLM (IA real) en vez de patrones para responder',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: nuevoValor ? 'LLM activado' : 'LLM desactivado',
          description: nuevoValor
            ? 'El bot usará IA real (GLM) con contexto completo del cliente y FAQs.'
            : 'El bot usará respuestas por patrones (más rápido, menos flexible).',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
      setLlmActivado(!nuevoValor)
    } finally {
      setGuardandoConfig(false)
    }
  }

  // === Guardar FAQ ===
  const guardarFaq = async () => {
    if (!faqPregunta.trim() || !faqRespuesta.trim()) {
      toast({ title: 'Campos requeridos', description: 'Pregunta y respuesta son obligatorios.', variant: 'destructive' })
      return
    }
    setGuardandoFaq(true)
    try {
      const url = faqEditando ? `/api/bots/faqs/${faqEditando.id}` : '/api/bots/faqs'
      const method = faqEditando ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: faqPregunta.trim(),
          respuesta: faqRespuesta.trim(),
          categoria: faqCategoria.trim() || null,
          palabrasClave: faqPalabras.trim() || null,
          activa: true,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: faqEditando ? 'FAQ actualizada' : 'FAQ creada',
          description: 'La pregunta frecuente se guardó correctamente.',
        })
        setDialogFaq(false)
        setFaqEditando(null)
        setFaqPregunta('')
        setFaqRespuesta('')
        setFaqCategoria('')
        setFaqPalabras('')
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardandoFaq(false)
    }
  }

  // === Eliminar FAQ ===
  const eliminarFaq = async (id: string) => {
    if (!confirm('¿Eliminar esta pregunta frecuente?')) return
    try {
      await fetch(`/api/bots/faqs/${id}`, { method: 'DELETE' })
      toast({ title: 'FAQ eliminada' })
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Editar FAQ ===
  const editarFaq = (faq: Faq) => {
    setFaqEditando(faq)
    setFaqPregunta(faq.pregunta)
    setFaqRespuesta(faq.respuesta)
    setFaqCategoria(faq.categoria || '')
    setFaqPalabras(faq.palabrasClave || '')
    setDialogFaq(true)
  }

  // === Nueva FAQ ===
  const nuevaFaq = () => {
    setFaqEditando(null)
    setFaqPregunta('')
    setFaqRespuesta('')
    setFaqCategoria('')
    setFaqPalabras('')
    setDialogFaq(true)
  }

  // === Formatear tiempo promedio ===
  const fmtTiempo = (ms: number | null): string => {
    if (ms === null) return 'Sin datos'
    const min = Math.floor(ms / 60000)
    if (min < 1) return '< 1 min'
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60)
    return `${h}h ${min % 60}min`
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold">Asistente IA de Clientes</p>
              <p className="text-xs text-muted-foreground font-normal">Customer Success AI — atención automática</p>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={nuevaFaq}>
              <Plus className="w-4 h-4" /> Nueva FAQ
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Interruptor modo automático */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${modoAuto ? 'bg-emerald-500/15' : 'bg-zinc-500/15'}`}>
              <Bot className={`w-5 h-5 ${modoAuto ? 'text-emerald-300' : 'text-zinc-300'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">Asistente IA Automático</p>
              <p className="text-xs text-muted-foreground">
                {modoAuto ? '🟢 Activo — respondiendo clientes automáticamente' : '🔴 Inactivo — el admin responde manualmente'}
              </p>
            </div>
          </div>
          <Switch
            checked={modoAuto}
            onCheckedChange={toggleModoAuto}
            disabled={guardandoConfig}
          />
        </div>

        {/* Interruptor LLM (IA real vs patrones) */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${llmActivado ? 'bg-violet-500/15' : 'bg-zinc-500/15'}`}>
              <Sparkles className={`w-5 h-5 ${llmActivado ? 'text-violet-300' : 'text-zinc-300'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">IA Real (LLM GLM)</p>
              <p className="text-xs text-muted-foreground">
                {llmActivado
                  ? '🟣 Activo — respuestas con IA real y contexto completo (cliente + FAQs + historial)'
                  : '⚪ Inactivo — usando patrones y FAQs (más rápido, menos flexible)'}
              </p>
            </div>
          </div>
          <Switch
            checked={llmActivado}
            onCheckedChange={toggleLLM}
            disabled={guardandoConfig}
          />
        </div>

        {/* KPIs del bot */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Activity className="w-4 h-4 mx-auto mb-1 text-emerald-300" />
              <p className="text-lg font-bold">{stats.mensajes.tasaAutomatizacion}%</p>
              <p className="text-[10px] text-muted-foreground">Automatización</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-cyan-300" />
              <p className="text-lg font-bold">{fmtTiempo(stats.tiempoPromedioRespuestaMs)}</p>
              <p className="text-[10px] text-muted-foreground">Tiempo respuesta</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <MessageCircle className="w-4 h-4 mx-auto mb-1 text-violet-300" />
              <p className="text-lg font-bold">{stats.mensajes.cliente}</p>
              <p className="text-[10px] text-muted-foreground">Msgs clientes</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <HelpCircle className="w-4 h-4 mx-auto mb-1 text-amber-300" />
              <p className="text-lg font-bold">{stats.faqs.total}</p>
              <p className="text-[10px] text-muted-foreground">FAQs activas</p>
            </div>
          </div>
        )}

        {/* Top FAQs más usadas */}
        {stats && stats.faqs.topUsadas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> FAQs más consultadas
            </p>
            <div className="space-y-1.5">
              {stats.faqs.topUsadas.map((faq, i) => (
                <div key={faq.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-white/5 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">#{i + 1}</span>
                    <span className="truncate">{faq.pregunta}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {faq.vecesUsada} usos
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de FAQs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Preguntas frecuentes ({faqs.length})
            </p>
          </div>
          {faqs.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
              No hay FAQs configuradas. Crea la primera con "Nueva FAQ".
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {faqs.map((faq) => (
                <div key={faq.id} className="p-2.5 rounded-md bg-white/5 border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold truncate flex-1">{faq.pregunta}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {faq.activa ? (
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-400/30">Activa</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] bg-zinc-500/10 text-zinc-300 border-zinc-400/30">Inactiva</Badge>
                      )}
                      <button onClick={() => editarFaq(faq)} className="text-muted-foreground hover:text-primary" title="Editar">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => eliminarFaq(faq.id)} className="text-muted-foreground hover:text-red-400" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{faq.respuesta}</p>
                  {faq.categoria && (
                    <Badge variant="outline" className="text-[9px] mt-1">{faq.categoria}</Badge>
                  )}
                  {faq.vecesUsada > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-2">{faq.vecesUsada} usos</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* === Modal crear/editar FAQ === */}
      <Dialog open={dialogFaq} onOpenChange={(o) => { if (!guardandoFaq) setDialogFaq(o) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{faqEditando ? 'Editar FAQ' : 'Nueva FAQ'}</DialogTitle>
            <DialogDescription>
              Configura una pregunta frecuente para el bot Clientes. Cuando un cliente escriba algo que coincida con las palabras clave, el bot responderá automáticamente con la respuesta configurada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pregunta *</Label>
              <Input
                value={faqPregunta}
                onChange={(e) => setFaqPregunta(e.target.value)}
                placeholder="ej: ¿Cómo solicito un préstamo?"
                maxLength={500}
              />
            </div>
            <div>
              <Label className="text-xs">Respuesta *</Label>
              <Textarea
                value={faqRespuesta}
                onChange={(e) => setFaqRespuesta(e.target.value)}
                placeholder="Respuesta que el bot dará al cliente..."
                rows={5}
                maxLength={5000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoría</Label>
                <Input
                  value={faqCategoria}
                  onChange={(e) => setFaqCategoria(e.target.value)}
                  placeholder="PRESTAMOS, PAGOS, REQUISITOS..."
                  maxLength={50}
                />
              </div>
              <div>
                <Label className="text-xs">Palabras clave (coma)</Label>
                <Input
                  value={faqPalabras}
                  onChange={(e) => setFaqPalabras(e.target.value)}
                  placeholder="solicitar, credito, requisitos"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              💡 Las palabras clave ayudan al bot a identificar cuándo usar esta respuesta. Sepáralas por comas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFaq(false)} disabled={guardandoFaq}>
              Cancelar
            </Button>
            <Button onClick={guardarFaq} disabled={guardandoFaq}>
              {guardandoFaq ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
              ) : (
                faqEditando ? 'Guardar cambios' : 'Crear FAQ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
