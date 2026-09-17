'use client'

// =====================================================
// Vista: Chat — Neobanco Glass
// Chat con asesor. UI estilo iMessage/WhatsApp: burbujas,
// timestamps, indicador de escritura, mensajes rápidos.
// Usa el endpoint existente del hub-ia o similar.
// =====================================================

import * as React from 'react'
import { GlassCard, GlassButton, Chip, EmptyState, useNbToast } from '../ui'
import { type NbCliente } from '../useNeobancoPortal'
import { Send, MessageSquare, Sparkles, Paperclip, Headset } from 'lucide-react'

type ChatViewProps = {
  cliente: NbCliente | null
  token: string | null
  cedula: string | null
}

type Mensaje = {
  id: string
  autor: 'cliente' | 'asesor'
  texto: string
  timestamp: number
  leido?: boolean
}

const MENSAJES_RAPIDOS = [
  '¿Cómo cambio mi fecha de pago?',
  'Quiero solicitar un refinanciamiento',
  'No recibí mi factura',
  '¿Puedo pagar antes de la fecha?',
]

export function ChatView({ cliente, token, cedula }: ChatViewProps) {
  const toast = useNbToast()
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([])
  const [input, setInput] = React.useState('')
  const [enviando, setEnviando] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Mensaje de bienvenida
  React.useEffect(() => {
    if (cliente && mensajes.length === 0) {
      setMensajes([
        {
          id: 'welcome',
          autor: 'asesor',
          texto: `¡Hola ${cliente.nombre.split(' ')[0]}! 👋 Soy tu asesor financiero. ¿En qué puedo ayudarte hoy?`,
          timestamp: Date.now(),
          leido: true,
        },
      ])
    }
  }, [cliente, mensajes.length])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes])

  const enviar = async (texto: string) => {
    if (!texto.trim() || !token || !cedula) return
    const nuevo: Mensaje = {
      id: Date.now().toString(),
      autor: 'cliente',
      texto: texto.trim(),
      timestamp: Date.now(),
    }
    setMensajes((prev) => [...prev, nuevo])
    setInput('')
    setEnviando(true)
    try {
      const res = await fetch('/api/centro-comunicaciones/mensaje-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-token': token },
        body: JSON.stringify({
          cedula,
          mensaje: texto.trim(),
          clienteNombre: cliente?.nombre,
        }),
      })
      if (!res.ok) throw new Error('No se pudo enviar')
      // Respuesta simulada del asesor
      setTimeout(() => {
        setMensajes((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            autor: 'asesor',
            texto: 'Gracias por tu mensaje. Te respondo en breve. 🙌',
            timestamp: Date.now(),
            leido: true,
          },
        ])
      }, 1200)
    } catch {
      toast.push('No se pudo enviar el mensaje', 'danger')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col h-full pb-6">
      <header className="px-1 pb-3">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Chat con asesor
        </h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-[var(--nb-success)] animate-pulse" />
          <p className="text-[13px] text-[var(--nb-fg-muted)]">Tu asesor está en línea</p>
        </div>
      </header>

      {/* Panel del asesor */}
      <GlassCard radius="lg">
        <div className="p-3.5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--nb-gradient-brand)] flex items-center justify-center text-white">
            <Headset size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var(--nb-fg)]">Asesor financiero</p>
            <p className="text-[11px] text-[var(--nb-fg-muted)]">Responde en ~2 min</p>
          </div>
          <Chip tone="success" size="sm">
            En línea
          </Chip>
        </div>
      </GlassCard>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-2.5 mt-3 px-1"
        style={{ minHeight: '280px', maxHeight: 'calc(100vh - 360px)' }}
      >
        {mensajes.map((m) => (
          <MensajeBubble key={m.id} mensaje={m} />
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="nb-glass-2 px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--nb-fg-muted)] animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--nb-fg-muted)] animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--nb-fg-muted)] animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Mensajes rápidos */}
      <div className="flex gap-2 overflow-x-auto pb-2 pt-2">
        {MENSAJES_RAPIDOS.map((m) => (
          <button
            key={m}
            onClick={() => enviar(m)}
            className="nb-press shrink-0 px-3 h-8 rounded-full bg-[var(--nb-surface-2)] border border-[var(--nb-border)] text-[12px] font-medium text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)] hover:border-[var(--nb-border-strong)] whitespace-nowrap"
          >
            {m}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 mt-2">
        <button
          aria-label="Adjuntar"
          className="nb-press w-11 h-11 rounded-2xl nb-glass flex items-center justify-center text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)] shrink-0"
        >
          <Paperclip size={16} />
        </button>
        <div className="flex-1 flex items-end gap-2 nb-glass rounded-2xl px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(input)
              }
            }}
            rows={1}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-transparent outline-none text-[14px] text-[var(--nb-fg)] placeholder:text-[var(--nb-fg-subtle)] resize-none max-h-24"
            style={{ minHeight: '28px' }}
          />
          <button
            aria-label="Enviar"
            onClick={() => enviar(input)}
            disabled={!input.trim() || enviando}
            className="nb-press w-9 h-9 rounded-xl bg-[var(--nb-gradient-brand)] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function MensajeBubble({ mensaje }: { mensaje: Mensaje }) {
  const esCliente = mensaje.autor === 'cliente'
  return (
    <div className={`flex ${esCliente ? 'justify-end' : 'justify-start'} nb-anim-fade`}>
      <div className={`max-w-[78%] flex flex-col ${esCliente ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 text-[14px] leading-relaxed ${
            esCliente
              ? 'bg-[var(--nb-gradient-brand)] text-white rounded-2xl rounded-br-md shadow-[0_4px_12px_-2px_rgba(91,91,247,0.4)]'
              : 'nb-glass-2 text-[var(--nb-fg)] rounded-2xl rounded-bl-md'
          }`}
        >
          {mensaje.texto}
        </div>
        <span className="text-[10px] text-[var(--nb-fg-subtle)] mt-1 px-1">
          {new Date(mensaje.timestamp).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
