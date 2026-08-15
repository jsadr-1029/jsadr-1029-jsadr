'use client'

// =====================================================
// ContadorShell — envoltura cliente del Portal del Contador
// Decide qué mostrar según estado de auth:
//  - loading → spinner
//  - sin usuario → formulario de login
//  - usuario con mustChangePassword → cambio de contraseña
//  - usuario autenticado → sidebar + header + contenido
// =====================================================

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Calculator, Loader2, Lock, LogIn, ShieldCheck } from 'lucide-react'
import { useContadorAuth } from './contador-auth-provider'
import { SidebarContador } from './SidebarContador'
import { HeaderContador } from './HeaderContador'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from 'sonner'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        <p className="text-sm">Cargando Portal del Contador…</p>
      </div>
    </div>
  )
}

function LoginForm() {
  const { login } = useContadorAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const r = await login(username, password)
    setLoading(false)
    if (!r.ok) {
      setError(r.error || 'No se pudo iniciar sesión.')
      return
    }
    toast.success('Sesión iniciada correctamente.')
    router.replace('/portal-contador/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg">
            <Calculator className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Portal del Contador</h1>
            <p className="text-sm text-slate-300">JSADR · Gestión contable y tributaria</p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/80 p-6 shadow-2xl backdrop-blur"
        >
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-200">
              Usuario
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Js_Contador"
              autoComplete="username"
              required
              className="border-slate-600 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="border-slate-600 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full gap-2 bg-sky-500 hover:bg-sky-600">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Ingresar
          </Button>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Acceso restringido a usuarios con rol CONTADOR. En el primer inicio de sesión se solicitará
            el cambio de contraseña.
          </div>
          <p className="text-center text-[11px] text-slate-400">
            <a href="/" className="hover:text-slate-200">
              ← Volver a la plataforma principal
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const { cambiarPassword, user, logout } = useContadorAuth()
  const router = useRouter()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.')
      return
    }
    setLoading(true)
    const r = await cambiarPassword(actual, nueva)
    setLoading(false)
    if (!r.ok) {
      setError(r.error || 'No se pudo cambiar la contraseña.')
      return
    }
    toast.success('Contraseña actualizada correctamente.')
    router.replace('/portal-contador/dashboard')
  }

  const cancelar = async () => {
    await logout()
    router.replace('/portal-contador')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cambio de contraseña obligatorio</h1>
            <p className="text-sm text-slate-300">
              Hola {user?.nombre}, por seguridad debes establecer una nueva contraseña.
            </p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/80 p-6 shadow-2xl backdrop-blur"
        >
          <div className="space-y-2">
            <Label htmlFor="actual" className="text-slate-200">
              Contraseña actual
            </Label>
            <Input
              id="actual"
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
              className="border-slate-600 bg-slate-900 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nueva" className="text-slate-200">
              Nueva contraseña (mín. 8 caracteres)
            </Label>
            <Input
              id="nueva"
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              required
              className="border-slate-600 bg-slate-900 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar" className="text-slate-200">
              Confirmar nueva contraseña
            </Label>
            <Input
              id="confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              className="border-slate-600 bg-slate-900 text-white"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={cancelar} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 gap-2 bg-sky-500 hover:bg-sky-600">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ContadorShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContadorAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Si está autenticado y en la raíz del portal, ir al dashboard
  useEffect(() => {
    if (!loading && user && !user.mustChangePassword && pathname === '/portal-contador') {
      router.replace('/portal-contador/dashboard')
    }
  }, [loading, user, pathname, router])

  if (loading) return <Spinner />
  if (!user) return <LoginForm />
  if (user.mustChangePassword) return <ChangePasswordForm />

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContador />
        </div>
      </div>

      {/* Sidebar móvil via Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="flex flex-1 flex-col">
          <HeaderContador onToggleSidebar={() => setMobileOpen(true)} />
          <main className="flex-1">{children}</main>
        </div>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContador onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
