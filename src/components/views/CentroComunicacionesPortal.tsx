'use client'

// =====================================================
// CentroComunicacionesPortal — Vista del cliente
// Props: { clienteId, cedula, token? }
// Flujo: mensaje seguridad → solicitar OTP → verificar → chat
//
// Layout:
//  - Mobile (< md): solo se ve la lista O el chat (navegación con botón atrás)
//  - Desktop (>= md): dos columnas (lista 280px + chat)
//  - Altura adaptativa al contenedor padre (no usa 100vh)
// =====================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  MessageSquare,
  Send,
  Shield,
  ShieldCheck,
  KeyRound,
  Lock,
  Plus,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Phone,
  Smartphone,
  QrCode,
} from 'lucide-react'

interface Props {
  clienteId: string
  cedula: string
  token?: string
}

interface Conversacion {
  id: string
  codigo: string
  asunto: string
  estado: string
  ultimaActividad: string
  otpVerificado: boolean
  asesor: { id: string; nombre: string } | null
  _count: { mensajes: number; notasInternas: number }
}

interface ConversacionDetalle extends Conversacion {
  mensajes: Mensaje[]
  createdAt: string
}

interface Mensaje {
  id: string
  remitenteTipo: string
  remitenteNombre: string
  contenido: string
  fechaEnvio: string
  estado: string
  archivoUrl: string | null
  archivoNombre: string | null
}

type Fase = 'verificado' | 'verificar_identidad' | 'verificando_identidad' | 'solicitar' | 'verificar' | 'verificando' | 'solicitando' | 'totp' | 'totp_setup'

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

// =====================================================
// Componente principal
// =====================================================
export function CentroComunicacionesPortal({ clienteId, cedula, token: tokenInicial }: Props) {
  const { toast } = useToast()

  const [fase, setFase] = useState<Fase>(tokenInicial ? 'verificado' : 'verificar_identidad')
  const [sessionToken, setSessionToken] = useState<string | undefined>(tokenInicial)
  const [autoGenerando, setAutoGenerando] = useState(false) // ya no se auto-genera; el usuario confirma

  // Identidad (cédula + teléfono)
  const [telefonoInput, setTelefonoInput] = useState('') // últimos 4 dígitos

  // OTP (legacy — solo se usa si el usuario explícitamente solicita OTP como respaldo)
  const [otpId, setOtpId] = useState<string | null>(null)
  const [codigoOtp, setCodigoOtp] = useState('')
  const [intentosRestantes, setIntentosRestantes] = useState<number | null>(null)
  const [minutosBloqueo, setMinutosBloqueo] = useState<number | null>(null)

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null) // null = aún no sé
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qrDataUrl: string; uri: string } | null>(null)
  const [codigoTotp, setCodigoTotp] = useState('')
  const [intentosTotpRestantes, setIntentosTotpRestantes] = useState<number | null>(null)
  const [totpLoading, setTotpLoading] = useState(false) // bandera de carga para TOTP

  // Conversaciones
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<ConversacionDetalle | null>(null)
  const [loadingLista, setLoadingLista] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  // Mensaje nuevo
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Nueva conversación
  const [asuntoNuevo, setAsuntoNuevo] = useState('')
  const [creandoConv, setCreandoConv] = useState(false)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // === Al montar: ya no verificamos TOTP automáticamente — el usuario
  // debe confirmar su identidad (cédula + teléfono) dentro del chat.
  // Si llega tokenInicial (sesión del portal), se usa directamente.
  useEffect(() => {
    if (tokenInicial) {
      setFase('verificado')
    } else {
      setFase('verificar_identidad')
    }
  }, [tokenInicial])

  // === Iniciar chat confirmando cédula + teléfono (sin OTP, sin token) ===
  const iniciarChatConIdentidad = async () => {
    const telefonoLimpio = telefonoInput.replace(/\D/g, '')
    if (telefonoLimpio.length !== 4) {
      toast({
        title: 'Teléfono incompleto',
        description: 'Ingresa los últimos 4 dígitos de tu teléfono registrado.',
        variant: 'destructive',
      })
      return
    }
    try {
      setFase('verificando_identidad')
      const res = await fetch('/api/chat/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, telefono: telefonoLimpio }),
      })
      const json = await res.json()
      if (json.success && json.data?.sessionId) {
        setSessionToken(json.data.sessionId)
        setFase('verificado')
        setTelefonoInput('')
        toast({
          title: 'Identidad verificada',
          description: 'Ya puedes chatear con tus asesores.',
        })
      } else {
        setFase('verificar_identidad')
        if (json.code === 'RATE_LIMIT') {
          toast({
            title: 'Demasiados intentos',
            description: json.error,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Datos no coinciden',
            description: json.error || 'Verifica tu cédula y los últimos 4 dígitos de tu teléfono.',
            variant: 'destructive',
          })
        }
      }
    } catch (e: any) {
      setFase('verificar_identidad')
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Solicitar OTP ===
  const solicitarOtp = async () => {
    try {
      setFase('solicitando')
      const res = await fetch('/api/chat/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'solicitar',
          clienteId,
          cedula,
          metodo: 'WHATSAPP',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setOtpId(json.data.otpId)
        setFase('verificar')
        toast({
          title: 'Código enviado',
          description: `Se envió un código a ${json.data.destinatario}. Válido por 5 minutos.${
            json.data.codigoDev ? ` (DEV: ${json.data.codigoDev})` : ''
          }`,
        })
      } else {
        setFase('solicitar')
        if (json.code === 'BLOCKED' && json.minutosRestantes) {
          setMinutosBloqueo(json.minutosRestantes)
        }
        toast({
          title: 'No se pudo enviar el código',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      setFase('solicitar')
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Verificar OTP ===
  const verificarOtp = async () => {
    if (!codigoOtp.trim()) return
    try {
      setFase('verificando')
      const res = await fetch('/api/chat/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'verificar',
          otpId,
          clienteId,
          cedula,
          codigo: codigoOtp.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSessionToken(json.data.sessionId)
        setFase('verificado')
        setCodigoOtp('')
        toast({ title: 'Identidad verificada', description: 'Ya puedes chatear con tus asesores.' })
      } else {
        setFase('verificar')
        if (json.code === 'BLOCKED') {
          setMinutosBloqueo(json.minutosRestantes || 15)
          toast({
            title: 'Bloqueado',
            description: json.error,
            variant: 'destructive',
          })
        } else if (json.code === 'OTP_EXPIRED' || json.code === 'OTP_USED' || json.code === 'NO_OTP') {
          setFase('solicitar')
          setOtpId(null)
          toast({ title: 'Código no válido', description: json.error, variant: 'destructive' })
        } else {
          setIntentosRestantes(json.intentosRestantes ?? null)
          toast({ title: 'Código incorrecto', description: json.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      setFase('verificar')
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Verificar TOTP (reemplaza verificarOtp cuando totpEnabled=true) ===
  const verificarTotp = async () => {
    if (!codigoTotp.trim()) return
    try {
      setTotpLoading(true)
      const res = await fetch('/api/chat/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          cedula,
          codigo: codigoTotp.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSessionToken(json.data.sessionId)
        setFase('verificado')
        setCodigoTotp('')
        toast({ title: 'Identidad verificada', description: 'TOTP válido. Ya puedes chatear con tus asesores.' })
      } else {
        if (json.code === 'BLOCKED') {
          setMinutosBloqueo(json.minutosRestantes || 15)
          toast({ title: 'Bloqueado', description: json.error, variant: 'destructive' })
        } else if (json.code === 'TOTP_NOT_ENABLED') {
          setTotpEnabled(false)
          setFase('solicitar')
          toast({ title: 'TOTP no activo', description: 'Cambiando a OTP por WhatsApp.', variant: 'default' })
        } else {
          setIntentosTotpRestantes(json.intentosRestantes ?? null)
          toast({ title: 'Código incorrecto', description: json.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTotpLoading(false)
    }
  }

  // === Iniciar setup TOTP (genera QR para escanear con app autenticadora) ===
  const iniciarSetupTotp = async () => {
    try {
      setTotpLoading(true)
      const res = await fetch('/api/chat/totp-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'iniciar', clienteId, cedula }),
      })
      const json = await res.json()
      if (json.success) {
        setTotpSetupData({
          secret: json.data.secret,
          qrDataUrl: json.data.qrDataUrl,
          uri: json.data.uri,
        })
        setFase('totp_setup')
      } else {
        setFase('solicitar')
        toast({ title: 'No se pudo iniciar setup TOTP', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      setFase('solicitar')
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTotpLoading(false)
    }
  }

  // === Confirmar setup TOTP (verifica el código del primer escaneo) ===
  const confirmarSetupTotp = async () => {
    if (!codigoTotp.trim()) return
    try {
      setTotpLoading(true)
      const res = await fetch('/api/chat/totp-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'confirmar', clienteId, cedula, codigo: codigoTotp.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setTotpEnabled(true)
        setTotpSetupData(null)
        setCodigoTotp('')
        setFase('totp')
        toast({
          title: 'TOTP activado',
          description: 'Ahora ingresa un código de tu app autenticadora para iniciar el chat.',
        })
      } else {
        toast({ title: 'Código incorrecto', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setTotpLoading(false)
    }
  }

  // === Cargar conversaciones ===
  const cargarConversaciones = useCallback(async () => {
    if (!sessionToken) return
    try {
      setLoadingLista(true)
      const res = await fetch(`/api/chat/conversaciones?clienteId=${clienteId}`, {
        headers: { 'x-portal-token': sessionToken },
      })
      const json = await res.json()
      if (json.success) {
        setConversaciones(json.data)
      } else {
        // Si el token expiró o es inválido, volver a solicitar OTP
        if (json.code === 'OTP_REQUIRED' || json.code === 'OTP_SESSION_INVALID') {
          toast({
            title: 'Sesión expirada',
            description: 'Por favor verifica tu identidad nuevamente.',
            variant: 'destructive',
          })
          setSessionToken(undefined)
          setFase('solicitar')
          setOtpId(null)
          setSelectedId(null)
          setDetalle(null)
        }
      }
    } catch (e) {
      // silencioso
    } finally {
      setLoadingLista(false)
    }
  }, [sessionToken, clienteId, toast])

  // === Cargar detalle ===
  const cargarDetalle = useCallback(
    async (id: string) => {
      if (!sessionToken) return
      try {
        setLoadingDetalle(true)
        const res = await fetch(`/api/chat/conversaciones/${id}`, {
          headers: { 'x-portal-token': sessionToken },
        })
        const json = await res.json()
        if (json.success) {
          setDetalle(json.data)
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        } else if (json.code === 'OTP_REQUIRED' || json.code === 'OTP_SESSION_INVALID') {
          setSessionToken(undefined)
          setFase('solicitar')
          setOtpId(null)
          setSelectedId(null)
          setDetalle(null)
        }
      } catch (e) {
        // silencioso
      } finally {
        setLoadingDetalle(false)
      }
    },
    [sessionToken]
  )

  // === Efectos ===
  useEffect(() => {
    if (fase === 'verificado' && sessionToken) {
      cargarConversaciones()
    }
  }, [fase, sessionToken, cargarConversaciones])

  useEffect(() => {
    if (selectedId && sessionToken) {
      cargarDetalle(selectedId)
    } else {
      setDetalle(null)
    }
  }, [selectedId, sessionToken, cargarDetalle])

  // Polling 5s
  useEffect(() => {
    if (!selectedId || !sessionToken) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/conversaciones/${selectedId}`, {
          headers: { 'x-portal-token': sessionToken },
        })
        const json = await res.json()
        if (json.success) {
          setDetalle((prev) => {
            if (!prev) return json.data
            if (json.data.mensajes.length !== prev.mensajes.length) return json.data
            return prev
          })
        }
      } catch (e) {
        // silencioso
      }
    }, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedId, sessionToken])

  // Polling lista cada 15s
  useEffect(() => {
    if (fase !== 'verificado' || !sessionToken) return
    const t = setInterval(cargarConversaciones, 15000)
    return () => clearInterval(t)
  }, [fase, sessionToken, cargarConversaciones])

  // === Enviar mensaje ===
  const enviarMensaje = async () => {
    if (!selectedId || !sessionToken || !nuevoMensaje.trim()) return
    try {
      setEnviando(true)
      const res = await fetch('/api/chat/mensajes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': sessionToken,
        },
        body: JSON.stringify({
          conversacionId: selectedId,
          contenido: nuevoMensaje.trim(),
          clienteId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setNuevoMensaje('')
        await cargarDetalle(selectedId)
        await cargarConversaciones()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  // === Crear nueva conversación ===
  const crearConversacion = async () => {
    if (!sessionToken) return
    try {
      setCreandoConv(true)
      const res = await fetch('/api/chat/conversaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': sessionToken,
        },
        body: JSON.stringify({
          clienteId,
          asunto: asuntoNuevo || 'Conversación general',
          otpVerificado: true,
          otpSessionId: sessionToken,
          mensajeInicial: 'Cliente inicia conversación desde el portal.',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setAsuntoNuevo('')
        setMostrarFormNuevo(false)
        await cargarConversaciones()
        setSelectedId(json.data.id)
        toast({ title: 'Conversación creada', description: json.data.codigo })
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setCreandoConv(false)
    }
  }

  // === Render: Estado de bloqueo ===
  if (minutosBloqueo !== null) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-red-500/15 flex items-center justify-center">
            <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" />
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-2">Acceso bloqueado</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
            Por seguridad, el acceso al chat fue bloqueado tras múltiples intentos fallidos.
            <br />
            Intente nuevamente en <strong>{minutosBloqueo} minuto(s)</strong>.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setMinutosBloqueo(null)
              setFase('solicitar')
              setOtpId(null)
              setCodigoOtp('')
            }}
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  // === Render: Generando (verificando identidad) ===
  if (fase === 'verificando_identidad') {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-pulse" />
          </div>
          <h3 className="text-base sm:text-lg font-bold mb-2">Verificando identidad...</h3>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Confirmando tus datos</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // === Render: Verificación de identidad (cédula + teléfono) ===
  if (fase === 'verificar_identidad') {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-2xl gradient-primary flex items-center justify-center">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Confirma tu identidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-200 flex gap-2">
              <Phone className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold mb-1">Verificación rápida</p>
                <p className="text-xs leading-relaxed">
                  Para iniciar el chat, confirma tu cédula y los últimos 4 dígitos
                  de tu teléfono registrado. No necesitas código de verificación.
                </p>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Cédula:</span>
                <span className="font-mono truncate">{cedula}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Últimos 4 dígitos de tu teléfono:
              </label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="____"
                value={telefonoInput}
                onChange={(e) => setTelefonoInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && telefonoInput.length === 4 && iniciarChatConIdentidad()}
                className="text-center text-xl sm:text-2xl font-mono tracking-[0.4em] sm:tracking-[0.5em]"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Ingresa solo los últimos 4 dígitos del teléfono que registraste con nosotros.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={iniciarChatConIdentidad}
              disabled={telefonoInput.length !== 4}
            >
              <ShieldCheck className="w-4 h-4" /> Verificar y entrar al chat
            </Button>

            <button
              onClick={() => setFase('solicitar')}
              className="text-xs text-muted-foreground hover:text-foreground mx-auto block text-center"
            >
              ← ¿Prefieres recibir un código por WhatsApp/correo?
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Render: Setup TOTP (escanear QR + confirmar) ===
  if (fase === 'totp_setup' && totpSetupData) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-2xl gradient-primary flex items-center justify-center">
              <QrCode className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Configurar clave dinámica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-200 flex gap-2">
              <Smartphone className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold mb-1">Escanea este QR con tu app autenticadora</p>
                <p className="text-xs leading-relaxed">
                  Google Authenticator, Authy, Microsoft Authenticator o 1Password.
                  Después ingresa el código de 6 dígitos que aparezca.
                </p>
              </div>
            </div>

            <div className="flex justify-center bg-white p-3 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={totpSetupData.qrDataUrl}
                alt="QR TOTP"
                className="w-48 h-48"
              />
            </div>

            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                ¿No puedes escanear? Ingresa el código manualmente
              </summary>
              <div className="mt-2 p-2 bg-muted rounded font-mono break-all text-[10px]">
                {totpSetupData.secret}
              </div>
            </details>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Código de verificación (6 dígitos):
              </label>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="______"
                value={codigoTotp}
                onChange={(e) => setCodigoTotp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && codigoTotp.length === 6 && confirmarSetupTotp()}
                className="text-center text-xl sm:text-2xl font-mono tracking-[0.4em] sm:tracking-[0.5em]"
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={confirmarSetupTotp}
              disabled={codigoTotp.length !== 6 || totpLoading}
            >
              {totpLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Activando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Activar clave dinámica
                </>
              )}
            </Button>

            <button
              onClick={() => {
                setTotpSetupData(null)
                setCodigoTotp('')
                setFase('solicitar')
              }}
              className="text-xs text-muted-foreground hover:text-foreground mx-auto block text-center"
            >
              ← Cancelar y usar WhatsApp
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Render: Verificación TOTP (cliente ya tiene TOTP activo) ===
  if (fase === 'totp') {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-2xl gradient-primary flex items-center justify-center">
              <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Clave dinámica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3 text-sm text-emerald-200 flex gap-2">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold mb-1">Ingresa el código de tu app autenticadora</p>
                <p className="text-xs leading-relaxed">
                  Abre Google Authenticator / Authy / Microsoft Authenticator
                  y copia el código de 6 dígitos para Jsadr Chat.
                </p>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Método:</span>
                <span>Clave dinámica TOTP (app)</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Validez:</span>
                <span>Código cambia cada 30s</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Código de 6 dígitos:
              </label>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="______"
                value={codigoTotp}
                onChange={(e) => setCodigoTotp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && codigoTotp.length === 6 && verificarTotp()}
                className="text-center text-xl sm:text-2xl font-mono tracking-[0.4em] sm:tracking-[0.5em]"
                autoFocus
              />
            </div>

            {intentosTotpRestantes !== null && (
              <p className="text-xs text-amber-400 text-center">
                Intentos restantes: {intentosTotpRestantes}
              </p>
            )}

            {minutosBloqueo !== null && (
              <p className="text-xs text-red-400 text-center">
                Bloqueado. Intenta en {minutosBloqueo} minuto(s).
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={verificarTotp}
              disabled={codigoTotp.length !== 6 || totpLoading}
            >
              {totpLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Verificar y entrar al chat
                </>
              )}
            </Button>

            <button
              onClick={() => {
                setFase('solicitar')
                setCodigoTotp('')
                setIntentosTotpRestantes(null)
              }}
              className="text-xs text-muted-foreground hover:text-foreground mx-auto block text-center"
            >
              ← Usar WhatsApp en su lugar
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Render: Pantalla de OTP (fallback si la clave dinámica falló) ===
  if (fase !== 'verificado') {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-2xl gradient-primary flex items-center justify-center">
              <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Verificación adicional requerida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-200 flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold mb-1">No pudimos generar tu clave automática</p>
                <p className="text-xs leading-relaxed break-words">
                  Como respaldo, te enviaremos un código de verificación por WhatsApp
                  al teléfono registrado. Es rápido y solo se necesita una vez.
                </p>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Cédula:</span>
                <span className="font-mono truncate">{cedula}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Método:</span>
                <span>WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">Validez:</span>
                <span>5 minutos</span>
              </div>
            </div>

            {fase === 'solicitar' || fase === 'solicitando' ? (
              <Button
                className="w-full"
                size="lg"
                onClick={solicitarOtp}
                disabled={fase === 'solicitando'}
              >
                {fase === 'solicitando' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Enviando código...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Solicitar código
                  </>
                )}
              </Button>
            ) : null}

            {(fase === 'verificar' || fase === 'verificando') && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Ingresa el código de 6 dígitos:
                  </label>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="______"
                    value={codigoOtp}
                    onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && codigoOtp.length === 6 && verificarOtp()}
                    className="text-center text-xl sm:text-2xl font-mono tracking-[0.4em] sm:tracking-[0.5em]"
                  />
                </div>

                {intentosRestantes !== null && (
                  <p className="text-xs text-amber-400 text-center">
                    Intentos restantes: {intentosRestantes}
                  </p>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={verificarOtp}
                  disabled={codigoOtp.length !== 6 || fase === 'verificando'}
                >
                  {fase === 'verificando' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Verificando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Verificar código
                    </>
                  )}
                </Button>

                <button
                  onClick={() => {
                    setFase('solicitar')
                    setOtpId(null)
                    setCodigoOtp('')
                    setIntentosRestantes(null)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground mx-auto block text-center"
                >
                  ← Volver a solicitar código
                </button>
              </div>
            )}

            {/* Enlace para activar clave dinámica TOTP (reemplaza WhatsApp a futuro) */}
            {totpEnabled === false && (fase === 'solicitar' || fase === 'solicitando') && (
              <button
                onClick={iniciarSetupTotp}
                className="text-xs text-emerald-400 hover:text-emerald-300 mx-auto block text-center border-t border-border pt-3 mt-3"
              >
                <Smartphone className="w-3 h-3 inline mr-1" />
                ¿Prefieres una clave dinámica en tu app? Actívala aquí
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Render: Chat verificado ===
  // Al seleccionar una conversación, el chat ocupa toda la pantalla.
  // Si no hay conversación seleccionada, se muestra la lista completa.
  const mostrarLista = !selectedId
  const mostrarChat = !!selectedId

  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-[55vh] sm:h-[60vh] min-h-[400px] max-h-[calc(90vh-180px)]">
      {/* Header verificado - compacto y responsive */}
      <Card className="py-2 shrink-0">
        <CardContent className="px-3 sm:px-4 py-0 flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm sm:text-base truncate">Centro de Mensajes</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Sesión verificada · {conversaciones.length} conversación(es)</span>
            </p>
          </div>
          {mostrarChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedId(null)}
              title="Volver a la lista"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">Volver</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSessionToken(undefined)
              setFase('verificar_identidad')
              setOtpId(null)
              setCodigoOtp('')
              setTelefonoInput('')
              setSelectedId(null)
              setDetalle(null)
            }}
            title="Cerrar sesión"
            className="shrink-0"
          >
            <Lock className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* === LISTA de conversaciones (pantalla completa) === */}
      {mostrarLista && (
        <Card className="py-0 overflow-hidden flex flex-col min-h-0 flex-1">
          <CardHeader className="py-2.5 px-3 border-b border-white/10 shrink-0">
            <CardTitle className="text-xs sm:text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">Conversaciones</span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setMostrarFormNuevo((v) => !v)}
                disabled={creandoConv}
                title="Nueva conversación"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>

            {mostrarFormNuevo && (
              <div className="mt-2 space-y-2">
                <Input
                  placeholder="Asunto (opcional)"
                  value={asuntoNuevo}
                  onChange={(e) => setAsuntoNuevo(e.target.value)}
                  className="text-xs h-8"
                  maxLength={80}
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={crearConversacion}
                    disabled={creandoConv}
                  >
                    {creandoConv ? (
                      <><RefreshCw className="w-3 h-3 animate-spin" /> Creando...</>
                    ) : (
                      <>Crear</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setMostrarFormNuevo(false)
                      setAsuntoNuevo('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <ScrollArea className="flex-1 min-h-0">
            {loadingLista && conversaciones.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-muted-foreground">Cargando...</div>
            ) : conversaciones.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="break-words">No tienes conversaciones.</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setMostrarFormNuevo(true)}
                  disabled={creandoConv}
                >
                  <Plus className="w-4 h-4" /> Iniciar nueva
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {conversaciones.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${
                      selectedId === c.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-xs sm:text-sm truncate flex-1 min-w-0">{c.asunto}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtFechaCorta(c.ultimaActividad)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 shrink-0 ${
                          c.estado === 'ACTIVA'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                            : c.estado === 'FINALIZADA'
                              ? 'bg-sky-500/10 text-sky-300 border-sky-400/30'
                              : 'bg-zinc-500/10 text-zinc-300 border-zinc-400/30'
                        }`}
                      >
                        {c.estado}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {c._count.mensajes} msg
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      )}

      {/* === CHAT completo (pantalla completa) === */}
      {mostrarChat && (
        <Card className="py-0 overflow-hidden flex flex-col min-h-0 flex-1">
          {!detalle ? (
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 opacity-20" />
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  Cargando conversación...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header del chat */}
              <div className="border-b border-white/10 p-2.5 sm:p-3 flex items-center gap-2 shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs sm:text-sm truncate">{detalle.asunto}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {detalle.asesor ? `Asesor: ${detalle.asesor.nombre}` : 'Sin asesor asignado'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    detalle.estado === 'ACTIVA'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                      : 'bg-zinc-500/10 text-zinc-300 border-zinc-400/30'
                  }`}
                >
                  {detalle.estado}
                </Badge>
              </div>

              {/* Mensajes */}
              <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4 py-2 sm:py-3">
                {loadingDetalle ? (
                  <div className="text-center text-xs sm:text-sm text-muted-foreground py-8">Cargando...</div>
                ) : (
                  <div className="space-y-2">
                    {detalle.mensajes.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        No hay mensajes en esta conversación.
                        <br />
                        Envía el primer mensaje abajo.
                      </div>
                    ) : (
                      detalle.mensajes.map((m) => {
                        const esCliente = m.remitenteTipo === 'CLIENTE'
                        const esSistema = m.remitenteTipo === 'SISTEMA'

                        if (esSistema) {
                          return (
                            <div key={m.id} className="flex justify-center my-2 px-2">
                              <div className="bg-amber-500/15 text-amber-200 border border-amber-400/30 px-3 py-1.5 rounded-full text-[11px] sm:text-xs text-center max-w-[90%] break-words">
                                {m.contenido}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            key={m.id}
                            className={`flex ${esCliente ? 'justify-end' : 'justify-start'} px-1`}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 break-words ${
                                esCliente
                                  ? 'gradient-primary text-white rounded-br-sm'
                                  : 'bg-white/10 text-foreground rounded-bl-sm border border-white/5'
                              }`}
                            >
                              {!esCliente && (
                                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5 break-words">
                                  {m.remitenteNombre}
                                </p>
                              )}
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words overflow-hidden">
                                {m.contenido}
                              </p>
                              {m.archivoUrl && (
                                <a
                                  href={m.archivoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`mt-1 block text-[11px] sm:text-xs break-all ${
                                    esCliente ? 'text-white/80 hover:text-white' : 'text-primary hover:underline'
                                  }`}
                                >
                                  📎 {m.archivoNombre || 'archivo'}
                                </a>
                              )}
                              <div
                                className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${
                                  esCliente ? 'text-white/70' : 'text-muted-foreground'
                                }`}
                              >
                                <span className="shrink-0">{fmtHora(m.fechaEnvio)}</span>
                                {esCliente && (
                                  <>
                                    {m.estado === 'LEIDO' ? (
                                      <CheckCheck className="w-3 h-3 text-violet-200" />
                                    ) : m.estado === 'ENTREGADO' ? (
                                      <CheckCheck className="w-3 h-3" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-white/10 p-2 sm:p-3 shrink-0">
                {detalle.estado !== 'ACTIVA' ? (
                  <div className="text-center text-xs sm:text-sm text-muted-foreground py-2 break-words">
                    Esta conversación está {detalle.estado.toLowerCase()}.
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <Textarea
                      placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          enviarMensaje()
                        }
                      }}
                      rows={1}
                      className="min-h-[40px] max-h-28 resize-none text-sm"
                    />
                    <Button
                      onClick={enviarMensaje}
                      disabled={!nuevoMensaje.trim() || enviando}
                      size="icon"
                      className="shrink-0"
                      title="Enviar mensaje"
                    >
                      {enviando ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}