'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Info,
  Sparkles,
  Fingerprint,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Mail,
} from 'lucide-react'
import { login, isAuthenticated, setTokens, setUserData, getUserData } from '@/lib/api-client'

// =====================================================
// Login Unificado v5.0 — Jsadr · Jo*** Se*** Al*** D** R**
// -----------------------------------------------------
// Un ÚNICO formulario para TODOS los usuarios del sistema
// (administradores, gestores, consultores, abogados y
// clientes). El identificador puede ser:
//   - username interno (admin/gestor/consultor/abogado)
//   - cédula (cliente o abogado con acceso al portal jurídico)
//   - correo electrónico (cualquier usuario interno o cliente)
//
// El sistema detecta automáticamente el tipo de cuenta en
// el backend y enruta al dashboard correspondiente. La UI
// NUNCA revela qué tipos de usuario existen ni muestra
// botones de "Cliente / Abogado / Admin".
//
// Recuperación de clave: 100% por correo electrónico
// registrado en el sistema. No se envía a canales
// hard-coded del admin.
// =====================================================

export default function LoginPage() {
  const router = useRouter()

  // Estado del formulario unificado
  const [identificador, setIdentificador] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ nombre: string } | null>(null)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Estado de recuperación de clave por correo
  const [showRecuperar, setShowRecuperar] = useState(false)
  const [recuperarIdentificador, setRecuperarIdentificador] = useState('')
  const [recuperarLoading, setRecuperarLoading] = useState(false)
  const [recuperarMensaje, setRecuperarMensaje] = useState<
    { tipo: 'exito' | 'error' | 'info'; texto: string } | null
  >(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  useEffect(() => {
    // Si ya está autenticado (con access_token válido), redirigir al dashboard correspondiente.
    // FIX-LOGIN-LOOP: antes había aquí un redirect basado SOLO en portal_cliente_token,
    // que causaba un bucle infinito cuando el access_token había sido borrado pero el
    // portal_cliente_token seguía en localStorage (residuo de una sesión anterior):
    //   /login → ve portal_cliente_token → /?portal=1
    //   /     → no hay access_token      → /login
    //   (loop)
    // Ahora solo redirigimos si hay un access_token real en localStorage.
    if (isAuthenticated()) {
      const u = getUserData()
      if (u?.rol === 'CLIENTE' || u?.esPortalCliente) {
        router.replace('/?portal=cliente')
      } else {
        router.replace('/')
      }
      return
    }
    // Limpieza preventiva: si quedó un portal_cliente_token huérfano (sin access_token),
    // lo borramos para evitar residuos de sesiones anteriores.
    try {
      const tk = localStorage.getItem('portal_cliente_token')
      const at = localStorage.getItem('access_token')
      if (tk && !at) {
        localStorage.removeItem('portal_cliente_token')
        localStorage.removeItem('portal_cliente_id')
        localStorage.removeItem('portal_cliente_nombre')
      }
    } catch {}
  }, [router])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  // =====================================================
  // SUBMIT UNIFICADO — envía identificador + password
  // El backend detecta automáticamente el tipo de usuario
  // (admin/gestor/consultor/abogado/cliente) y devuelve
  // el token + rol + ruta de redirección.
  // =====================================================
  const submitUnificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identificador.trim() || !password) {
      setError('Ingresa tu identificador y tu contraseña')
      triggerShake()
      return
    }
    setLoading(true)
    setError('')
    try {
      // Intentar primero login de usuario interno (admin/gestor/consultor/abogado)
      // El backend /api/auth/login detecta el tipo automáticamente.
      // Si falla con "usuario no encontrado", intentar login de cliente por cédula.
      const idTrim = identificador.trim()

      // Detectar si parece cédula (solo dígitos, 6-12 caracteres)
      const esCedula = /^\d{6,12}$/.test(idTrim)
      // Detectar si parece email
      const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(idTrim)

      let loginExitoso = false

      if (esCedula) {
        // Intentar login como cliente (cédula + PIN/clave)
        try {
          const r = await fetch('/api/portal/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cedula: idTrim,
              pin: password,
            }),
          })
          const data = await r.json()
          if (r.ok && data.success) {
            try {
              localStorage.setItem('portal_cliente_token', data.token)
              localStorage.setItem('portal_cliente_id', data.clienteId)
              localStorage.setItem('portal_cliente_nombre', data.nombre)
              // FIX-LOGIN-LOOP: guardar también la cédula explícitamente,
              // porque portal_cliente_id contiene el ID interno (no la cédula)
              // y el portal necesita la cédula para llamar a /api/portal/[cedula].
              localStorage.setItem('portal_cliente_cedula', idTrim)
            } catch {}
            setTokens('portal_cliente_' + data.token, 'portal_cliente_' + data.token)
            setUserData({
              id: data.clienteId,
              nombre: data.nombre,
              username: idTrim,
              cedula: idTrim,
              rol: 'CLIENTE',
              esPortalCliente: true,
            })
            setSuccess({ nombre: data.nombre })
            setTimeout(() => {
              router.replace('/?portal=cliente')
              router.refresh()
            }, 1100)
            loginExitoso = true
          }
        } catch {}

        if (!loginExitoso) {
          // Intentar login como abogado (cédula + clave)
          try {
            const r = await fetch('/api/juridico/portal/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cedula: idTrim, clave: password }),
            })
            const data = await r.json()
            if (r.ok && data.success) {
              try {
                localStorage.setItem('juridico_token', data.data.token)
                localStorage.setItem('juridico_user', JSON.stringify(data.data.usuario))
              } catch {}
              setSuccess({ nombre: data.data.usuario?.nombre || 'Abogado' })
              setTimeout(() => {
                router.replace('/juridico')
                router.refresh()
              }, 1100)
              loginExitoso = true
            }
          } catch {}
        }
      }

      if (!loginExitoso) {
        // Intentar login como usuario interno (admin/gestor/consultor/abogado con username o email)
        const result = await login(idTrim, password)
        if (result.success) {
          const user = getUserData()
          setSuccess({ nombre: user?.nombre || idTrim })
          // Enrutamiento por rol y usuario:
          //   ABOGADO               → /juridico (portal del abogado)
          //   CLIENTE               → /?portal=cliente
          //   P_jsadr (companion)   → /?view=portal-admin (portal del companion)
          //   ADMIN/GESTOR/CONSULTOR → / (dashboard principal)
          const rol = user?.rol
          const username = (user?.username || '').toLowerCase()
          let ruta = '/'
          if (rol === 'ABOGADO') ruta = '/juridico'
          else if (rol === 'CLIENTE' || user?.esPortalCliente) ruta = '/?portal=cliente'
          else if (username === 'p_jsadr') ruta = '/?view=portal-admin'
          setTimeout(() => {
            router.replace(ruta)
            router.refresh()
          }, 1100)
          loginExitoso = true
        } else if (result.requiresMFA) {
          setError('Tu cuenta tiene MFA activo. Contacta al administrador.')
          triggerShake()
        }
      }

      if (!loginExitoso) {
        setError('Credenciales incorrectas. Verifica tu identificador y contraseña.')
        triggerShake()
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // RECUPERAR CLAVE — envía recuperación por CORREO
  // El sistema busca al usuario (admin/cliente/abogado)
  // por username, cédula o email, y envía el enlace de
  // recuperación al correo electrónico registrado.
  // =====================================================
  const solicitarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recuperarIdentificador.trim()) {
      setRecuperarMensaje({ tipo: 'error', texto: 'Ingresa tu usuario, cédula o correo.' })
      return
    }
    setRecuperarLoading(true)
    setRecuperarMensaje(null)
    try {
      const r = await fetch('/api/auth/recuperar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: recuperarIdentificador.trim() }),
      })
      const json = await r.json()
      if (json.success) {
        setRecuperarMensaje({
          tipo: 'exito',
          texto:
            json.mensaje ||
            'Si el usuario existe, se ha enviado un correo de recuperación al email registrado en el sistema.',
        })
        setRecuperarIdentificador('')
      } else if (json.code === 'RATE_LIMIT') {
        setRecuperarMensaje({
          tipo: 'error',
          texto: `Demasiadas solicitudes. Intenta en ${json.minutosRestantes} minuto(s).`,
        })
      } else if (json.code === 'ENVIO_FALLIDO') {
        setRecuperarMensaje({
          tipo: 'error',
          texto:
            'No se pudo enviar el correo de recuperación. Verifica que el correo registrado sea válido o contacta al administrador.',
        })
      } else {
        setRecuperarMensaje({ tipo: 'error', texto: json.error || 'Error inesperado' })
      }
    } catch (err: any) {
      setRecuperarMensaje({ tipo: 'error', texto: err.message || 'Error de conexión' })
    } finally {
      setRecuperarLoading(false)
    }
  }

  // =====================================================
  // PANTALLA DE ÉXITO — sin revelar el rol detectado
  // =====================================================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 p-4 overflow-hidden relative">
        {/* Aurora animada de fondo */}
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
  // LAYOUT PRINCIPAL — un solo formulario, sin pestañas
  // =====================================================
  return (
    <div className="min-h-screen flex bg-slate-950 relative overflow-hidden">
      {/* === FONDO ANIMADO AURORA === */}
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
            <p className="text-xs text-slate-400">Jo*** Se*** Al*** D** R** · v5.0</p>
          </div>
        </div>

        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-slate-300">Plataforma financiera integral</span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Gestión de préstamos{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              inteligente
            </span>{' '}
            y segura
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Un único punto de acceso. Ingresa con tu usuario, cédula o correo y el
            sistema te llevará al panel que corresponde a tu cuenta.
          </p>

          <div className="space-y-4">
            {[
              {
                icon: Fingerprint,
                title: 'Acceso unificado',
                desc: 'Un solo formulario para todos los usuarios del sistema.',
              },
              {
                icon: ShieldCheck,
                title: 'Seguridad bancaria',
                desc: 'Protección de datos y trazabilidad completa.',
              },
              {
                icon: Mail,
                title: 'Recuperación por correo',
                desc: 'Si olvidas tu clave, se envía al correo registrado.',
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

      {/* === PANEL DERECHO: FORMULARIO ÚNICO === */}
      <div className="flex-1 lg:w-1/2 relative z-10 flex items-center justify-center p-6 sm:p-12">
        <div className={`w-full max-w-md ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Jsadr</h1>
              <p className="text-[11px] text-slate-400">Jo*** Se*** Al*** D** R** · v5.0</p>
            </div>
          </div>

          {/* Card principal */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500" />

            <div className="p-7 sm:p-9">
              {/* Header */}
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
                  <KeyRound className="w-3 h-3 text-indigo-400" />
                  <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                    Inicio de sesión
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1.5">Iniciar sesión</h2>
                <p className="text-sm text-slate-400">
                  Ingresa tu usuario, cédula o correo electrónico. El sistema
                  reconocerá tu cuenta automáticamente.
                </p>
              </div>

              {/* === FORMULARIO ÚNICO === */}
              <form onSubmit={submitUnificado} className="space-y-5">
                {error && (
                  <Alert className="bg-red-500/10 border-red-500/30 text-red-200 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="identificador" className="text-slate-200 text-sm font-medium">
                    Usuario, cédula o correo
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      ref={inputRef}
                      id="identificador"
                      type="text"
                      value={identificador}
                      onChange={(e) => setIdentificador(e.target.value)}
                      placeholder="tu.usuario, 1234567890 o tu@correo.com"
                      className="pl-10 pr-4 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800/80 transition-all"
                      disabled={loading}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200 text-sm font-medium">
                    Contraseña
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="pl-10 pr-10 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-800/80 transition-all"
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !identificador.trim() || !password}
                  className="w-full h-11 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-600 hover:via-purple-600 hover:to-fuchsia-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando credenciales...
                    </>
                  ) : (
                    <>
                      Iniciar sesión
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>

                {/* Enlace de recuperación de clave */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecuperar(true)
                      setRecuperarMensaje(null)
                      setRecuperarIdentificador(identificador || '')
                    }}
                    className="text-xs text-indigo-300 hover:text-indigo-200 hover:underline transition-colors flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3 h-3" />
                    ¿Olvidaste tu contraseña?
                  </button>
                  <span className="text-[10px] text-slate-500">Recuperación por correo</span>
                </div>
              </form>

            </div>
          </div>

          {/* Footer móvil */}
          <p className="lg:hidden text-center text-xs text-slate-500 mt-6">
            © 2026 Jsadr · Jo*** Se*** Al*** D** R** · Todos los derechos reservados
          </p>
        </div>
      </div>

      {/* Estilos para animación shake */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>

      {/* === MODAL DE RECUPERACIÓN DE CLAVE POR CORREO === */}
      {showRecuperar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Recuperar contraseña</h3>
                    <p className="text-xs opacity-90">Envío por correo electrónico</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRecuperar(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-200">
                <p className="font-semibold mb-1">¿Cómo funciona?</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-300/90">
                  <li>
                    Ingresa tu <strong>usuario</strong>, <strong>cédula</strong> o{' '}
                    <strong>correo</strong>.
                  </li>
                  <li>
                    El sistema busca tu cuenta y genera una contraseña temporal.
                  </li>
                  <li>
                    Se envía al <strong>correo electrónico registrado</strong> en el sistema.
                  </li>
                  <li>La contraseña temporal es válida por 24 horas.</li>
                </ol>
                <p className="mt-2 text-blue-300/80">
                  Por seguridad, no revelamos si la cuenta existe. Si no recibes el correo,
                  verifica con el administrador que tu correo registrado sea correcto.
                </p>
              </div>

              <form onSubmit={solicitarRecuperacion} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="recuperar-id" className="text-slate-200 text-sm font-medium">
                    Usuario, cédula o correo electrónico
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="recuperar-id"
                      type="text"
                      value={recuperarIdentificador}
                      onChange={(e) => setRecuperarIdentificador(e.target.value)}
                      placeholder="tu.usuario, 1234567890 o tu@correo.com"
                      className="pl-9 pr-4 h-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                      disabled={recuperarLoading}
                      autoFocus
                    />
                  </div>
                </div>

                {recuperarMensaje && (
                  <div
                    className={`rounded-lg p-3 text-xs border ${
                      recuperarMensaje.tipo === 'exito'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : recuperarMensaje.tipo === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {recuperarMensaje.tipo === 'exito' ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      ) : recuperarMensaje.tipo === 'error' ? (
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      ) : (
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      )}
                      <span className="leading-relaxed">{recuperarMensaje.texto}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRecuperar(false)}
                    disabled={recuperarLoading}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="submit"
                    disabled={recuperarLoading || !recuperarIdentificador.trim()}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  >
                    {recuperarLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar recuperación
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
