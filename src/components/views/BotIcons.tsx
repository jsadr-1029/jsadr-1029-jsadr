'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda } from '@/lib/finanzas'
import {
  Bot as BotIcon, MessageCircle, ShieldCheck, Calculator,
  CreditCard, ShieldAlert, Send, Loader2, Sparkles, X,
  ChevronUp, ChevronDown,
  Banknote, Scale, Lock, Settings2, SlidersHorizontal,
} from 'lucide-react'

// =====================================================
// BotIcons — Componente visual que muestra los bots
// disponibles para cada módulo. Al hacer click en un bot,
// abre un mini-chat donde el usuario puede interactuar.
// =====================================================

interface Bot {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  instrucciones: string | null
  activo: boolean
}

interface BotIconsProps {
  // Módulo actual: determina qué bots se muestran
  modulo: 'prestamos' | 'pagos' | 'juridico' | 'seguridad' | 'admin' | 'comunicaciones' | 'portal' | 'automatizacion' | 'configuracion'
}

// Mapeo de módulos a tipos de bot que pueden ayudar
const MODULO_BOTS: Record<string, string[]> = {
  prestamos: ['PRESTAMOS', 'CHAT_CLIENTES', 'ADMIN_SISTEMA', 'CONTABILIDAD'],
  pagos: ['PAGOS', 'ADMIN_SISTEMA', 'CONTABILIDAD'],
  juridico: ['JURIDICO', 'ADMIN_SISTEMA'],
  seguridad: ['SEGURIDAD', 'ADMIN_SISTEMA'],
  admin: ['ADMIN_GENERAL', 'CONTABILIDAD', 'ADMIN_SISTEMA'],
  comunicaciones: ['CHAT_CLIENTES', 'ADMIN_SISTEMA'],
  portal: ['CHAT_CLIENTES'],
  automatizacion: ['ADMIN_SISTEMA', 'PAGOS', 'CONTABILIDAD', 'CHAT_CLIENTES', 'PRESTAMOS', 'JURIDICO', 'SEGURIDAD', 'ADMIN_GENERAL', 'CONFIGURACION'],
  configuracion: ['CONFIGURACION', 'ADMIN_SISTEMA'],
}

// Configuración visual de cada bot
const BOT_CONFIG: Record<string, { icon: any; color: string; bgColor: string; emoji: string }> = {
  'CHAT_CLIENTES': { icon: MessageCircle, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', emoji: '💬' },
  'ADMIN_SISTEMA': { icon: ShieldCheck, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', emoji: '🛡️' },
  'CONTABILIDAD': { icon: Calculator, color: 'text-amber-400', bgColor: 'bg-amber-500/10', emoji: '🧮' },
  'PAGOS': { icon: CreditCard, color: 'text-violet-400', bgColor: 'bg-violet-500/10', emoji: '💳' },
  'PRESTAMOS': { icon: Banknote, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', emoji: '💵' },
  'JURIDICO': { icon: Scale, color: 'text-rose-500', bgColor: 'bg-rose-500/10', emoji: '⚖️' },
  'SEGURIDAD': { icon: Lock, color: 'text-red-500', bgColor: 'bg-red-500/10', emoji: '🔒' },
  'ADMIN_GENERAL': { icon: SlidersHorizontal, color: 'text-orange-500', bgColor: 'bg-orange-500/10', emoji: '📊' },
  'CONFIGURACION': { icon: Settings2, color: 'text-teal-500', bgColor: 'bg-teal-500/10', emoji: '⚙️' },
}

export function BotIcons({ modulo }: BotIconsProps) {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [botSeleccionado, setBotSeleccionado] = useState<Bot | null>(null)
  const [modalChat, setModalChat] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mostrarTooltip, setMostrarTooltip] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    cargarBots()
  }, [modulo])

  const cargarBots = async () => {
    try {
      const res = await fetch('/api/bots')
      const json = await res.json()
      if (json.success) {
        const tiposPermitidos = MODULO_BOTS[modulo] || []
        const botsFiltrados = json.data.filter((b: Bot) =>
          b.activo && tiposPermitidos.includes(b.tipo)
        )
        setBots(botsFiltrados)
      }
    } catch (e) {
      console.error('Error cargando bots:', e)
    } finally {
      setLoading(false)
    }
  }

  const abrirBot = (bot: Bot) => {
    setBotSeleccionado(bot)
    setRespuesta('')
    setMensaje('')
    setModalChat(true)
  }

  const enviarAlBot = async () => {
    if (!mensaje.trim() || !botSeleccionado) return
    setEnviando(true)
    setRespuesta('')

    try {
      const res = await fetch('/api/admin/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: mensaje.trim(),
          token: 'bot-direct',
          botId: botSeleccionado.id,
          botTipo: botSeleccionado.tipo,
          botNombre: botSeleccionado.nombre,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setRespuesta(json.data.respuesta || 'No pude procesar esa instrucción.')
      } else {
        setRespuesta('🤖 Soy ' + botSeleccionado.nombre + '. Mi función principal es: ' + (botSeleccionado.descripcion || 'asistirte') + '.\n\nEscribe una instrucción y la procesaré.')
      }
    } catch (e: any) {
      // Si la API falla, mostrar info del bot
      setRespuesta('🤖 Soy ' + botSeleccionado.nombre + '.\n\n📋 Mis instrucciones son:\n' + (botSeleccionado.instrucciones?.substring(0, 500) || 'No disponibles') + '...')
    } finally {
      setEnviando(false)
    }
  }

  if (loading || bots.length === 0) return null

  return (
    <>
      {/* === Barra de bots visuales === */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Bots disponibles:
          </span>
        </div>
        {bots.map((bot) => {
          const config = BOT_CONFIG[bot.tipo] || BOT_CONFIG['ADMIN_SISTEMA']
          const Icon = config.icon
          return (
            <button
              key={bot.id}
              onClick={() => abrirBot(bot)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all hover:scale-105 ${config.bgColor} border-white/10 hover:border-white/30`}
              title={bot.descripcion || bot.nombre}
            >
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              <span className="text-[11px] font-medium">{bot.nombre}</span>
              <span className="text-[9px] text-muted-foreground">{config.emoji}</span>
            </button>
          )
        })}
      </div>

      {/* === Modal mini-chat del bot === */}
      <Dialog open={modalChat} onOpenChange={setModalChat}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {botSeleccionado && (() => {
                const config = BOT_CONFIG[botSeleccionado.tipo] || BOT_CONFIG['ADMIN_SISTEMA']
                const Icon = config.icon
                return (
                  <>
                    <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div>
                      <div>{botSeleccionado.nombre}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{botSeleccionado.descripcion?.substring(0, 60)}...</div>
                    </div>
                  </>
                )
              })()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Respuesta del bot */}
            {respuesta && (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {respuesta}
              </div>
            )}

            {/* Info del bot si no hay respuesta */}
            {!respuesta && botSeleccionado && (
              <div className="p-3 rounded-lg bg-muted/30 border text-xs space-y-1">
                <p className="font-semibold">{botSeleccionado.nombre}</p>
                <p className="text-muted-foreground">{botSeleccionado.descripcion}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-2">
                  💡 Escribe una instrucción o pregunta para el bot:
                </p>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviarAlBot()
                  }
                }}
                placeholder="Escribe tu instrucción..."
                className="flex-1 px-3 py-2 rounded-lg bg-muted border text-sm"
                disabled={enviando}
              />
              <Button
                size="sm"
                onClick={enviarAlBot}
                disabled={enviando || !mensaje.trim()}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
