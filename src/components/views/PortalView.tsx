'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  User,
  FileText,
  DollarSign,
  AlertCircle,
  Megaphone,
  Phone,
  KeyRound,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  UserPlus,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SolicitudNuevoClienteView } from '@/components/views/SolicitudNuevoClienteView'

// WhatsApp de soporte de Jsadr
const WHATSAPP_SOPORTE = 'https://wa.me/573103674546'

type FasePortal = 'cedula' | 'crear_pin' | 'login' | 'cargando'

interface InfoCliente {
  clienteId: string
  nombre: string
  tienePin: boolean
  requierePin: boolean
}

export function PortalView({ onAbrirPortal }: { onAbrirPortal: (cedula: string, token?: string) => void }) {
  const [fase, setFase] = useState<FasePortal>('cedula')
  const [cedula, setCedula] = useState('')
  const [infoCliente, setInfoCliente] = useState<InfoCliente | null>(null)
  const [mostrarSolicitudNueva, setMostrarSolicitudNueva] = useState(false)

  // PIN (crear y login)
  const [pin, setPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [mostrarPin, setMostrarPin] = useState(false)
  const [mostrarConfirmarPin, setMostrarConfirmarPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [intentosRestantes, setIntentosRestantes] = useState<number | null>(null)
  const [bloqueadoHastaMs, setBloqueadoHastaMs] = useState<number | null>(null)
  const { toast } = useToast()

  // Cuenta regresiva si está bloqueado
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    if (!bloqueadoHastaMs) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [bloqueadoHastaMs])

  const limpiarEstado = () => {
    setPin('')
    setConfirmarPin('')
    setMostrarPin(false)
    setMostrarConfirmarPin(false)
    setIntentosRestantes(null)
    setBloqueadoHastaMs(null)
  }

  // === Paso 1: Verificar cédula ===
  const verificarCedula = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cedula.trim()) {
      toast({ title: 'Ingresa una cédula', variant: 'destructive' })
      return
    }
    setLoading(true)
    limpiarEstado()
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'verificar_cedula', cedula: cedula.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setInfoCliente(json.data)
        setFase(json.data.requierePin ? 'crear_pin' : 'login')
        toast({
          title: json.data.requierePin
            ? 'Bienvenido'
            : `Hola de nuevo, ${json.data.nombre}`,
          description: json.data.requierePin
            ? 'Primero debes crear tu PIN de acceso.'
            : 'Ingresa tu PIN para continuar.',
        })
      } else {
        toast({ title: 'No encontrado', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // === Paso 2a: Crear PIN inicial ===
  const crearPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin || !confirmarPin) {
      toast({ title: 'Completa todos los campos', variant: 'destructive' })
      return
    }
    if (pin !== confirmarPin) {
      toast({ title: 'Los PINs no coinciden', variant: 'destructive' })
      return
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast({
        title: 'PIN inválido',
        description: 'Debe tener entre 4 y 6 dígitos numéricos',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear_pin',
          cedula: cedula.trim(),
          pin,
          confirmarPin,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'PIN creado correctamente',
          description: 'Ahora ingresa tu PIN para acceder al portal.',
        })
        limpiarEstado()
        setInfoCliente((prev) => prev ? { ...prev, tienePin: true, requierePin: false } : prev)
        setFase('login')
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // === Paso 2b: Login con PIN ===
  const loginConPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin) {
      toast({ title: 'Ingresa tu PIN', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'login',
          cedula: cedula.trim(),
          pin,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: `¡Bienvenido, ${json.data.cliente.nombre}!`,
          description: 'Sesión iniciada correctamente.',
        })
        onAbrirPortal(cedula.trim(), json.data.token)
      } else {
        if (json.code === 'LOCKED') {
          setBloqueadoHastaMs(Date.now() + 15 * 60 * 1000)
          setFase('login')
          toast({
            title: 'Cuenta bloqueada',
            description: json.error,
            variant: 'destructive',
          })
        } else if (json.code === 'INVALID_PIN') {
          const match = json.error?.match(/(\d+)/)
          if (match) setIntentosRestantes(parseInt(match[1]))
          toast({
            title: 'PIN incorrecto',
            description: json.error,
            variant: 'destructive',
          })
        } else {
          toast({ title: 'Error', description: json.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // === Volver atrás ===
  const volverACedula = () => {
    setFase('cedula')
    limpiarEstado()
    setInfoCliente(null)
    setCedula('')
  }

  // Tiempo restante de bloqueo formateado
  const tiempoBloqueoRestante = bloqueadoHastaMs
    ? Math.max(0, Math.ceil((bloqueadoHastaMs - ahora) / 1000))
    : 0

  return (
    <div className="min-h-[100vh] portal-bg flex flex-col items-center justify-start py-6 px-4">
      {/* Contenedor mobile-first */}
      <div className="w-full max-w-md space-y-5">

        {/* === HERO: Logo + branding === */}
        <div className="text-center fade-scale pt-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full gradient-premium hub-breathe mb-3">
            <div className="flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white tracking-tighter leading-none">J</span>
              <span className="text-[8px] text-white/80 tracking-[0.25em] mt-0.5">JSADR</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gradient tracking-tight">
            Portal del Cliente
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Consulta tus créditos, pagos y estados
          </p>
        </div>

        {/* === CARD PRINCIPAL DE LOGIN === */}
        <Card className="premium-card rounded-3xl overflow-hidden fade-scale">
          <CardContent className="p-5">
            {/* Indicador de fase */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                fase === 'cedula' ? 'gradient-premium shadow-md' :
                fase === 'crear_pin' ? 'bg-amber-500/20 text-amber-300' :
                fase === 'login' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-white/5 text-muted-foreground'
              }`}>
                {fase === 'cedula' && <Search className="w-4 h-4 text-white" />}
                {fase === 'crear_pin' && <KeyRound className="w-4 h-4" />}
                {fase === 'login' && <Lock className="w-4 h-4" />}
                {fase === 'cargando' && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
              <div>
                <p className="text-sm font-bold">
                  {fase === 'cedula' && 'Identificación'}
                  {fase === 'crear_pin' && 'Crear PIN de acceso'}
                  {fase === 'login' && 'Iniciar sesión'}
                  {fase === 'cargando' && 'Procesando…'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {fase === 'cedula' && 'Ingresa tu número de cédula'}
                  {fase === 'crear_pin' && 'Configura tu PIN personal'}
                  {fase === 'login' && 'Ingresa tu PIN para continuar'}
                </p>
              </div>
            </div>

            {/* ============ FASE 1: CÉDULA ============ */}
            {fase === 'cedula' && (
              <form onSubmit={verificarCedula} className="space-y-4 fade-scale">
                <div className="space-y-1.5">
                  <Label htmlFor="cedula" className="text-xs">Número de Cédula</Label>
                  <Input
                    id="cedula"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234567890"
                    className="text-lg input-premium h-12"
                    inputMode="numeric"
                    maxLength={12}
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Si es tu primera vez, te pediremos crear un PIN.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-premium gradient-premium-hover btn-press h-11"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* ============ FASE 2: CREAR PIN ============ */}
            {fase === 'crear_pin' && infoCliente && (
              <form onSubmit={crearPin} className="space-y-4 fade-scale">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20">
                  <p className="text-xs font-semibold text-amber-200 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Primera vez — Configuración de PIN
                  </p>
                  <p className="text-[11px] text-amber-100/80">
                    Hola <strong>{infoCliente.nombre}</strong>, crea un PIN de 4 a 6 dígitos.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pinNuevo" className="text-xs">Nuevo PIN (4-6 dígitos)</Label>
                  <div className="relative">
                    <Input
                      id="pinNuevo"
                      type={mostrarPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="text-2xl tracking-[0.5em] text-center pr-10 input-premium h-12"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPin(!mostrarPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {mostrarPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmarPin" className="text-xs">Confirmar PIN</Label>
                  <div className="relative">
                    <Input
                      id="confirmarPin"
                      type={mostrarConfirmarPin ? 'text' : 'password'}
                      value={confirmarPin}
                      onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="text-2xl tracking-[0.5em] text-center pr-10 input-premium h-12"
                      inputMode="numeric"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmarPin(!mostrarConfirmarPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {mostrarConfirmarPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pin && confirmarPin && pin === confirmarPin && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Los PINs coinciden
                    </p>
                  )}
                  {pin && confirmarPin && pin !== confirmarPin && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Los PINs no coinciden
                    </p>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-white/5 text-[10px] text-muted-foreground">
                  <p className="font-semibold mb-1 text-foreground/80">Requisitos del PIN:</p>
                  <ul className="space-y-0.5 ml-3 list-disc">
                    <li>Entre 4 y 6 dígitos numéricos</li>
                    <li>No uses secuencias obvias (1234, 0000)</li>
                    <li>Cifrado con bcrypt — nadie puede verlo</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={volverACedula} className="flex-1 input-premium">
                    Volver
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-premium gradient-premium-hover btn-press"
                    disabled={loading || !pin || !confirmarPin || pin !== confirmarPin || !/^\d{4,6}$/.test(pin)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 mr-2" />
                        Crear PIN
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* ============ FASE 3: LOGIN CON PIN ============ */}
            {fase === 'login' && infoCliente && (
              <form onSubmit={loginConPin} className="space-y-4 fade-scale">
                {bloqueadoHastaMs && tiempoBloqueoRestante > 0 ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-400/20 space-y-2">
                    <p className="text-xs font-semibold text-red-200 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Cuenta bloqueada
                    </p>
                    <p className="text-[11px] text-red-100/80">
                      Has superado el máximo de intentos fallidos. Intenta nuevamente en:
                    </p>
                    <p className="text-3xl font-mono text-center text-red-300 font-bold tracking-wider">
                      {Math.floor(tiempoBloqueoRestante / 60)}:
                      {(tiempoBloqueoRestante % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/20">
                      <p className="text-xs text-blue-200">
                        Hola <strong>{infoCliente.nombre}</strong>, ingresa tu PIN para acceder.
                      </p>
                    </div>

                    {intentosRestantes !== null && intentosRestantes < 5 && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Intentos restantes: <strong>{intentosRestantes}</strong> de 5
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="pinLogin" className="text-xs">PIN de acceso</Label>
                      <div className="relative">
                        <Input
                          id="pinLogin"
                          type={mostrarPin ? 'text' : 'password'}
                          value={pin}
                          onChange={(e) => {
                            setPin(e.target.value.replace(/\D/g, ''))
                            setIntentosRestantes(null)
                          }}
                          placeholder="••••"
                          className="text-2xl tracking-[0.5em] text-center pr-10 input-premium h-12"
                          inputMode="numeric"
                          maxLength={6}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarPin(!mostrarPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {mostrarPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={volverACedula} className="flex-1 input-premium">
                        Volver
                      </Button>
                      <Button type="submit" className="flex-1 gradient-premium gradient-premium-hover btn-press" disabled={loading || !pin}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Ingresando...
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Ingresar
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* === 3 Cards informativas premium === */}
        <div className="grid grid-cols-3 gap-2 fade-scale">
          <Card className="premium-card premium-card-hover rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-1.5">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <p className="text-[10px] font-semibold">Tus Créditos</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Consulta todos</p>
            </CardContent>
          </Card>
          <Card className="premium-card premium-card-hover rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mx-auto mb-1.5">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <p className="text-[10px] font-semibold">Tus Pagos</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Historial completo</p>
            </CardContent>
          </Card>
          <Card className="premium-card premium-card-hover rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-1.5">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <p className="text-[10px] font-semibold">Estados</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Activo, mora, cancelado</p>
            </CardContent>
          </Card>
        </div>

        {/* === Banner de seguridad === */}
        <Card className="premium-card rounded-2xl border-primary/30 fade-scale">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Portal seguro con PIN personal
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Tu acceso está protegido por un PIN de 4 a 6 dígitos, cifrado con bcrypt.
                  Tras 5 intentos fallidos la cuenta se bloquea por 15 minutos. La sesión
                  expira a las 2 horas de inactividad.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === Solicitar crédito (nuevos clientes) === */}
        <Card className="premium-card premium-card-hover rounded-2xl border-primary/30 fade-scale">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs flex-1">
                <p className="font-semibold text-primary mb-1">¿Eres nuevo? Solicita tu crédito</p>
                <p className="text-muted-foreground mb-3">
                  Si aún no eres cliente, inicia tu solicitud. Un asesor te contactará.
                </p>
                <Button
                  size="sm"
                  onClick={() => setMostrarSolicitudNueva(true)}
                  className="gradient-premium gradient-premium-hover btn-press h-8"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Solicitar crédito
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === WhatsApp soporte === */}
        <Card className="premium-card premium-card-hover rounded-2xl border-emerald-500/30 fade-scale">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs flex-1">
                <p className="font-semibold text-emerald-300 mb-1">¿Problemas para acceder?</p>
                <p className="text-muted-foreground mb-2">
                  Si olvidaste tu PIN o tienes problemas, contáctanos por WhatsApp.
                </p>
                <a
                  href={WHATSAPP_SOPORTE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  3103674546
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-[10px] text-muted-foreground/70 pb-4">
          <p>Interés fijo · Mora compuesta</p>
          <p className="mt-0.5">© {new Date().getFullYear()} Jsadr</p>
        </div>
      </div>

      {/* Modal solicitud nuevo cliente */}
      <Dialog open={mostrarSolicitudNueva} onOpenChange={setMostrarSolicitudNueva}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <SolicitudNuevoClienteView />
        </DialogContent>
      </Dialog>
    </div>
  )
}
