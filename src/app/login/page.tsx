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
  UserPlus,
  ScanLine,
  BadgeCheck,
  FileSearch,
  Upload,
  Calendar,
  CreditCard,
  DollarSign,
  Clock,
  Hash,
  Landmark,
  Phone,
  MapPin,
  Wallet,
  TrendingUp,
  Percent,
  FileText,
} from 'lucide-react'
import { login, isAuthenticated, setTokens, setUserData, getUserData } from '@/lib/api-client'
import Link from 'next/link'

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

  // === ESTADO PARA VALIDACIÓN DE QR / DOCUMENTO ===
  // Modal público que permite a cualquier persona (juez, notario, tercero) verificar
  // la autenticidad de un documento Jsadr (pagaré, carta de instrucciones, certificado
  // de firma electrónica) sin necesidad de iniciar sesión.
  const [showValidarQR, setShowValidarQR] = useState(false)
  const [codigoVerificar, setCodigoVerificar] = useState('')
  const [validarLoading, setValidarLoading] = useState(false)
  const [validarResultado, setValidarResultado] = useState<
    | { tipo: 'exito' | 'error'; data?: any; mensaje?: string; codigo?: string }
    | null
  >(null)
  const [imagenQRPreview, setImagenQRPreview] = useState<string | null>(null)
  const [imagenQRError, setImagenQRError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // === ESTADO DE MANTENIMIENTO ===
  // Consulta el endpoint público /api/estado-mantenimiento al cargar la
  // página. Si el modo mantenimiento está activo, muestra un banner
  // prominente con el mensaje configurado por el admin. Esto informa a
  // los clientes por qué no pueden ingresar.
  interface EstadoMantenimiento {
    activo: boolean
    mensaje: string
    inicio: string | null
    fin: string | null
    permitirAdmin: boolean
  }
  const [mantenimiento, setMantenimiento] = useState<EstadoMantenimiento | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/estado-mantenimiento')
      .then((r) => r.json())
      .then((data: EstadoMantenimiento) => {
        if (!cancelled) setMantenimiento(data)
      })
      .catch(() => {
        // Si falla, asumir que el sistema está operativo
        if (!cancelled) setMantenimiento(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
  // VALIDACIÓN DE QR / DOCUMENTO — Público, sin login
  // -----------------------------------------------------
  // Permite a cualquier persona verificar la autenticidad de un
  // documento Jsadr (pagaré, carta, certificado de firma) usando:
  //   1. El código de verificación impreso junto al QR (XXXX-XXXX-XXXX-XXXX)
  //   2. Una foto/imagen del QR — se decodifica client-side con jsQR
  //      y se extrae automáticamente el código.
  // Luego llama a /api/documentos/verificar y muestra el resultado.
  // =====================================================
  const extraerCodigoDeUrl = (url: string): string | null => {
    // Acepta tanto ?codigo= como &codigo=, y también URLs completas
    try {
      const u = new URL(url)
      const c = u.searchParams.get('codigo')
      if (c) return c.trim().toLowerCase()
    } catch {
      // No era URL — quizás es el código directo
      const match = url.match(/([0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4})/i)
      if (match) return match[1].trim().toLowerCase()
    }
    return null
  }

  const validarDocumento = async (codigo: string) => {
    const codLimpio = codigo.trim().toLowerCase()
    if (!codLimpio) {
      setValidarResultado({
        tipo: 'error',
        mensaje: 'Ingresa un código de verificación válido (formato: XXXX-XXXX-XXXX-XXXX).',
      })
      return
    }
    setValidarLoading(true)
    setValidarResultado(null)
    try {
      const r = await fetch(`/api/documentos/verificar?codigo=${encodeURIComponent(codLimpio)}`, {
        cache: 'no-store',
      })
      const json = await r.json()
      if (json.success && json.autentico) {
        setValidarResultado({
          tipo: 'exito',
          data: json.data,
          mensaje: json.mensaje,
          codigo: codLimpio,
        })
      } else {
        setValidarResultado({
          tipo: 'error',
          mensaje:
            json.error ||
            'El código no coincide con ningún documento registrado en el sistema Jsadr.',
          codigo: codLimpio,
        })
      }
    } catch (err: any) {
      setValidarResultado({
        tipo: 'error',
        mensaje: 'No se pudo conectar con el servidor de verificación. Intenta nuevamente.',
        codigo: codLimpio,
      })
    } finally {
      setValidarLoading(false)
    }
  }

  const manejarImagenQR = async (file: File) => {
    setImagenQRError(null)
    setImagenQRPreview(null)
    setValidarResultado(null)
    if (!file.type.startsWith('image/')) {
      setImagenQRError('El archivo debe ser una imagen (PNG, JPG, etc.).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setImagenQRError('La imagen es demasiado grande (máximo 8 MB).')
      return
    }
    try {
      // Leer la imagen como data URL para previsualizar
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
        reader.readAsDataURL(file)
      })
      setImagenQRPreview(dataUrl)

      // Cargar la imagen en un HTMLImageElement
      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'))
      })

      // Dibujar en canvas y obtener imageData
      const canvas = document.createElement('canvas')
      const maxDim = 1200 // limitar tamaño para no saturar memoria
      let w = img.width
      let h = img.height
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h)
        w = Math.floor(w * scale)
        h = Math.floor(h * scale)
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        setImagenQRError('No se pudo procesar la imagen (canvas no disponible).')
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)

      // Decodificar QR con jsQR (importado dinámicamente para evitar SSR issues)
      const jsQR = (await import('jsqr')).default
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      })
      if (!decoded) {
        setImagenQRError(
          'No se detectó ningún código QR en la imagen. Verifica que la foto sea nítida y el QR esté completo.'
        )
        return
      }
      const codigo = extraerCodigoDeUrl(decoded.data)
      if (!codigo) {
        setImagenQRError(
          `El QR decodificado no contiene un código de verificación Jsadr válido. Contenido: "${decoded.data.substring(0, 80)}${decoded.data.length > 80 ? '...' : ''}"`
        )
        return
      }
      setCodigoVerificar(codigo)
      // Auto-verificar
      await validarDocumento(codigo)
    } catch (err: any) {
      setImagenQRError(err.message || 'Error al procesar la imagen.')
    }
  }

  const abrirValidarQR = () => {
    setShowValidarQR(true)
    setCodigoVerificar('')
    setValidarResultado(null)
    setImagenQRPreview(null)
    setImagenQRError(null)
  }

  const cerrarValidarQR = () => {
    setShowValidarQR(false)
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
              {/* === BANNER DE MANTENIMIENTO ===
                  Se muestra cuando el admin activa el modo mantenimiento desde
                  Configuración Global → Mantenimiento. Informa al cliente por
                  qué no puede ingresar. Si permitirAdmin=true, los admin pueden
                  seguir intentando ingresar. */}
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
                      {(mantenimiento.inicio || mantenimiento.fin) && (
                        <div className="mt-2 pt-2 border-t border-amber-400/20 text-[11px] text-amber-200/70 space-y-0.5">
                          {mantenimiento.inicio && (
                            <p>
                              <Clock className="w-3 h-3 inline mr-1" />
                              Inicio: {new Date(mantenimiento.inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                            </p>
                          )}
                          {mantenimiento.fin && (
                            <p>
                              <Clock className="w-3 h-3 inline mr-1" />
                              Fin estimado: {new Date(mantenimiento.fin).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                            </p>
                          )}
                        </div>
                      )}
                      {mantenimiento.permitirAdmin && (
                        <p className="mt-2 text-[11px] text-amber-300/60 italic">
                          Los administradores pueden iniciar sesión para realizar tareas.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

              {/* Línea divisora */}
              <div className="mt-5 mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-700/60" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">¿No tienes cuenta?</span>
                <span className="h-px flex-1 bg-slate-700/60" />
              </div>

              {/* CTA Registro nuevo cliente */}
              <Link
                href="/register"
                className="group flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/60 text-emerald-200 text-sm font-medium transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Regístrate como nuevo cliente
                <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <p className="text-center text-[10px] text-slate-500 mt-2">
                Solicita tu crédito en 5 minutos · Validación de identidad con cédula y selfie
              </p>

              {/* === VALIDACIÓN PÚBLICA DE QR / DOCUMENTO === */}
              {/* Acceso sin login para que cualquier tercero (juez, notario, etc.)
                  pueda verificar la autenticidad de un pagaré/carta/certificado. */}
              <button
                type="button"
                onClick={abrirValidarQR}
                className="group flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/60 text-amber-200 text-sm font-medium transition-all mt-3"
              >
                <ScanLine className="w-4 h-4" />
                Validar autenticidad de un documento
                <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-center text-[10px] text-slate-500 mt-2">
                Verifica un pagaré, carta de instrucciones o certificado de firma electrónica mediante su código QR
              </p>

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

      {/* === MODAL DE VALIDACIÓN DE QR / DOCUMENTO === */}
      {showValidarQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Verificación de autenticidad</h3>
                    <p className="text-xs opacity-90">Público · Sin inicio de sesión</p>
                  </div>
                </div>
                <button
                  onClick={cerrarValidarQR}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-4">
              {/* Explicación */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <FileSearch className="w-3.5 h-3.5" /> ¿Cómo funciona?
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-amber-300/90">
                  <li>Ingresa el <strong>código de verificación</strong> impreso junto al QR (formato XXXX-XXXX-XXXX-XXXX), o</li>
                  <li>Sube una <strong>foto del QR</strong> y se detectará automáticamente el código.</li>
                  <li>El sistema verifica contra los registros de Jsadr y muestra el resultado.</li>
                </ol>
                <p className="mt-2 text-amber-300/80">
                  Este proceso es <strong>público</strong>: cualquier persona (juez, notario, tercero) puede verificar
                  la autenticidad de un documento sin necesidad de tener cuenta en el sistema.
                </p>
              </div>

              {/* Entrada manual del código */}
              <div className="space-y-2">
                <Label htmlFor="codigo-verificar" className="text-slate-200 text-sm font-medium flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Código de verificación
                </Label>
                <div className="relative">
                  <Input
                    id="codigo-verificar"
                    type="text"
                    value={codigoVerificar}
                    onChange={(e) => setCodigoVerificar(e.target.value)}
                    placeholder="abcd-1234-ef56-7890"
                    className="pl-3 pr-4 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 font-mono text-center tracking-widest"
                    disabled={validarLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !validarLoading && codigoVerificar.trim()) {
                        e.preventDefault()
                        validarDocumento(codigoVerificar)
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => validarDocumento(codigoVerificar)}
                  disabled={validarLoading || !codigoVerificar.trim()}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
                >
                  {validarLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4 mr-2" />
                      Verificar documento
                    </>
                  )}
                </Button>
              </div>

              {/* Divisor "O" */}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-700/60" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">O sube una foto del QR</span>
                <span className="h-px flex-1 bg-slate-700/60" />
              </div>

              {/* Upload de imagen */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) manejarImagenQR(f)
                    // Limpiar para permitir re-subir la misma imagen
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={validarLoading}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-slate-600 hover:border-amber-500/60 hover:bg-amber-500/5 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imagenQRPreview ? (
                    <>
                      <img
                        src={imagenQRPreview}
                        alt="Preview QR"
                        className="max-h-16 max-w-full object-contain rounded"
                      />
                      <span className="text-[10px]">Click para cambiar imagen</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-xs font-medium">Subir imagen del QR</span>
                      <span className="text-[10px] text-slate-500">PNG, JPG · máx 8MB</span>
                    </>
                  )}
                </button>
                {imagenQRError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{imagenQRError}</span>
                  </div>
                )}
              </div>

              {/* === RESULTADO === */}
              {validarResultado && (
                <div
                  className={`rounded-xl border p-4 ${
                    validarResultado.tipo === 'exito'
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-red-500/10 border-red-500/40'
                  }`}
                >
                  {validarResultado.tipo === 'exito' && validarResultado.data ? (
                    <div className="space-y-3">
                      {/* Sello grande AUTÉNTICO */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-emerald-300">Documento Auténtico</h4>
                          <p className="text-xs text-emerald-200/80">{validarResultado.mensaje}</p>
                        </div>
                      </div>

                      {/* Detalles del documento (resumen) */}
                      <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                        {validarResultado.data.tipoDocumento && (
                          <div className="flex items-center gap-2 text-xs">
                            <FileSearch className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Tipo:</span>
                            <span className="text-white font-semibold">{validarResultado.data.tipoDocumento}</span>
                          </div>
                        )}
                        {validarResultado.data.deudor && (
                          <div className="flex items-center gap-2 text-xs">
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Deudor:</span>
                            <span className="text-white font-semibold">{validarResultado.data.deudor}</span>
                          </div>
                        )}
                        {validarResultado.data.cedula && (
                          <div className="flex items-center gap-2 text-xs">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Cédula:</span>
                            <span className="text-white font-mono">{validarResultado.data.cedula}</span>
                          </div>
                        )}
                        {validarResultado.data.codigoPrestamo && (
                          <div className="flex items-center gap-2 text-xs">
                            <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Préstamo:</span>
                            <span className="text-white font-mono">{validarResultado.data.codigoPrestamo}</span>
                          </div>
                        )}
                        {validarResultado.data.monto != null && (
                          <div className="flex items-center gap-2 text-xs">
                            <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Monto principal:</span>
                            <span className="text-white font-semibold">
                              ${Number(validarResultado.data.monto).toLocaleString('es-CO')}
                            </span>
                          </div>
                        )}
                        {validarResultado.data.estado && (
                          <div className="flex items-center gap-2 text-xs">
                            <BadgeCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Estado:</span>
                            <span className="text-white font-semibold">{validarResultado.data.estado}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-400">Verificado:</span>
                          <span className="text-white">
                            {new Date(validarResultado.data.verificadoEn).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                          </span>
                        </div>
                      </div>

                      {/* === NUEVO: Datos del Cliente === */}
                      {validarResultado.data.cliente && (
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-blue-300 border-b border-blue-500/20 pb-1 mb-1">
                            <User className="w-3.5 h-3.5" />
                            DATOS DEL CLIENTE
                          </div>
                          {validarResultado.data.cliente.telefono && (
                            <div className="flex items-center gap-2 text-xs">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Teléfono:</span>
                              <span className="text-white font-mono">{validarResultado.data.cliente.telefono}</span>
                            </div>
                          )}
                          {validarResultado.data.cliente.email && (
                            <div className="flex items-center gap-2 text-xs">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Correo:</span>
                              <span className="text-white font-mono">{validarResultado.data.cliente.email}</span>
                            </div>
                          )}
                          {validarResultado.data.cliente.direccion && (
                            <div className="flex items-center gap-2 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Dirección:</span>
                              <span className="text-white">{validarResultado.data.cliente.direccion}</span>
                            </div>
                          )}
                          {(validarResultado.data.cliente.ciudad || validarResultado.data.cliente.departamento) && (
                            <div className="flex items-center gap-2 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Ciudad/Depto:</span>
                              <span className="text-white">
                                {[validarResultado.data.cliente.ciudad || validarResultado.data.cliente.municipio, validarResultado.data.cliente.departamento].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* === NUEVO: Cuenta de Origen (Desembolso) — DESTACADO === */}
                      {validarResultado.data.cliente?.cuentaOrigen &&
                        (validarResultado.data.cliente.cuentaOrigen.banco ||
                          validarResultado.data.cliente.cuentaOrigen.numeroCuenta) && (
                        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 border-b border-amber-500/30 pb-1 mb-1">
                            <Landmark className="w-3.5 h-3.5" />
                            CUENTA DE ORIGEN (DESEMBOLSO)
                          </div>
                          <p className="text-[10px] text-amber-200/70 italic">
                            Cuenta bancaria propia del cliente donde se envió el dinero del desembolso.
                          </p>
                          {validarResultado.data.cliente.cuentaOrigen.banco && (
                            <div className="flex items-center gap-2 text-xs">
                              <Landmark className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Banco:</span>
                              <span className="text-white font-semibold">{validarResultado.data.cliente.cuentaOrigen.banco}</span>
                            </div>
                          )}
                          {validarResultado.data.cliente.cuentaOrigen.tipoCuenta && (
                            <div className="flex items-center gap-2 text-xs">
                              <Wallet className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Tipo de cuenta:</span>
                              <span className="text-white font-semibold">{validarResultado.data.cliente.cuentaOrigen.tipoCuenta}</span>
                            </div>
                          )}
                          {validarResultado.data.cliente.cuentaOrigen.numeroCuenta && (
                            <div className="flex items-center gap-2 text-xs">
                              <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Número de cuenta:</span>
                              <span className="text-white font-mono text-sm font-bold tracking-wider">
                                {validarResultado.data.cliente.cuentaOrigen.numeroCuenta}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* === NUEVO: Datos del Crédito === */}
                      {validarResultado.data.credito && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 border-b border-emerald-500/20 pb-1 mb-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            DATOS DEL CRÉDITO
                          </div>
                          {validarResultado.data.credito.modalidad && (
                            <div className="flex items-center gap-2 text-xs">
                              <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Modalidad:</span>
                              <span className="text-white font-semibold">{validarResultado.data.credito.modalidad}</span>
                            </div>
                          )}
                          {validarResultado.data.credito.tasaInteresAnual != null && (
                            <div className="flex items-center gap-2 text-xs">
                              <Percent className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Tasa anual:</span>
                              <span className="text-white font-semibold">{validarResultado.data.credito.tasaInteresAnual}%</span>
                            </div>
                          )}
                          {validarResultado.data.credito.plazoMeses != null && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Plazo:</span>
                              <span className="text-white font-semibold">{validarResultado.data.credito.plazoMeses} meses</span>
                            </div>
                          )}
                          {validarResultado.data.credito.numeroCuotas != null && (
                            <div className="flex items-center gap-2 text-xs">
                              <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Cuotas:</span>
                              <span className="text-white font-semibold">{validarResultado.data.credito.numeroCuotas}</span>
                            </div>
                          )}
                          {validarResultado.data.credito.frecuencia && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Frecuencia:</span>
                              <span className="text-white font-semibold">{validarResultado.data.credito.frecuencia}</span>
                            </div>
                          )}
                          {validarResultado.data.credito.montoCuota != null && (
                            <div className="flex items-center gap-2 text-xs">
                              <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Cuota fija:</span>
                              <span className="text-white font-semibold">
                                ${Number(validarResultado.data.credito.montoCuota).toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          {validarResultado.data.credito.totalPagar != null && (
                            <div className="flex items-center gap-2 text-xs">
                              <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Total a pagar:</span>
                              <span className="text-white font-semibold">
                                ${Number(validarResultado.data.credito.totalPagar).toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                          {validarResultado.data.credito.fechaDesembolso && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Desembolso:</span>
                              <span className="text-white">
                                {new Date(validarResultado.data.credito.fechaDesembolso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                              </span>
                            </div>
                          )}
                          {validarResultado.data.credito.fechaVencimiento && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-400">Vencimiento:</span>
                              <span className="text-white">
                                {new Date(validarResultado.data.credito.fechaVencimiento).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                              </span>
                            </div>
                          )}
                          {/* Estado de pago actual */}
                          {validarResultado.data.credito.cuotasPagadas != null && (
                            <div className="bg-slate-900/40 rounded p-2 mt-2 space-y-1 border border-slate-700/50">
                              <div className="text-[10px] font-bold text-slate-300 uppercase">Estado de Pago</div>
                              <div className="flex items-center gap-2 text-xs">
                                <BadgeCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-slate-400">Cuotas pagadas:</span>
                                <span className="text-white font-semibold">
                                  {validarResultado.data.credito.cuotasPagadas} / {validarResultado.data.credito.numeroCuotas ?? '—'}
                                </span>
                              </div>
                              {validarResultado.data.credito.saldoTotal != null && (
                                <div className="flex items-center gap-2 text-xs">
                                  <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-slate-400">Saldo total:</span>
                                  <span className="text-amber-300 font-bold">
                                    ${Number(validarResultado.data.credito.saldoTotal).toLocaleString('es-CO')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* === Firma Electrónica (detallada) === */}
                      <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-violet-300 border-b border-violet-500/20 pb-1 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          FIRMA ELECTRÓNICA
                        </div>
                        {validarResultado.data.tieneFirmaElectronica !== undefined && (
                          <div className="flex items-center gap-2 text-xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Estado:</span>
                            <span className={`font-semibold ${validarResultado.data.tieneFirmaElectronica ? 'text-emerald-300' : 'text-red-300'}`}>
                              {validarResultado.data.tieneFirmaElectronica ? '✓ Firmado electrónicamente' : '✗ No'}
                            </span>
                          </div>
                        )}
                        {validarResultado.data.firma?.tipo && (
                          <div className="flex items-center gap-2 text-xs">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Tipo doc. firmado:</span>
                            <span className="text-white font-semibold">
                              {validarResultado.data.firma.tipo === 'TYC' ? 'Términos y Condiciones' :
                                validarResultado.data.firma.tipo === 'PAGARE' ? 'Pagaré' :
                                validarResultado.data.firma.tipo}
                            </span>
                          </div>
                        )}
                        {validarResultado.data.fechaFirma && (
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Fecha firma:</span>
                            <span className="text-white">
                              {new Date(validarResultado.data.fechaFirma).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                            </span>
                          </div>
                        )}
                        {validarResultado.data.canalOTP && (
                          <div className="flex items-center gap-2 text-xs">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Canal OTP:</span>
                            <span className="text-white">{validarResultado.data.canalOTP}</span>
                          </div>
                        )}
                        {validarResultado.data.ipFirma && (
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">IP de firma:</span>
                            <span className="text-white font-mono">{validarResultado.data.ipFirma}</span>
                          </div>
                        )}
                        {validarResultado.data.firma?.firmanteRol && (
                          <div className="flex items-center gap-2 text-xs">
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">Rol del firmante:</span>
                            <span className="text-white">{validarResultado.data.firma.firmanteRol}</span>
                          </div>
                        )}
                        {(validarResultado.data.firma?.id || validarResultado.data.firmaId) && (
                          <div className="flex items-center gap-2 text-xs">
                            <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-400">ID firma:</span>
                            <span className="text-white font-mono text-[10px]">
                              {validarResultado.data.firma?.id || validarResultado.data.firmaId}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Sello legal */}
                      <div className="bg-slate-800/50 border-l-4 border-emerald-500 rounded p-2 text-[10px] text-slate-300 leading-relaxed">
                        <strong className="text-emerald-300">Validez legal:</strong> Documento amparado por la Ley 527
                        de 1999 (Colombia) sobre mensajes de datos y firmas electrónicas, y el Decreto 1074 de 2015.
                        Constituye prueba documental admisible en proceso ejecutivo (art. 419 CGP).
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-red-300">Documento No Válido</h4>
                          <p className="text-xs text-red-200/80">{validarResultado.mensaje}</p>
                        </div>
                      </div>
                      {validarResultado.codigo && (
                        <div className="bg-slate-900/50 rounded-lg p-2 text-xs">
                          <span className="text-slate-400">Código recibido: </span>
                          <span className="text-white font-mono">{validarResultado.codigo}</span>
                        </div>
                      )}
                      <div className="bg-red-500/5 border-l-4 border-red-500 rounded p-2 text-[10px] text-red-200/80 leading-relaxed">
                        <strong>¿Qué hacer?</strong> Verifica que el código sea exactamente el impreso en el documento.
                        Si sospechas falsificación, solicita una copia nueva al acreedor o denuncia ante la Fiscalía.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer info */}
              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-700/40">
                Sistema Jsadr · Ley 527 de 1999 · Decreto 1074 de 2015 · Hora oficial America/Bogota (UTC-5)
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cerrarValidarQR}
                  disabled={validarLoading}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setCodigoVerificar('')
                    setValidarResultado(null)
                    setImagenQRPreview(null)
                    setImagenQRError(null)
                  }}
                  disabled={validarLoading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
                >
                  Limpiar y validar otro
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
