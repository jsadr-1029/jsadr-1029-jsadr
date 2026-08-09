'use client'

// =====================================================
// /admin — Acceso directo al login del Portal Administrativo (Jsadr)
// -----------------------------------------------------
// **NO es un acceso automático**. Es únicamente un punto de entrada
// que lleva directo al formulario de login para usuarios internos
// (ADMIN / GESTOR / CONSULTOR).
//
// Flujo seguro (idéntico al de /login, sin saltarse nada):
//   URL /admin
//     → si ya hay sesión JWT válida → redirect a / (dashboard)
//     → si no → formulario de login (username + password)
//       → POST /api/auth/login (endpoint EXISTENTE, sin nuevos endpoints)
//         → si requiereMFA → paso 2: OTP (TOTP o WhatsApp)
//           → POST /api/auth/login { step: 2, otp }
//         → access_token + refresh_token (JWT)
//       → setTokens + setUserData (localStorage)
//     → redirect a / (dashboard) — el guardia de / re-valida la sesión
//
// **Medidas de seguridad preservadas (NO debilitadas):**
//   - JWT (access + refresh) firmado server-side con JWT_SECRET
//   - MFA / 2FA (TOTP Google Authenticator + OTP WhatsApp)
//   - Rate limiting: 10 intentos/min por IP (backend)
//   - Bloqueo de cuenta: 5 intentos fallidos → 30 min (backend)
//   - Audit log de cada intento (LOGIN, LOGIN_MFA_PENDIENTE, MFA_VERIFICACION_FALLIDA)
//   - Modo mantenimiento (503 si está activo y no es admin)
//   - Anti-enumeración: "Usuario o contraseña incorrectos" (mensaje uniforme)
//   - verifyPassword (bcrypt) en backend
//   - checkAccountLockout en backend
//   - Validation con Zod (loginSchema) en backend
//   - Session expiry: access_token 15 min, refresh_token 7 días
//   - Refresh automático en apiFetch cuando access_token expira
//
// **NO se crea:**
//   - Ningún endpoint nuevo sin autenticación
//   - Ningún parámetro en URL que conceda permisos
//   - Ningún token permanente expuesto en la URL
//   - Ninguna validación solo en frontend
//   - Ningún rol enviado desde el frontend como autoridad
//
// **El rol del usuario siempre viene del JWT verificado en backend.**
// =====================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'
import {
  isAuthenticated,
  setTokens,
  setUserData,
  getUserData,
  clearAuth,
} from '@/lib/api-client'

// =====================================================
// Tipos
// =====================================================
interface EstadoMantenimiento {
  activo: boolean
  mensaje: string
  inicio: string | null
  fin: string | null
  permitirAdmin: boolean
}

interface MfaPendiente {
  tempToken: string
  usuario: {
    id: string
    nombre: string
    username: string
    email: string
  }
  metodosDisponibles: string[]
  telefono: string
}

// =====================================================
// Página principal
// =====================================================
export default function AdminLoginPage() {
  const router = useRouter()

  // === ESTADO DEL FORMULARIO ===
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ nombre: string } | null>(null)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // === ESTADO MFA (paso 2) ===
  const [mfaPendiente, setMfaPendiente] = useState<MfaPendiente | null>(null)
  const [otp, setOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpEnviadoWhatsapp, setOtpEnviadoWhatsapp] = useState(false)
  const [otpEnviando, setOtpEnviando] = useState(false)

  // === ESTADO MANTENIMIENTO ===
  const [mantenimiento, setMantenimiento] = useState<EstadoMantenimiento | null>(null)

  // === VERIFICACIÓN INICIAL ===
  // Si el usuario ya tiene una sesión JWT válida, redirigir al dashboard.
  // Esto NO es un bypass: la página / vuelve a validar la sesión con su propio
  // guardia (isAuthenticated + getUserData + redirect si no hay token).
  // Solo es una conveniencia para no mostrar el login dos veces.
  useEffect(() => {
    if (isAuthenticated()) {
      const u = getUserData()
      const rol = u?.rol
      const usernameLower = (u?.username || '').toLowerCase()
      if (rol === 'ABOGADO') {
        // Los abogados tienen su propio portal
        router.replace('/juridico')
      } else if (rol === 'CLIENTE' || u?.esPortalCliente) {
        // Los clientes no deberían llegar aquí, pero por seguridad
        router.replace('/?portal=cliente')
      } else if (usernameLower === 'p_jsadr') {
        // Companion admin
        router.replace('/?view=portal-admin')
      } else {
        // ADMIN / GESTOR / CONSULTOR → dashboard
        router.replace('/')
      }
      return
    }

    // Limpiar tokens huérfanos de portal cliente/jurídico (FIX-LOGIN-LOOP)
    try {
      const tk = localStorage.getItem('portal_cliente_token')
      const at = localStorage.getItem('access_token')
      if (tk && !at) {
        localStorage.removeItem('portal_cliente_token')
        localStorage.removeItem('portal_cliente_id')
        localStorage.removeItem('portal_cliente_nombre')
        localStorage.removeItem('portal_cliente_cedula')
      }
      localStorage.removeItem('juridico_token')
      localStorage.removeItem('juridico_user')
      localStorage.removeItem('juridico-portal-token')
    } catch {}

    // Consultar estado de mantenimiento (endpoint público)
    fetch('/api/estado-mantenimiento')
      .then((r) => r.json())
      .then((data: EstadoMantenimiento) => setMantenimiento(data))
      .catch(() => setMantenimiento(null))

    setTimeout(() => inputRef.current?.focus(), 200)
  }, [router])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  // =====================================================
  // PASO 1: Submit credenciales (username + password)
  // Llama al endpoint EXISTENTE /api/auth/login con step=1 (default)
  // =====================================================
  const submitCredenciales = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Ingresa tu usuario y contraseña')
      triggerShake()
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })
      const data = await res.json()

      // === MODO MANTENIMIENTO ===
      if (data.mantenimiento) {
        setError(data.error || 'El sistema se encuentra en mantenimiento.')
        triggerShake()
        return
      }

      // === RATE LIMIT ===
      if (res.status === 429) {
        setError(data.error || 'Demasiados intentos. Espera 1 minuto.')
        triggerShake()
        return
      }

      // === CUENTA BLOQUEADA ===
      if (res.status === 403) {
        setError(data.error || 'Cuenta bloqueada. Intenta más tarde.')
        triggerShake()
        return
      }

      if (!data.success) {
        setError(data.error || 'Usuario o contraseña incorrectos')
        triggerShake()
        return
      }

      // === MFA PENDIENTE — ir al paso 2 ===
      if (data.requiresMFA) {
        setMfaPendiente({
          tempToken: data.tempToken,
          usuario: data.data.usuario,
          metodosDisponibles: data.data.metodosDisponibles || ['totp'],
          telefono: data.data.telefono || data.data.usuario.email,
        })
        setOtp('')
        setOtpEnviadoWhatsapp(false)
        return
      }

      // === LOGIN DIRECTO (sin MFA) ===
      if (data.data?.access_token) {
        // Guardar tokens y datos de usuario en localStorage
        // El access_token es un JWT firmado por el backend
        setTokens(data.data.access_token, data.data.refresh_token)
        setUserData(data.data.usuario)

        // Verificar rol para redirección
        const rol = data.data.usuario?.rol
        const uname = (data.data.usuario?.username || '').toLowerCase()
        let ruta = '/'
        if (rol === 'ABOGADO') ruta = '/juridico'
        else if (rol === 'CLIENTE') ruta = '/?portal=cliente'
        else if (uname === 'p_jsadr') ruta = '/?view=portal-admin'

        setSuccess({ nombre: data.data.usuario?.nombre || username })
        setTimeout(() => {
          router.replace(ruta)
          router.refresh()
        }, 1100)
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // PASO 2: Verificar OTP (TOTP o WhatsApp)
  // Llama al endpoint EXISTENTE /api/auth/login con step=2
  // =====================================================
  const verificarOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) {
      setError('Ingresa el código de verificación')
      return
    }
    if (!mfaPendiente) {
      setError('Sesión MFA expirada. Vuelve a iniciar sesión.')
      setMfaPendiente(null)
      return
    }
    setOtpLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          otp: otp.trim(),
          step: 2,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Código de verificación incorrecto')
        triggerShake()
        return
      }

      // === LOGIN COMPLETO ===
      if (data.data?.access_token) {
        setTokens(data.data.access_token, data.data.refresh_token)
        setUserData(data.data.usuario)

        const rol = data.data.usuario?.rol
        const uname = (data.data.usuario?.username || '').toLowerCase()
        let ruta = '/'
        if (rol === 'ABOGADO') ruta = '/juridico'
        else if (rol === 'CLIENTE') ruta = '/?portal=cliente'
        else if (uname === 'p_jsadr') ruta = '/?view=portal-admin'

        setMfaPendiente(null)
        setSuccess({ nombre: data.data.usuario?.nombre || username })
        setTimeout(() => {
          router.replace(ruta)
          router.refresh()
        }, 1100)
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
      triggerShake()
    } finally {
      setOtpLoading(false)
    }
  }

  // =====================================================
  // ENVIAR OTP POR WHATSAPP (opcional)
  // Llama al endpoint EXISTENTE /api/auth/mfa con accion=enviar_otp_whatsapp
  // =====================================================
  const enviarOtpWhatsapp = async () => {
    if (!mfaPendiente) return
    setOtpEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar_otp_whatsapp',
          usuarioNombre: mfaPendiente.usuario.nombre,
          usuarioEmail: mfaPendiente.usuario.email,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOtpEnviadoWhatsapp(true)
      } else {
        setError(data.error || 'No se pudo enviar el código por WhatsApp.')
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión al enviar OTP')
    } finally {
      setOtpEnviando(false)
    }
  }

  // =====================================================
  // VOLVER AL PASO 1 (cancelar MFA)
  // =====================================================
  const cancelarMfa = () => {
    setMfaPendiente(null)
    setOtp('')
    setOtpEnviadoWhatsapp(false)
    setError('')
    // Limpiar credenciales del formulario para evitar reenvío accidental
    setPassword('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // =====================================================
  // PANTALLA DE ÉXITO
  // =====================================================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 p-4 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="relative z-10 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 mb-6 shadow-2xl animate-bounce">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Acceso autorizado</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            ¡Bienvenido, {success.nombre.split(' ')[0]}!
          </h2>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mt-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando tu panel...</span>
          </div>
        </div>
      </div>
    )
  }

  // =====================================================
  // LAYOUT PRINCIPAL
  // =====================================================
  return (
    <div className="min-h-screen flex bg-slate-950 relative overflow-hidden">
      {/* === FONDO ANIMADO === */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 -left-1/3 w-[800px] h-[800px] bg-indigo-600/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 -right-1/3 w-[800px] h-[800px] bg-purple-600/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* === PANEL IZQUIERDO: BRANDING (oculto en móvil) === */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Jsadr</h1>
            <p className="text-xs text-slate-400">Portal Administrativo · Jo*** Se*** Al*** D** R**</p>
          </div>
        </div>

        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-slate-300">Acceso restringido · Personal autorizado</span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Panel{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              administrativo
            </span>{' '}
            seguro
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Acceso directo para administradores, gestores y consultores del sistema
            Jsadr. Todas las acciones quedan registradas para auditoría.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: ShieldCheck,
                title: 'Autenticación robusta',
                desc: 'JWT + MFA opcional (TOTP o WhatsApp OTP).',
              },
              {
                icon: KeyRound,
                title: 'Bloqueo anti-fuerza bruta',
                desc: '5 intentos fallidos bloquean la cuenta 30 min.',
              },
              {
                icon: Smartphone,
                title: 'Verificación en 2 pasos',
                desc: 'Segundo factor opcional para mayor seguridad.',
              },
            ].map((f, i) => {
              const FIcon = f.icon
              return (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:border-indigo-400/50 transition-all">
                    <FIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{f.title}</p>
                    <p className="text-slate-400 text-sm">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>© 2026 Jsadr · Jo*** Se*** Al*** D** R**</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistema operativo</span>
          </div>
        </div>
      </div>

      {/* === PANEL DERECHO: FORMULARIO === */}
      <div className="flex-1 lg:w-1/2 relative z-10 flex items-center justify-center p-6 sm:p-12">
        <div className={`w-full max-w-md ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Jsadr</h1>
              <p className="text-[11px] text-slate-400">Portal Administrativo</p>
            </div>
          </div>

          {/* Card principal */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500" />

            <div className="p-7 sm:p-9">
              {/* === BANNER DE MANTENIMIENTO === */}
              {mantenimiento?.activo && (
                <div className="mb-6 rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-950/60 via-orange-950/40 to-red-950/60 p-4 shadow-lg shadow-amber-500/10">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/30 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-amber-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-200 uppercase tracking-wider">
                        Sistema en Mantenimiento
                      </p>
                      <p className="text-sm text-amber-100/90 mt-1 leading-relaxed">
                        {mantenimiento.mensaje || 'El sistema se encuentra en mantenimiento. Volveremos pronto.'}
                      </p>
                      {mantenimiento.permitirAdmin && (
                        <p className="text-[11px] text-amber-200/70 mt-2">
                          Los administradores pueden iniciar sesión normalmente.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* === HEADER === */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {mfaPendiente ? 'Verificación en 2 pasos' : 'Iniciar sesión'}
                </h2>
                <p className="text-sm text-slate-400">
                  {mfaPendiente
                    ? `Ingresa el código de verificación para continuar, ${mfaPendiente.usuario.nombre.split(' ')[0]}.`
                    : 'Acceso al panel administrativo Jsadr.'}
                </p>
              </div>

              {/* === ERROR GLOBAL === */}
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* =====================================================
                  PASO 1: FORMULARIO DE CREDENCIALES
                  ===================================================== */}
              {!mfaPendiente && (
                <form onSubmit={submitCredenciales} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium text-slate-300">
                      Usuario
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        ref={inputRef}
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Tu usuario"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-300">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || (mantenimiento?.activo && !mantenimiento?.permitirAdmin)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-400 hover:via-purple-400 hover:to-fuchsia-400 text-white font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Ingresar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Enlace a recuperación de clave */}
                  <div className="text-center pt-2">
                    <Link
                      href="/recuperar-clave"
                      className="text-xs text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                </form>
              )}

              {/* =====================================================
                  PASO 2: VERIFICACIÓN MFA
                  ===================================================== */}
              {mfaPendiente && (
                <form onSubmit={verificarOtp} className="space-y-4">
                  {/* Indicador del método */}
                  <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <KeyRound className="w-4 h-4 text-indigo-400" />
                      <span className="text-slate-300">
                        {mfaPendiente.metodosDisponibles?.includes('totp')
                          ? 'Abre Google Authenticator y ingresa el código de 6 dígitos'
                          : 'Ingresa el código de verificación'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="otp" className="text-sm font-medium text-slate-300">
                      Código de verificación
                    </label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-center text-lg tracking-[0.5em] font-mono"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={otpLoading}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otp.length !== 6}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-400 hover:via-purple-400 hover:to-fuchsia-400 text-white font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando código...
                      </>
                    ) : (
                      <>
                        Verificar y continuar
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Opción: enviar OTP por WhatsApp */}
                  {mfaPendiente.metodosDisponibles?.includes('whatsapp') && (
                    <div className="pt-2 border-t border-slate-700/50">
                      {otpEnviadoWhatsapp ? (
                        <p className="text-xs text-emerald-300 text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Código enviado por WhatsApp a tu número registrado.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={enviarOtpWhatsapp}
                          disabled={otpEnviando}
                          className="w-full flex items-center justify-center gap-2 text-sm text-slate-300 hover:text-indigo-300 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg py-2 px-3 transition-all disabled:opacity-50"
                        >
                          {otpEnviando ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-3.5 h-3.5" />
                              Enviar código por WhatsApp
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancelar MFA */}
                  <button
                    type="button"
                    onClick={cancelarMfa}
                    className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors pt-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Volver al login
                  </button>
                </form>
              )}

              {/* === FOOTER === */}
              <div className="mt-6 pt-4 border-t border-slate-700/50 text-center">
                <p className="text-[11px] text-slate-500 mb-2">
                  ¿No eres administrador? Otros accesos:
                </p>
                <div className="flex items-center justify-center gap-3 text-xs">
                  <Link
                    href="/login"
                    className="text-slate-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Login general
                  </Link>
                  <span className="text-slate-700">·</span>
                  <Link
                    href="/juridico"
                    className="text-slate-400 hover:text-indigo-300 transition-colors"
                  >
                    Portal Jurídico
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Nota de seguridad */}
          <p className="mt-6 text-center text-[11px] text-slate-600 leading-relaxed">
            🔒 Conexión segura HTTPS · Todas las acciones quedan registradas para auditoría ·
            Sesión con expiración automática
          </p>
        </div>
      </div>
    </div>
  )
}
