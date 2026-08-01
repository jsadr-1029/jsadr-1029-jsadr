'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
        // Si requiere PIN → crear_pin, si no → login
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
        // Actualizar infoCliente para que ya no requiera PIN
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
        // Abrir el portal con cédula + token
        onAbrirPortal(cedula.trim(), json.data.token)
      } else {
        // Manejar errores específicos
        if (json.code === 'LOCKED') {
          setBloqueadoHastaMs(Date.now() + 15 * 60 * 1000) // 15 min aprox
          setFase('login')
          toast({
            title: 'Cuenta bloqueada',
            description: json.error,
            variant: 'destructive',
          })
        } else if (json.code === 'INVALID_PIN') {
          // Extraer intentos restantes del mensaje
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
    <div className="space-y-6">
      <PageHeader
        title="Portal de Consulta del Cliente"
        subtitle="Ingresa con tu cédula y PIN para consultar tus créditos, pagos y estados"
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {fase === 'cedula' && (
              <>
                <Search className="w-5 h-5 text-primary" />
                Identificación
              </>
            )}
            {fase === 'crear_pin' && (
              <>
                <KeyRound className="w-5 h-5 text-amber-500" />
                Crear PIN de acceso
              </>
            )}
            {fase === 'login' && (
              <>
                <Lock className="w-5 h-5 text-primary" />
                Iniciar sesión
              </>
            )}
            {fase === 'cargando' && <Loader2 className="w-5 h-5 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ============ FASE 1: CÉDULA ============ */}
          {fase === 'cedula' && (
            <form onSubmit={verificarCedula} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cedula">Número de Cédula</Label>
                <Input
                  id="cedula"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567890"
                  className="text-lg"
                  inputMode="numeric"
                  maxLength={12}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa tu número de cédula. Si es tu primera vez, te pediremos crear un PIN.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Continuar
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ============ FASE 2: CREAR PIN ============ */}
          {fase === 'crear_pin' && infoCliente && (
            <form onSubmit={crearPin} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Primera vez — Configuración de PIN
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Hola <strong>{infoCliente.nombre}</strong>, no tienes un PIN configurado todavía.
                  Crea uno de 4 a 6 dígitos para acceder al portal.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinNuevo">Nuevo PIN (4-6 dígitos)</Label>
                <div className="relative">
                  <Input
                    id="pinNuevo"
                    type={mostrarPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="text-2xl tracking-[0.5em] text-center pr-10"
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

              <div className="space-y-2">
                <Label htmlFor="confirmarPin">Confirmar PIN</Label>
                <div className="relative">
                  <Input
                    id="confirmarPin"
                    type={mostrarConfirmarPin ? 'text' : 'password'}
                    value={confirmarPin}
                    onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="text-2xl tracking-[0.5em] text-center pr-10"
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
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Los PINs coinciden
                  </p>
                )}
                {pin && confirmarPin && pin !== confirmarPin && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Los PINs no coinciden
                  </p>
                )}
              </div>

              <div className="p-2.5 bg-muted/50 rounded-md text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Requisitos del PIN:</p>
                <ul className="space-y-0.5 ml-3 list-disc">
                  <li>Entre 4 y 6 dígitos numéricos</li>
                  <li>No uses secuencias obvias (1234, 0000)</li>
                  <li>No lo compartas con nadie</li>
                  <li>Se guarda cifrado (bcrypt) — nadie puede verlo</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={volverACedula} className="flex-1">
                  Volver
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
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
            <form onSubmit={loginConPin} className="space-y-4">
              {bloqueadoHastaMs && tiempoBloqueoRestante > 0 ? (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800 text-sm space-y-2">
                  <p className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Cuenta bloqueada
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Has superado el máximo de intentos fallidos. Intenta nuevamente en:
                  </p>
                  <p className="text-2xl font-mono text-center text-red-900 dark:text-red-100">
                    {Math.floor(tiempoBloqueoRestante / 60)}:
                    {(tiempoBloqueoRestante % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800 text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      Hola <strong>{infoCliente.nombre}</strong>, ingresa tu PIN para acceder.
                    </p>
                  </div>

                  {intentosRestantes !== null && intentosRestantes < 5 && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Intentos restantes: <strong>{intentosRestantes}</strong> de 5
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="pinLogin">PIN de acceso</Label>
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
                        className="text-2xl tracking-[0.5em] text-center pr-10"
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
                    <Button type="button" variant="outline" onClick={volverACedula} className="flex-1">
                      Volver
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading || !pin}>
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

      {/* Cards informativas (siempre visibles) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto">
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-semibold">Tus Créditos</p>
            <p className="text-xs text-muted-foreground">Consulta todos tus créditos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-semibold">Tus Pagos</p>
            <p className="text-xs text-muted-foreground">Historial completo de pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-600" />
            <p className="text-sm font-semibold">Estados</p>
            <p className="text-xs text-muted-foreground">Activo, mora, cancelado</p>
          </CardContent>
        </Card>
      </div>

      {/* Banner de seguridad */}
      <Card className="max-w-xl mx-auto bg-primary/5 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary mb-1">Portal seguro con PIN personal</p>
              <p className="text-muted-foreground">
                Tu acceso está protegido por un PIN personal de 4 a 6 dígitos, cifrado con bcrypt.
                Tras 5 intentos fallidos la cuenta se bloquea por 15 minutos. La sesión expira a las
                2 horas de inactividad.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === SOLICITUD NUEVOS CLIENTES === */}
      <Card className="max-w-xl mx-auto bg-primary/5 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-primary mb-1">
                ¿Eres nuevo? Solicita tu crédito
              </p>
              <p className="text-muted-foreground mb-3">
                Si aún no eres cliente, inicia tu solicitud aquí. Un asesor te contactará.
              </p>
              <Button size="sm" onClick={() => setMostrarSolicitudNueva(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Solicitar crédito
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp soporte */}
      <Card className="max-w-xl mx-auto bg-emerald-500/5 border-emerald-500/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                ¿Problemas para acceder?
              </p>
              <p className="text-muted-foreground mb-2">
                Si olvidaste tu PIN o tienes problemas para ingresar, contáctanos por WhatsApp.
              </p>
              <a
                href={WHATSAPP_SOPORTE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                3103674546
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal solicitud nuevo cliente */}
      <Dialog open={mostrarSolicitudNueva} onOpenChange={setMostrarSolicitudNueva}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <SolicitudNuevoClienteView />
        </DialogContent>
      </Dialog>
    </div>
  )
}
