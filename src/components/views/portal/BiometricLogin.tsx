'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Fingerprint,
  ScanFace,
  Shield,
  Loader2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Smartphone,
  Monitor,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from 'lucide-react'

// =====================================================
// BiometricLogin — Pantalla de login biométrico
// =====================================================
// Permite al cliente iniciar sesión con:
//   1. Passkeys / WebAuthn (Face ID, huella, Windows Hello)
//   2. Método alternativo (cédula + clave)
//
// La biometría se procesa 100% en el dispositivo.
// El servidor solo recibe información criptográfica.
// =====================================================

interface Props {
  onLoginSuccess: (data: { token: string; clienteId: string; nombre: string; cedula: string }) => void
  onClose: () => void
}

export function BiometricLogin({ onLoginSuccess, onClose }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [webauthnSupported, setWebauthnSupported] = useState(false)
  const [showAltMethod, setShowAltMethod] = useState(false)
  const [cedula, setCedula] = useState('')
  const [clave, setClave] = useState('')

  // Verificar soporte WebAuthn al cargar
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setWebauthnSupported(true)
    }
  }, [])

  // === LOGIN BIOMÉTRICO ===
  const loginBiometric = async () => {
    if (!webauthnSupported) {
      toast({
        title: 'No compatible',
        description: 'Tu dispositivo no soporta autenticación biométrica web. Usa el método alternativo.',
        variant: 'destructive',
      })
      setShowAltMethod(true)
      return
    }

    setLoading(true)
    try {
      // 1. Obtener opciones de autenticación del servidor
      const startRes = await fetch('/api/portal/webauthn/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({}),
      })
      const startJson = await startRes.json()
      if (!startJson.success) throw new Error(startJson.error)

      // 2. Solicitar autenticación biométrica al dispositivo
      // El navegador muestra Face ID / huella / Windows Hello automáticamente
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const authResponse = await startAuthentication({ optionsJSON: startJson.options })

      // 3. Enviar la respuesta al servidor para verificación
      const finishRes = await fetch('/api/portal/webauthn/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({
          response: authResponse,
          clienteId: startJson.clienteId,
        }),
      })
      const finishJson = await finishRes.json()

      if (finishJson.success) {
        toast({
          title: '✅ Acceso exitoso',
          description: 'Autenticación biométrica completada',
        })
        onLoginSuccess(finishJson.data)
      } else {
        throw new Error(finishJson.error || 'Autenticación fallida')
      }
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        toast({
          title: 'Autenticación cancelada',
          description: 'Cancelaste la autenticación biométrica. Puedes intentar de nuevo o usar otro método.',
        })
      } else {
        toast({
          title: 'No se pudo autenticar',
          description: e.message || 'Error de autenticación',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // === LOGIN ALTERNATIVO (cédula + clave) ===
  const loginAlternativo = async () => {
    if (!cedula || !clave) {
      toast({ title: 'Datos requeridos', description: 'Ingresa tu cédula y clave', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, clave }),
      })
      const json = await res.json()

      if (json.success) {
        toast({ title: '✅ Acceso exitoso', description: 'Bienvenido' })
        onLoginSuccess(json.data)
      } else if (json.codigo === 'CAMBIO_CLAVE_OBLIGATORIO') {
        toast({
          title: 'Cambio de clave requerido',
          description: 'Debes cambiar tu clave para continuar',
        })
      } else {
        toast({
          title: 'Acceso denegado',
          description: json.error || 'Credenciales inválidas',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Portal del Cliente</h1>
          <p className="text-sm text-slate-400 mt-1">Jsadr · Acceso seguro</p>
        </div>

        {!showAltMethod ? (
          // === VISTA BIOMÉTRICA ===
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 backdrop-blur-sm">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-white mb-1">Bienvenido</h2>
              <p className="text-xs text-slate-400">Ingresa de forma segura con tu dispositivo</p>
            </div>

            {/* Botón biométrico principal */}
            <button
              onClick={loginBiometric}
              disabled={loading || !webauthnSupported}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-base shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  <Fingerprint className="w-6 h-6" />
                  Usar Face ID / Huella
                </>
              )}
            </button>

            {!webauthnSupported && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                <p className="text-[11px] text-amber-200 text-center">
                  Tu navegador no soporta autenticación biométrica. Usa el método alternativo.
                </p>
              </div>
            )}

            {/* Separador */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">o</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            {/* Método alternativo */}
            <button
              onClick={() => setShowAltMethod(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 transition-all text-sm font-medium"
            >
              <KeyRound className="w-4 h-4" />
              Usar otro método
            </button>

            {/* Info de seguridad */}
            <div className="mt-6 p-3 rounded-lg bg-emerald-500/5 border border-emerald-400/20">
              <div className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  La autenticación biométrica se procesa exclusivamente en tu dispositivo.
                  Jsadr nunca almacena ni recibe tus datos biométricos.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // === VISTA MÉTODO ALTERNATIVO ===
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto rounded-xl bg-white/10 flex items-center justify-center mb-2">
                <KeyRound className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Acceso con clave</h2>
              <p className="text-xs text-slate-400">Ingresa tu cédula y contraseña</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cedula" className="text-slate-300 text-xs">Cédula</Label>
                <Input
                  id="cedula"
                  type="text"
                  inputMode="numeric"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="Ej: 1234567890"
                  className="bg-slate-800/50 border-slate-700 text-white mt-1"
                  disabled={loading}
                  onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('clave')?.focus() }}
                />
              </div>
              <div>
                <Label htmlFor="clave" className="text-slate-300 text-xs">Contraseña</Label>
                <Input
                  id="clave"
                  type="password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Tu contraseña"
                  className="bg-slate-800/50 border-slate-700 text-white mt-1"
                  disabled={loading}
                  onKeyDown={(e) => { if (e.key === 'Enter') loginAlternativo() }}
                />
              </div>

              <Button
                onClick={loginAlternativo}
                disabled={loading || !cedula || !clave}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...
                  </>
                ) : (
                  <>
                    Ingresar <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            {/* Volver a biométrico */}
            {webauthnSupported && (
              <button
                onClick={() => setShowAltMethod(false)}
                className="w-full flex items-center justify-center gap-2 mt-4 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Volver a Face ID / Huella
              </button>
            )}

            {/* Recuperar clave */}
            <div className="mt-4 text-center">
              <a href="/recuperar-clave" className="text-[11px] text-indigo-400 hover:text-indigo-300 underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-600 mt-6">
          🔒 Conexión segura · Tus datos están protegidos<br/>
          © 2026 Jsadr · Jo*** Se*** Al*** D** R**
        </p>
      </div>
    </div>
  )
}

// =====================================================
// PasskeyManager — Gestión de Passkeys y Dispositivos
// =====================================================
// Permite al cliente:
//   - Registrar nuevas passkeys (activar biometría)
//   - Ver y eliminar passkeys existentes
//   - Ver dispositivos y sesiones activas
//   - Cerrar sesión en otros dispositivos
// =====================================================

interface PasskeyInfo {
  id: string
  nickname: string | null
  platform: string | null
  activa: boolean
  fechaRegistro: string
  ultimoUso: string | null
}

interface SesionInfo {
  id: string
  plataforma: string
  navegador: string | null
  ipUltimoAcceso: string | null
  fechaRegistro: string
  ultimoAcceso: string
  expira: string
  metodoAuth: string
  esActual: boolean
}

export function PasskeyManager({ token }: { token: string }) {
  const { toast } = useToast()
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [sesiones, setSesiones] = useState<SesionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [hasPasskeys, setHasPasskeys] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const [resPass, resSes] = await Promise.all([
        fetch('/api/portal/webauthn/passkeys', { headers: { 'x-portal-token': token } }),
        fetch('/api/portal/webauthn/sesiones', { headers: { 'x-portal-token': token } }),
      ])
      const jsonPass = await resPass.json()
      const jsonSes = await resSes.json()
      if (jsonPass.success) {
        setPasskeys(jsonPass.data)
        setHasPasskeys(jsonPass.hasPasskeys)
      }
      if (jsonSes.success) {
        setSesiones(jsonSes.data)
      }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // === REGISTRAR NUEVA PASSKEY ===
  const registrarPasskey = async () => {
    setRegistering(true)
    try {
      // 1. Obtener opciones de registro
      const startRes = await fetch('/api/portal/webauthn/register/start', {
        headers: { 'x-portal-token': token },
      })
      const startJson = await startRes.json()
      if (!startJson.success) throw new Error(startJson.error)

      // 2. Solicitar al dispositivo crear la credencial
      const { startRegistration } = await import('@simplewebauthn/browser')
      const regResponse = await startRegistration({ optionsJSON: startJson.options })

      // 3. Enviar al servidor para verificación
      const finishRes = await fetch('/api/portal/webauthn/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-portal-token': token },
        body: JSON.stringify({ response: regResponse }),
      })
      const finishJson = await finishRes.json()

      if (finishJson.success) {
        toast({
          title: '✅ Acceso biométrico activado',
          description: finishJson.mensaje,
          duration: 6000,
        })
        cargar()
      } else {
        throw new Error(finishJson.error)
      }
    } catch (e: any) {
      if (e.name !== 'NotAllowedError') {
        toast({
          title: 'No se pudo registrar',
          description: e.message,
          variant: 'destructive',
        })
      }
    } finally {
      setRegistering(false)
    }
  }

  // === ELIMINAR PASSKEY ===
  const eliminarPasskey = async (id: string) => {
    if (!confirm('¿Eliminar este método de acceso biométrico?')) return
    try {
      const res = await fetch(`/api/portal/webauthn/passkeys?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-portal-token': token },
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Passkey eliminada', description: json.mensaje })
        cargar()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === REVOCAR SESIÓN ===
  const revocarSesion = async (id: string) => {
    if (!confirm('¿Cerrar esta sesión? El dispositivo será desconectado.')) return
    try {
      const res = await fetch(`/api/portal/webauthn/sesiones?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-portal-token': token },
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Sesión cerrada', description: json.mensaje })
        cargar()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === CERRAR SESIÓN EN TODOS LOS DISPOSITIVOS ===
  const cerrarTodasSesiones = async () => {
    if (!confirm('¿Cerrar sesión en TODOS los demás dispositivos?')) return
    try {
      const res = await fetch('/api/portal/webauthn/sesiones', {
        method: 'DELETE',
        headers: { 'x-portal-token': token },
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Sesiones cerradas', description: json.mensaje })
        cargar()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const plataformaIcon = (plataforma: string | null) => {
    switch (plataforma) {
      case 'ios': return <Smartphone className="w-4 h-4" />
      case 'android': return <Smartphone className="w-4 h-4" />
      case 'windows': return <Monitor className="w-4 h-4" />
      case 'macos': return <Monitor className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const plataformaNombre = (p: string | null) => {
    const nombres: Record<string, string> = {
      ios: 'iPhone/iPad',
      android: 'Android',
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
    }
    return nombres[p || ''] || 'Dispositivo'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* === PASSKEYS === */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-indigo-400" />
              Acceso biométrico (Passkeys)
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Activa Face ID o huella para entrar sin contraseña
            </p>
          </div>
          <Button
            size="sm"
            onClick={registrarPasskey}
            disabled={registering}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {registering ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 mr-1" />
            )}
            {registering ? 'Activando...' : 'Activar'}
          </Button>
        </div>

        {passkeys.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed text-center">
            <ScanFace className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">
              No tienes acceso biométrico activo. Actívalo para entrar más rápido y seguro.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    {plataformaIcon(pk.platform)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{plataformaNombre(pk.platform)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Registrada: {new Date(pk.fechaRegistro).toLocaleDateString('es-CO')}
                      {pk.ultimoUso && ` · Último uso: ${new Date(pk.ultimoUso).toLocaleDateString('es-CO')}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => eliminarPasskey(pk.id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info de privacidad */}
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-400/20">
          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              La biometría se procesa exclusivamente en tu dispositivo. Jsadr nunca almacena ni recibe huellas, fotos o datos biométricos.
            </p>
          </div>
        </div>
      </div>

      {/* === DISPOSITIVOS Y SESIONES === */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Monitor className="w-4 h-4 text-cyan-400" />
              Dispositivos y sesiones
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dispositivos que tienen acceso a tu cuenta
            </p>
          </div>
          {sesiones.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={cerrarTodasSesiones}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Cerrar todas
            </Button>
          )}
        </div>

        {sesiones.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay sesiones activas.</p>
        ) : (
          <div className="space-y-2">
            {sesiones.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.esActual ? 'bg-emerald-500/10' : 'bg-cyan-500/10'}`}>
                    {plataformaIcon(s.plataforma)}
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {plataformaNombre(s.plataforma)}
                      {s.esActual && (
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          ESTE DISPOSITIVO
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(s.ultimoAcceso).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      <span className="ml-1">· {s.metodoAuth}</span>
                    </p>
                  </div>
                </div>
                {!s.esActual && (
                  <button
                    onClick={() => revocarSesion(s.id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
