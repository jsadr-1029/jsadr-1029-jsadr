'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Scale,
  LogIn,
  LogOut,
  Loader2,
  Send,
  Briefcase,
  MessageSquare,
  Clock,
  User,
  Lock,
  AlertCircle,
  Gavel,
  FileText,
  Bell,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  CircleDollarSign,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

// =====================================================
// Tipos
// =====================================================
interface UsuarioSesion {
  id: string
  nombre: string
  username: string
  rol: string
  cedula: string | null
}

interface CronologiaItem {
  id: string
  fecha: string
  tipoEvento: string
  titulo: string
  descripcion: string | null
  resultado: string | null
  actor: string | null
  monto: number | null
}

interface AlertaItem {
  id: string
  tipo: string
  descripcion: string
  fechaAlerta: string
  atendida: boolean
}

interface DocumentoItem {
  id: string
  tipo: string
  nombre: string
  descripcion: string | null
  fechaSubida: string
}

interface CasoJuridico {
  id: string
  estado: string
  abogadoNombre: string | null
  abogadoTelefono: string | null
  abogadoEmail: string | null
  abogadoAsignado: boolean
  honorarios: number
  honorariosPagados: number
  juzgado: string | null
  radicado: string | null
  tipoProceso: string | null
  valorReclamado: number | null
  fechaPresentacionDemanda: string | null
  fechaAdmision: string | null
  fechaEmbargo: string | null
  fechaAudiencia: string | null
  descripcion: string | null
  fechaApertura: string
  fechaCierre: string | null
  resultadoFinal: string | null
  createdAt: string
  prestamo: {
    id: string
    codigo: string
    montoPrincipal: number
    saldoTotal: number
    diasMora: number
    montoMora: number
    montoPagado: number
    cuotasPagadas: number
    numeroCuotas: number
    estado: string
    fechaVencimiento: string | null
    cliente: {
      id: string
      nombre: string
      cedula: string
      telefono: string
      email: string | null
      direccion: string | null
      ciudad: string | null
    }
  }
  cronologia: CronologiaItem[]
  alertas: AlertaItem[]
  documentos: DocumentoItem[]
}

interface MensajeChat {
  id: string
  conversacionId: string
  remitenteTipo: string
  remitenteId: string | null
  remitenteNombre: string
  contenido: string
  tipoMensaje: string
  fechaEnvio: string
  estado: string
}

// =====================================================
// Helpers
// =====================================================
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const ESTADO_COLOR: Record<string, string> = {
  PRE_JUDICIAL: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  DEMANDA: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  EJECUCION: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  COBRO_JUDICIAL: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  CONCILIACION: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  SENTENCIA: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  CERRADO: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
}

function estadoBadge(estado: string) {
  const cls = ESTADO_COLOR[estado] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {estado.replace(/_/g, ' ')}
    </span>
  )
}

// =====================================================
// Componente principal
// =====================================================
export default function PortalJuridicoPage() {
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)

  // Persistencia local del token
  useEffect(() => {
    const t = localStorage.getItem('juridico-portal-token')
    if (t) {
      setToken(t)
      // Verificar sesión
      fetch(`/api/juridico/portal/auth?token=${encodeURIComponent(t)}`)
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json()
            if (data.success) {
              setUsuario(data.data.usuario)
            } else {
              localStorage.removeItem('juridico-portal-token')
              setToken(null)
            }
          } else {
            localStorage.removeItem('juridico-portal-token')
            setToken(null)
          }
        })
        .catch(() => {
          localStorage.removeItem('juridico-portal-token')
          setToken(null)
        })
        .finally(() => setCargandoSesion(false))
    } else {
      setCargandoSesion(false)
    }
  }, [])

  const handleLogin = (newToken: string, user: UsuarioSesion) => {
    setToken(newToken)
    setUsuario(user)
    localStorage.setItem('juridico-portal-token', newToken)
  }

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`/api/juridico/portal/auth?token=${encodeURIComponent(token)}`, {
          method: 'DELETE',
        })
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('juridico-portal-token')
    setToken(null)
    setUsuario(null)
    toast({
      title: 'Sesión cerrada',
      description: 'Has cerrado sesión del portal jurídico.',
    })
  }

  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!token || !usuario) {
    return <LoginView onLogin={handleLogin} />
  }

  return <DashboardView usuario={usuario} token={token} onLogout={handleLogout} />
}

// =====================================================
// Vista de Login
// =====================================================
function LoginView({ onLogin }: { onLogin: (token: string, user: UsuarioSesion) => void }) {
  const { toast } = useToast()
  const [cedula, setCedula] = useState('')
  const [clave, setClave] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!cedula.trim() || !clave) {
      setError('Cédula y clave son obligatorias')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/juridico/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim(), clave }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        const msg = data.error || 'Error al iniciar sesión'
        setError(msg)
        toast({ title: 'Error de acceso', description: msg, variant: 'destructive' })
        return
      }
      toast({
        title: `Bienvenido/a, ${data.data.usuario.nombre}`,
        description: 'Has ingresado al portal jurídico Jsadr.',
      })
      onLogin(data.data.token, data.data.usuario)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de red'
      setError(msg)
      toast({ title: 'Error de red', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[oklch(0.18_0.04_265)] via-[oklch(0.20_0.05_275)] to-[oklch(0.16_0.06_290)] text-foreground">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 backdrop-blur-sm mb-4">
              <Scale className="size-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Portal Jurídico</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Sistema Jsadr — Acceso para abogados y gestores
            </p>
          </div>

          <Card className="backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="size-5 text-primary" />
                Iniciar sesión
              </CardTitle>
              <CardDescription>
                Ingresa con tu cédula y clave para acceder a tus casos asignados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula">Cédula</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="cedula"
                      type="text"
                      inputMode="numeric"
                      autoComplete="username"
                      placeholder="Ej: 12345678"
                      className="pl-9"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clave">Clave</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="clave"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pl-9"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-red-300">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Ingresar
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Credenciales de demostración:</p>
                <p>
                  Abogado: cédula <code className="text-primary">12345678</code> · clave{' '}
                  <code className="text-primary">abogado123</code>
                </p>
                <p>
                  Gestor: cédula <code className="text-primary">98765432</code> · clave{' '}
                  <code className="text-primary">gestor123</code>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} Jsadr · Sistema de Gestión Jurídica
          </p>
        </div>
      </main>
    </div>
  )
}

// =====================================================
// Vista del Dashboard (autenticado)
// =====================================================
function DashboardView({
  usuario,
  token,
  onLogout,
}: {
  usuario: UsuarioSesion
  token: string
  onLogout: () => void
}) {
  const [tab, setTab] = useState<'casos' | 'chat'>('casos')

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[oklch(0.18_0.04_265)] via-[oklch(0.20_0.05_275)] to-[oklch(0.16_0.06_290)] text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Scale className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">Portal Jurídico Jsadr</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {usuario.rol === 'GESTOR' ? 'Gestor jurídico' : 'Abogado asignado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-sm font-medium">{usuario.nombre}</span>
              <span className="text-xs text-muted-foreground">
                {usuario.cedula ? `C.C. ${usuario.cedula}` : usuario.username}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>

        {/* Tabs móvil */}
        <div className="sm:hidden border-t border-white/10 px-4 py-2 flex gap-2">
          <Button
            size="sm"
            variant={tab === 'casos' ? 'default' : 'outline'}
            onClick={() => setTab('casos')}
            className="flex-1"
          >
            <Briefcase className="size-4" />
            Casos
          </Button>
          <Button
            size="sm"
            variant={tab === 'chat' ? 'default' : 'outline'}
            onClick={() => setTab('chat')}
            className="flex-1"
          >
            <MessageSquare className="size-4" />
            Chat
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'casos' | 'chat')}
          className="w-full"
        >
          <TabsList className="hidden sm:inline-flex">
            <TabsTrigger value="casos" className="gap-1.5">
              <Briefcase className="size-4" />
              Mis Casos
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" />
              Chat Interno
            </TabsTrigger>
          </TabsList>

          <TabsContent value="casos" className="mt-4 sm:mt-6">
            <CasosTab token={token} usuario={usuario} />
          </TabsContent>

          <TabsContent value="chat" className="mt-4 sm:mt-6">
            <ChatTab token={token} usuario={usuario} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Jsadr · Sistema de Gestión Jurídica</p>
          <p>Sesión activa · {usuario.nombre}</p>
        </div>
      </footer>
    </div>
  )
}

// =====================================================
// Tab: Casos
// =====================================================
function CasosTab({ token, usuario }: { token: string; usuario: UsuarioSesion }) {
  const { toast } = useToast()
  const [casos, setCasos] = useState<CasoJuridico[]>([])
  const [resumen, setResumen] = useState<{
    total: number
    porEstado: Record<string, number>
    honorariosTotal: number
    honorariosPagados: number
    honorariosPendientes: number
    valorReclamadoTotal: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [casoSeleccionado, setCasoSeleccionado] = useState<CasoJuridico | null>(null)

  const cargarCasos = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/juridico/portal/casos', {
        headers: { 'x-juridico-token': token },
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        toast({
          title: 'Error al cargar casos',
          description: data.error || 'No se pudieron obtener los casos.',
          variant: 'destructive',
        })
        return
      }
      setCasos(data.data.casos || [])
      setResumen(data.data.resumen || null)
    } catch (err) {
      toast({
        title: 'Error de red',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  useEffect(() => {
    cargarCasos()
  }, [cargarCasos])

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CardMetric
            label="Total casos"
            value={resumen.total}
            icon={<Briefcase className="size-4" />}
          />
          <CardMetric
            label="Valor reclamado"
            value={formatCurrency(resumen.valorReclamadoTotal)}
            icon={<CircleDollarSign className="size-4" />}
          />
          <CardMetric
            label="Honorarios"
            value={formatCurrency(resumen.honorariosTotal)}
            icon={<CircleDollarSign className="size-4" />}
          />
          <CardMetric
            label="Pagados"
            value={formatCurrency(resumen.honorariosPagados)}
            icon={<CircleDollarSign className="size-4" />}
            tone="emerald"
          />
          <CardMetric
            label="Pendientes"
            value={formatCurrency(resumen.honorariosPendientes)}
            icon={<CircleDollarSign className="size-4" />}
            tone="amber"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Casos asignados</h2>
          <p className="text-sm text-muted-foreground">
            {usuario.rol === 'GESTOR'
              ? 'Todos los casos jurídicos activos (rol gestor).'
              : 'Casos donde figuras como abogado asignado.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargarCasos} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : casos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tienes casos asignados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {casos.map((c) => (
            <CasoCard key={c.id} caso={c} onClick={() => setCasoSeleccionado(c)} />
          ))}
        </div>
      )}

      {/* Detalle del caso */}
      {casoSeleccionado && (
        <CasoDetalleDialog
          caso={casoSeleccionado}
          onClose={() => setCasoSeleccionado(null)}
        />
      )}
    </div>
  )
}

function CardMetric({
  label,
  value,
  icon,
  tone = 'primary',
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  tone?: 'primary' | 'emerald' | 'amber'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'amber'
      ? 'text-amber-300'
      : 'text-primary'
  return (
    <Card className="py-3 backdrop-blur-md">
      <CardContent className="px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <p className={`text-base sm:text-lg font-semibold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function CasoCard({ caso, onClick }: { caso: CasoJuridico; onClick: () => void }) {
  const cliente = caso.prestamo?.cliente
  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:bg-white/[0.06] transition-all py-0 overflow-hidden"
      onClick={onClick}
    >
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Caso jurídico</p>
            <p className="font-semibold text-sm truncate">
              {caso.radicado || caso.prestamo?.codigo || 'Sin radicado'}
            </p>
          </div>
          {estadoBadge(caso.estado)}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{cliente?.nombre || 'Cliente N/A'}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>C.C. {cliente?.cedula || '—'}</span>
          <span>{caso.tipoProceso || 'Sin tipo'}</span>
        </div>
        <div className="my-2 h-px bg-white/10" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Saldo</p>
            <p className="font-medium">{formatCurrency(caso.prestamo?.saldoTotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Días mora</p>
            <p className="font-medium">{caso.prestamo?.diasMora ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valor reclamado</p>
            <p className="font-medium">{formatCurrency(caso.valorReclamado)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Eventos</p>
            <p className="font-medium">{caso.cronologia?.length || 0}</p>
          </div>
        </div>
        {caso.alertas && caso.alertas.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-300 mt-2">
            <Bell className="size-3.5" />
            <span>{caso.alertas.length} alerta(s) pendiente(s)</span>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full mt-2">
          Ver detalle
          <ChevronRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

function CasoDetalleDialog({
  caso,
  onClose,
}: {
  caso: CasoJuridico
  onClose: () => void
}) {
  const [tab, setTab] = useState<'info' | 'cronologia' | 'alertas'>('info')
  const cliente = caso.prestamo?.cliente

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Gavel className="size-5 text-primary" />
            <span>Caso {caso.radicado || caso.prestamo?.codigo || 'Sin radicado'}</span>
            {estadoBadge(caso.estado)}
          </DialogTitle>
          <DialogDescription>
            Tipo de proceso: {caso.tipoProceso || 'No definido'} · Abierto el{' '}
            {formatDate(caso.fechaApertura)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'info' | 'cronologia' | 'alertas')}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-1.5">
                <FileText className="size-3.5" />
                Información
              </TabsTrigger>
              <TabsTrigger value="cronologia" className="flex-1 gap-1.5">
                <Clock className="size-3.5" />
                Cronología ({caso.cronologia?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="alertas" className="flex-1 gap-1.5">
                <Bell className="size-3.5" />
                Alertas ({caso.alertas?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Cliente */}
                <Card className="py-3">
                  <CardHeader className="px-4 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="size-4" />
                      Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 space-y-1 text-sm">
                    <p className="font-medium">{cliente?.nombre || 'N/A'}</p>
                    <p className="text-muted-foreground text-xs">C.C. {cliente?.cedula || '—'}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="size-3" />
                      <span>{cliente?.telefono || '—'}</span>
                    </div>
                    {cliente?.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="size-3" />
                        <span className="truncate">{cliente.email}</span>
                      </div>
                    )}
                    {cliente?.direccion && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="size-3" />
                        <span className="truncate">
                          {cliente.direccion}
                          {cliente.ciudad ? `, ${cliente.ciudad}` : ''}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Préstamo */}
                <Card className="py-3">
                  <CardHeader className="px-4 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CircleDollarSign className="size-4" />
                      Préstamo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Código</span>
                      <span className="font-medium">{caso.prestamo?.codigo || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Capital</span>
                      <span>{formatCurrency(caso.prestamo?.montoPrincipal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Saldo total</span>
                      <span className="font-medium">{formatCurrency(caso.prestamo?.saldoTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Días de mora</span>
                      <span className="text-amber-300 font-medium">
                        {caso.prestamo?.diasMora ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Mora acumulada</span>
                      <span>{formatCurrency(caso.prestamo?.montoMora)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Cuotas</span>
                      <span>
                        {caso.prestamo?.cuotasPagadas ?? 0} / {caso.prestamo?.numeroCuotas ?? 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Proceso judicial */}
                <Card className="py-3 sm:col-span-2">
                  <CardHeader className="px-4 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gavel className="size-4" />
                      Proceso judicial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 grid sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Juzgado</span>
                      <span>{caso.juzgado || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Radicado</span>
                      <span>{caso.radicado || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Valor reclamado</span>
                      <span className="font-medium">{formatCurrency(caso.valorReclamado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Honorarios</span>
                      <span>{formatCurrency(caso.honorarios)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Demanda presentada</span>
                      <span>{formatDate(caso.fechaPresentacionDemanda)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Admitida</span>
                      <span>{formatDate(caso.fechaAdmision)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Embargo</span>
                      <span>{formatDate(caso.fechaEmbargo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Audiencia</span>
                      <span>{formatDate(caso.fechaAudiencia)}</span>
                    </div>
                  </CardContent>
                </Card>

                {caso.descripcion && (
                  <Card className="py-3 sm:col-span-2">
                    <CardHeader className="px-4 pb-2">
                      <CardTitle className="text-sm">Descripción</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 text-sm whitespace-pre-wrap">
                      {caso.descripcion}
                    </CardContent>
                  </Card>
                )}

                {caso.resultadoFinal && (
                  <Card className="py-3 sm:col-span-2 border-emerald-500/20">
                    <CardHeader className="px-4 pb-2">
                      <CardTitle className="text-sm text-emerald-300">Resultado final</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 text-sm whitespace-pre-wrap">
                      {caso.resultadoFinal}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="cronologia" className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {caso.cronologia && caso.cronologia.length > 0 ? (
                <div className="space-y-3">
                  {caso.cronologia.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="shrink-0">
                        <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <Clock className="size-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{ev.titulo}</span>
                          <Badge variant="outline" className="text-xs">
                            {ev.tipoEvento}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(ev.fecha)}
                          </span>
                        </div>
                        {ev.descripcion && (
                          <p className="text-sm text-muted-foreground mt-1">{ev.descripcion}</p>
                        )}
                        {ev.resultado && (
                          <p className="text-xs text-emerald-300 mt-1">
                            Resultado: {ev.resultado}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {ev.actor && <span>Por: {ev.actor}</span>}
                          {ev.monto != null && ev.monto > 0 && (
                            <span>Monto: {formatCurrency(ev.monto)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay eventos registrados en la cronología.
                </div>
              )}
            </TabsContent>

            <TabsContent value="alertas" className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {caso.alertas && caso.alertas.length > 0 ? (
                <div className="space-y-2">
                  {caso.alertas.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                    >
                      <Bell className="size-5 text-amber-300 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{a.tipo}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(a.fechaAlerta)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{a.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay alertas pendientes.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Tab: Chat interno con Asesor Jurídico
// =====================================================
function ChatTab({ token, usuario }: { token: string; usuario: UsuarioSesion }) {
  const { toast } = useToast()
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const cargarHistorial = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/juridico/portal/chat?token=${encodeURIComponent(token)}`)
      const data = await r.json()
      if (r.ok && data.success) {
        setMensajes(data.data.mensajes || [])
      } else {
        toast({
          title: 'Error al cargar chat',
          description: data.error || 'No se pudo cargar el historial.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error de red',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || enviando) return

    setEnviando(true)
    const mensajeLocal: MensajeChat = {
      id: `local-${Date.now()}`,
      conversacionId: '',
      remitenteTipo: 'ASESOR',
      remitenteId: usuario.id,
      remitenteNombre: `Abogado ${usuario.nombre}`,
      contenido: texto,
      tipoMensaje: 'TEXTO',
      fechaEnvio: new Date().toISOString(),
      estado: 'ENVIADO',
    }
    setMensajes((prev) => [...prev, mensajeLocal])
    setInput('')

    try {
      const r = await fetch('/api/juridico/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mensaje: texto }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        toast({
          title: 'Error al enviar',
          description: data.error || 'No se pudo enviar el mensaje.',
          variant: 'destructive',
        })
        setMensajes((prev) => prev.filter((m) => m.id !== mensajeLocal.id))
        setInput(texto)
        return
      }
      // Reemplazar el local por el persistido + añadir la respuesta del bot
      setMensajes((prev) => [
        ...prev.filter((m) => m.id !== mensajeLocal.id),
        data.data.mensaje,
        data.data.respuesta,
      ])
    } catch (err) {
      toast({
        title: 'Error de red',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
      setMensajes((prev) => prev.filter((m) => m.id !== mensajeLocal.id))
      setInput(texto)
    } finally {
      setEnviando(false)
    }
  }

  const quickActions = [
    { label: 'Casos activos', value: 'casos activos' },
    { label: 'Candidatos', value: 'candidatos a jurídico' },
    { label: 'Alertas', value: 'alertas pendientes' },
    { label: 'Cobranza', value: 'asesoría en cobranza' },
    { label: 'Pagaré', value: 'asesoría sobre pagaré' },
    { label: 'Menú', value: 'menú' },
  ]

  return (
    <Card className="backdrop-blur-md flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Scale className="size-4 text-primary" />
            </div>
            Asesor Jurídico
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            Chat interno · JURIDICO_INTERNO
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Asistente del portal jurídico — consulta casos, candidatos, asesoría legal y más.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-4 py-4 space-y-4"
            style={{ scrollbarWidth: 'thin' }}
          >
            {mensajes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Scale className="size-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-foreground">Asesor Jurídico</p>
                <p className="text-xs mt-1">
                  Bienvenido/a {usuario.nombre}. Escribe un mensaje o usa una de las opciones
                  rápidas para comenzar.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {quickActions.map((qa) => (
                    <Button
                      key={qa.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(qa.value)}
                    >
                      {qa.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m) => (
              <MensajeBubble key={m.id} mensaje={m} esMio={m.remitenteTipo === 'ASESOR'} />
            ))}
          </div>
        )}
      </CardContent>

      <div className="border-t border-white/10 p-3 space-y-2">
        {mensajes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((qa) => (
              <Button
                key={qa.label}
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setInput(qa.value)}
                disabled={enviando}
              >
                {qa.label}
              </Button>
            ))}
          </div>
        )}
        <form onSubmit={handleEnviar} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta jurídica..."
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={enviando}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEnviar(e)
              }
            }}
          />
          <Button type="submit" size="icon" disabled={enviando || !input.trim()}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </Card>
  )
}

function MensajeBubble({ mensaje, esMio }: { mensaje: MensajeChat; esMio: boolean }) {
  const esBot = mensaje.remitenteTipo === 'BOT'
  return (
    <div className={`flex gap-2 ${esMio ? 'flex-row-reverse' : ''}`}>
      <div
        className={`size-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium ${
          esBot
            ? 'bg-primary/20 border border-primary/30 text-primary'
            : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
        }`}
      >
        {esBot ? <Scale className="size-4" /> : <User className="size-4" />}
      </div>
      <div className={`max-w-[80%] ${esMio ? 'items-end text-right' : 'items-start'}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="font-medium">{mensaje.remitenteNombre}</span>
          <span>{formatDateTime(mensaje.fechaEnvio)}</span>
        </div>
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            esMio
              ? 'bg-primary/20 border border-primary/30 rounded-tr-sm'
              : 'bg-white/[0.06] border border-white/10 rounded-tl-sm'
          }`}
        >
          {mensaje.contenido}
        </div>
      </div>
    </div>
  )
}
