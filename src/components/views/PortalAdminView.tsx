'use client'

// =====================================================
// PortalAdminView — Portal del Administrador Principal
// Chat directo entre el administrador y el sistema/bot.
// El admin da instrucciones (ej: "aplica este gasto de $50.000")
// y el sistema reconoce la tarea y la ejecuta.
// =====================================================

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFechaHora } from '@/lib/finanzas'
import {
  Shield, Lock, LogOut, Eye, EyeOff, Send, Bot, User,
  TrendingUp, TrendingDown, DollarSign, Calendar, Activity,
  CheckCircle, AlertTriangle, Loader2, Sparkles,
} from 'lucide-react'

interface SesionAdmin {
  token: string
  expira: string
  usuario: string
  nombre: string
}

interface MensajeChat {
  id: string
  rol: 'ADMIN' | 'SISTEMA'
  contenido: string
  timestamp: string
  tipo?: 'TEXTO' | 'ACCION' | 'REPORTE' | 'CONFIRMACION'
  accionEjecutada?: boolean
  detalleAccion?: string
}

export function PortalAdminView() {
  const [sesion, setSesion] = useState<SesionAdmin | null>(null)
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [showClave, setShowClave] = useState(false)
  const [cargando, setCargando] = useState(false)

  // Chat
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Stats del sistema
  const [stats, setStats] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    const guardada = sessionStorage.getItem('portal_admin_sesion')
    if (guardada) {
      try {
        const parsed = JSON.parse(guardada) as SesionAdmin
        fetch(`/api/admin/portal/auth?token=${encodeURIComponent(parsed.token)}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.success) {
              setSesion(parsed)
              cargarMensajes()
              cargarStats()
            } else {
              sessionStorage.removeItem('portal_admin_sesion')
            }
          })
          .catch(() => sessionStorage.removeItem('portal_admin_sesion'))
      } catch {
        sessionStorage.removeItem('portal_admin_sesion')
      }
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    try {
      const res = await fetch('/api/admin/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave }),
      })
      const json = await res.json()
      if (json.success) {
        setSesion(json.data)
        sessionStorage.setItem('portal_admin_sesion', JSON.stringify(json.data))
        toast({ title: `Bienvenido, ${json.data.nombre}` })
        setUsuario('')
        setClave('')
        cargarMensajes()
        cargarStats()
      } else {
        toast({ title: 'No se pudo iniciar sesión', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error de red', description: e.message, variant: 'destructive' })
    } finally {
      setCargando(false)
    }
  }

  const cerrarSesion = () => {
    sessionStorage.removeItem('portal_admin_sesion')
    setSesion(null)
    setMensajes([])
    setStats(null)
    toast({ title: 'Sesión cerrada' })
  }

  const cargarMensajes = async () => {
    try {
      const res = await fetch('/api/admin/portal/chat')
      const json = await res.json()
      if (json.success && json.data) {
        setMensajes(json.data)
      }
    } catch (e) {
      console.error('Error cargando mensajes:', e)
    }
  }

  const cargarStats = async () => {
    try {
      const res = await fetch('/api/admin/finanzas?resumen=true')
      const json = await res.json()
      if (json.success) {
        setStats(json.data)
      }
    } catch (e) {
      console.error('Error cargando stats:', e)
    }
  }

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim()) return
    const mensaje = nuevoMensaje.trim()
    setNuevoMensaje('')
    setEnviando(true)

    // Agregar mensaje del admin inmediatamente
    const mensajeAdmin: MensajeChat = {
      id: `temp-${Date.now()}`,
      rol: 'ADMIN',
      contenido: mensaje,
      timestamp: new Date().toISOString(),
      tipo: 'TEXTO',
    }
    setMensajes((prev) => [...prev, mensajeAdmin])

    try {
      const res = await fetch('/api/admin/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, token: sesion?.token }),
      })
      const json = await res.json()
      if (json.success) {
        // Agregar respuesta del sistema
        if (json.data.respuesta) {
          const respuestaSistema: MensajeChat = {
            id: `sistema-${Date.now()}`,
            rol: 'SISTEMA',
            contenido: json.data.respuesta,
            timestamp: new Date().toISOString(),
            tipo: json.data.tipo || 'TEXTO',
            accionEjecutada: json.data.accionEjecutada,
            detalleAccion: json.data.detalleAccion,
          }
          setMensajes((prev) => [...prev, respuestaSistema])
        }
        // Si se ejecutó una acción, refrescar stats
        if (json.data.accionEjecutada) {
          cargarStats()
          toast({
            title: '✅ Acción ejecutada',
            description: json.data.detalleAccion || 'El sistema procesó tu instrucción',
            duration: 5000,
          })
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  // === LOGIN ===
  if (!sesion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg mb-2">
              <Shield className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">Portal Administrador</CardTitle>
            <p className="text-sm text-muted-foreground">
              Acceso exclusivo del administrador principal
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={iniciarSesion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usuario-admin">Usuario</Label>
                <Input
                  id="usuario-admin"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  placeholder="Usuario administrador"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clave-admin">Clave</Label>
                <div className="relative">
                  <Input
                    id="clave-admin"
                    type={showClave ? 'text' : 'password'}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    placeholder="Clave"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClave(!showClave)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? 'Verificando...' : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Ingresar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === PANEL DEL ADMINISTRADOR ===
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Portal Administrador — {sesion.nombre}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chat directo con el sistema · Da instrucciones y el bot las ejecuta
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cerrarSesion}>
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>

      {/* Stats rápidas del sistema */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Ingresos mes</p>
                  <p className="text-base font-bold text-emerald-400">
                    {stats.resumen ? formatearMoneda(stats.resumen.ingresosMes || 0) : '—'}
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Gastos mes</p>
                  <p className="text-base font-bold text-red-400">
                    {stats.resumen ? formatearMoneda(stats.resumen.gastosMes || 0) : '—'}
                  </p>
                </div>
                <TrendingDown className="w-5 h-5 text-red-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Balance</p>
                  <p className="text-base font-bold text-blue-400">
                    {stats.resumen ? formatearMoneda((stats.resumen.ingresosMes || 0) - (stats.resumen.gastosMes || 0)) : '—'}
                  </p>
                </div>
                <DollarSign className="w-5 h-5 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-violet-500/5 border-violet-500/20">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Solicitudes activos</p>
                  <p className="text-base font-bold text-violet-400">
                    {stats.resumen?.prestamosActivos || 0}
                  </p>
                </div>
                <Activity className="w-5 h-5 text-violet-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === CHAT PRINCIPAL === */}
      <Card className="flex flex-col" style={{ height: 'calc(100vh - 350px)', minHeight: '400px' }}>
        {/* Header del chat */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sistema Jsadr</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En línea · Procesa instrucciones en tiempo real
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Bot activo
          </Badge>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mensajes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay mensajes aún.</p>
              <p className="text-xs mt-1">
                Escribe una instrucción como:
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground/70">
                <p>"Registra un gasto de $50.000 en transporte"</p>
                <p>"¿Cómo va el balance del mes?"</p>
                <p>"Muéstrame los solicitudes en mora"</p>
                <p>"Crea un evento para pagar la tarjeta el 30"</p>
              </div>
            </div>
          )}
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.rol === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
            >
              {m.rol === 'SISTEMA' && (
                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
              )}
              <div
                className={`rounded-lg p-3 text-sm ${
                  m.rol === 'ADMIN'
                    ? 'max-w-[75%] bg-primary text-primary-foreground'
                    : m.tipo === 'ACCION'
                    ? 'max-w-[85%] bg-emerald-500/15 border border-emerald-500/30 text-foreground'
                    : m.tipo === 'REPORTE'
                    ? 'max-w-[90%] bg-blue-500/15 border border-blue-500/30 text-foreground'
                    : 'max-w-[90%] bg-muted text-foreground'
                }`}
              >
                {m.tipo === 'ACCION' && (
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-emerald-400 font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    ACCIÓN EJECUTADA
                  </div>
                )}
                {m.tipo === 'REPORTE' && (
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-blue-400 font-semibold">
                    <Activity className="w-3 h-3" />
                    REPORTE
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.contenido}</p>
                {m.detalleAccion && (
                  <p className="text-[10px] mt-1 pt-1 border-t border-white/10 text-muted-foreground">
                    {m.detalleAccion}
                  </p>
                )}
                <p className="text-[9px] mt-1 opacity-50">
                  {formatearFechaHora(m.timestamp)}
                </p>
              </div>
              {m.rol === 'ADMIN' && (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}
          {enviando && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Procesando instrucción...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input del chat */}
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviarMensaje()
                }
              }}
              placeholder="Escribe una instrucción para el sistema..."
              disabled={enviando}
              className="flex-1"
            />
            <Button
              onClick={enviarMensaje}
              disabled={enviando || !nuevoMensaje.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            💡 Ej: "Registra gasto de $50.000 en transporte" · "Muéstrame balance del mes" · "Crea evento para pagar tarjeta el 30"
          </p>
        </div>
      </Card>
    </div>
  )
}
