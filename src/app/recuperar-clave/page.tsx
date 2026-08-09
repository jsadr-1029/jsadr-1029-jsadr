'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react'
import Link from 'next/link'
import { setTokens, setUserData } from '@/lib/api-client'

// =====================================================
// /recuperar-clave?token=<token>
// -----------------------------------------------------
// Página pública (sin login) que recibe el magic link enviado
// por correo cuando el usuario olvidó su contraseña.
// Muestra inmediatamente el formulario para crear una nueva clave.
// =====================================================

function RecuperarClaveInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [nuevaClave, setNuevaClave] = useState('')
  const [confirmarClave, setConfirmarClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    tipo: 'exito' | 'error'
    texto: string
    autoLogin?: boolean
  } | null>(null)

  // Validaciones locales en vivo
  const [errores, setErrores] = useState<{ nueva?: string; confirmar?: string }>({})

  useEffect(() => {
    const nuevosErrores: { nueva?: string; confirmar?: string } = {}
    if (nuevaClave && nuevaClave.length < 6) {
      nuevosErrores.nueva = 'Mínimo 6 caracteres'
    }
    if (nuevaClave && nuevaClave.length > 64) {
      nuevosErrores.nueva = 'Máximo 64 caracteres'
    }
    if (confirmarClave && confirmarClave !== nuevaClave) {
      nuevosErrores.confirmar = 'Las claves no coinciden'
    }
    setErrores(nuevosErrores)
  }, [nuevaClave, confirmarClave])

  // Fortaleza simple
  const fortaleza = (() => {
    if (!nuevaClave) return { nivel: 0, texto: '', color: 'bg-slate-700' }
    let score = 0
    if (nuevaClave.length >= 8) score++
    if (nuevaClave.length >= 12) score++
    if (/[A-Z]/.test(nuevaClave) && /[a-z]/.test(nuevaClave)) score++
    if (/\d/.test(nuevaClave)) score++
    if (/[^A-Za-z0-9]/.test(nuevaClave)) score++
    if (score <= 1) return { nivel: 1, texto: 'Débil', color: 'bg-red-500' }
    if (score <= 3) return { nivel: 2, texto: 'Media', color: 'bg-amber-500' }
    return { nivel: 3, texto: 'Fuerte', color: 'bg-emerald-500' }
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setResultado({
        tipo: 'error',
        texto: 'No se recibió el token de recuperación. Solicita un nuevo enlace desde la página de inicio de sesión.',
      })
      return
    }
    if (nuevaClave.length < 6 || nuevaClave.length > 64) {
      setResultado({ tipo: 'error', texto: 'La clave debe tener entre 6 y 64 caracteres.' })
      return
    }
    if (nuevaClave !== confirmarClave) {
      setResultado({ tipo: 'error', texto: 'Las claves no coinciden.' })
      return
    }

    setLoading(true)
    setResultado(null)
    try {
      const r = await fetch('/api/auth/restablecer-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nuevaClave, confirmarClave }),
      })
      const json = await r.json()
      if (json.success) {
        // Si es cliente, viene con token de sesión → auto-login
        if (json.tipo === 'CLIENTE' && json.token) {
          setResultado({
            tipo: 'exito',
            texto: json.mensaje || 'Tu contraseña se ha actualizado correctamente.',
            autoLogin: true,
          })
          // Guardar sesión en localStorage MIRROR del login normal (/login/page.tsx)
          // para que la página principal detecte la sesión y abra el portal.
          setTimeout(() => {
            try {
              localStorage.setItem('portal_cliente_token', json.token)
              localStorage.setItem('portal_cliente_id', json.clienteId)
              localStorage.setItem('portal_cliente_nombre', json.nombre)
              // Usamos la cédula devuelta por el backend
              localStorage.setItem('portal_cliente_cedula', json.clienteCedula || json.clienteId)
            } catch {}
            // Setear tokens JWT y userData para que el guard de /?portal=cliente funcione
            setTokens('portal_cliente_' + json.token, 'portal_cliente_' + json.token)
            setUserData({
              id: json.clienteId,
              nombre: json.nombre,
              username: json.clienteCedula || json.clienteId,
              cedula: json.clienteCedula || json.clienteId,
              rol: 'CLIENTE',
              esPortalCliente: true,
            })
            // Redirigir al portal del cliente
            router.push('/?portal=cliente')
            router.refresh()
          }, 1500)
        } else {
          // Usuario admin/abogado → debe re-login
          setResultado({
            tipo: 'exito',
            texto: json.mensaje || 'Tu contraseña se ha actualizado correctamente.',
            autoLogin: false,
          })
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        }
      } else {
        setResultado({
          tipo: 'error',
          texto: json.error || 'No se pudo actualizar la contraseña.',
        })
      }
    } catch (err: any) {
      setResultado({ tipo: 'error', texto: err.message || 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  // === Estado: sin token ===
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold">Enlace inválido</h1>
                  <p className="text-xs opacity-90">Falta el token de recuperación</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Este enlace no contiene un token de recuperación válido. Es posible que hayas
                abierto el enlace incompleto o que el enlace ya haya sido utilizado.
              </p>
              <p className="text-xs text-slate-400">
                Para restablecer tu contraseña, solicita un nuevo enlace desde la página de
                inicio de sesión haciendo clic en «¿Olvidaste tu contraseña?».
              </p>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-medium transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Ir a iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // === Estado: éxito ===
  if (resultado?.tipo === 'exito') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h1 className="text-xl font-bold">¡Contraseña actualizada!</h1>
              <p className="text-sm opacity-90 mt-1">
                {resultado.autoLogin ? 'Abriendo tu portal...' : 'Redirigiendo al inicio de sesión...'}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed text-center">
                {resultado.texto}
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // === Estado: formulario principal ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Crear nueva contraseña</h1>
                <p className="text-xs opacity-90">Restablece tu acceso al portal</p>
              </div>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              Hemos verificado tu identidad a través del enlace enviado a tu correo. Ahora puedes
              crear una nueva contraseña para acceder a tu cuenta.
            </p>
          </div>

          {/* Cuerpo */}
          <div className="p-6 space-y-4">
            {/* Alerta de error */}
            {resultado?.tipo === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{resultado.texto}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nueva clave */}
              <div className="space-y-2">
                <Label htmlFor="nueva-clave" className="text-slate-200 text-sm font-medium flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="nueva-clave"
                    type={mostrarClave ? 'text' : 'password'}
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                    disabled={loading}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarClave((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {mostrarClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Indicador de fortaleza */}
                {nuevaClave && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${fortaleza.color} transition-all`}
                        style={{ width: `${(fortaleza.nivel / 3) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 w-12 text-right">
                      {fortaleza.texto}
                    </span>
                  </div>
                )}
                {errores.nueva && (
                  <p className="text-[11px] text-red-300">{errores.nueva}</p>
                )}
              </div>

              {/* Confirmar clave */}
              <div className="space-y-2">
                <Label htmlFor="confirmar-clave" className="text-slate-200 text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Confirma la nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="confirmar-clave"
                    type={mostrarConfirmar ? 'text' : 'password'}
                    value={confirmarClave}
                    onChange={(e) => setConfirmarClave(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="pr-10 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {mostrarConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errores.confirmar && (
                  <p className="text-[11px] text-red-300">{errores.confirmar}</p>
                )}
              </div>

              {/* Requisitos */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 mb-1">Requisitos de la contraseña:</p>
                <p>• Mínimo 6 caracteres (recomendado: 12+)</p>
                <p>• Combina mayúsculas, minúsculas, números y símbolos</p>
                <p>• No uses una contraseña que ya tengas en otro sitio</p>
              </div>

              <Button
                type="submit"
                disabled={
                  loading ||
                  !nuevaClave ||
                  !confirmarClave ||
                  nuevaClave !== confirmarClave ||
                  nuevaClave.length < 6
                }
                className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Crear nueva contraseña
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Volver */}
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 hover:underline transition-colors pt-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Volver a iniciar sesión
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500 mt-4">
          Si tienes problemas con este enlace, solicita uno nuevo desde la página de inicio de sesión.
          <br />
          © 2026 Jsadr · Jo*** Se*** Al*** D** R**
        </p>
      </div>
    </div>
  )
}

export default function RecuperarClavePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <RecuperarClaveInner />
    </Suspense>
  )
}
