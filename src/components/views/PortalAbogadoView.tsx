'use client'

// =====================================================
// PortalAbogadoView — Portal de Abogado (Módulo 3)
// 1. Login con cédula + clave
// 2. Informe de casos jurídicos asignados al abogado
// 3. Chat interno con categoría "JURIDICO_INTERNO"
// 4. Gestión admin (crear/activar/desactivar abogados) si es ADMIN
// =====================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  Scale,
  Lock,
  LogOut,
  Send,
  RefreshCw,
  Briefcase,
  Gavel,
  FileText,
  Bell,
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react'

interface AbogadoSesion {
  token: string
  expira: string
  abogado: { id: string; cedula: string; nombre: string; username?: string; rol?: string }
}

interface CasoJuridico {
  id: string
  estado: string
  abogadoNombre: string | null
  abogadoTelefono: string | null
  abogadoEmail: string | null
  honorarios: number
  honorariosPagados: number
  juzgado: string | null
  radicado: string | null
  valorReclamado: number | null
  descripcion: string | null
  fechaApertura: string
  prestamo: any
  cronologia: any[]
  documentos: any[]
  alertas: any[]
}

interface MensajeChat {
  id: string
  remitenteNombre: string
  remitenteTipo: string
  contenido: string
  fechaEnvio: string
}

interface AbogadoAdmin {
  id: string
  cedula: string
  nombre: string
  activo: boolean
  ultimoAcceso: string | null
  createdAt: string
}

export function PortalAbogadoView() {
  const [sesion, setSesion] = useState<AbogadoSesion | null>(null)
  const [tab, setTab] = useState('informe')

  // Login form
  const [cedula, setCedula] = useState('')
  const [clave, setClave] = useState('')
  const [showClave, setShowClave] = useState(false)
  const [cargandoLogin, setCargandoLogin] = useState(false)

  const { toast } = useToast()

  // Persistir sesión en sessionStorage
  useEffect(() => {
    const guardada = sessionStorage.getItem('portal_abogado_sesion')
    if (guardada) {
      try {
        const parsed = JSON.parse(guardada) as AbogadoSesion
        // Verificar sesión vía GET ?token=...
        fetch(`/api/juridico/portal/auth?token=${encodeURIComponent(parsed.token)}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data?.usuario) {
              // Reutilizar los datos frescos del servidor
              const sesionActualizada: AbogadoSesion = {
                token: parsed.token,
                expira: json.data.expira || parsed.expira,
                abogado: {
                  id: json.data.usuario.id,
                  cedula: json.data.usuario.cedula || '',
                  nombre: json.data.usuario.nombre,
                  username: json.data.usuario.username,
                  rol: json.data.usuario.rol,
                },
              }
              setSesion(sesionActualizada)
              sessionStorage.setItem('portal_abogado_sesion', JSON.stringify(sesionActualizada))
            } else {
              sessionStorage.removeItem('portal_abogado_sesion')
            }
          })
          .catch(() => sessionStorage.removeItem('portal_abogado_sesion'))
      } catch {
        sessionStorage.removeItem('portal_abogado_sesion')
      }
    }
  }, [])

  const cerrarSesion = async () => {
    if (sesion) {
      try {
        await fetch(`/api/juridico/portal/auth?token=${encodeURIComponent(sesion.token)}`, {
          method: 'DELETE',
        })
      } catch (e) {
        // ignore
      }
    }
    sessionStorage.removeItem('portal_abogado_sesion')
    setSesion(null)
    toast({ title: 'Sesión cerrada' })
  }

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargandoLogin(true)
    try {
      const res = await fetch('/api/juridico/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, clave }),
      })
      const json = await res.json()
      if (json.success && json.data?.usuario) {
        // Mapear respuesta API (data.usuario) → estructura frontend (data.abogado)
        const sesionData: AbogadoSesion = {
          token: json.data.token,
          expira: json.data.expira,
          abogado: {
            id: json.data.usuario.id,
            cedula: json.data.usuario.cedula || '',
            nombre: json.data.usuario.nombre,
            username: json.data.usuario.username,
            rol: json.data.usuario.rol,
          },
        }
        setSesion(sesionData)
        sessionStorage.setItem('portal_abogado_sesion', JSON.stringify(sesionData))
        toast({ title: `Bienvenido, ${sesionData.abogado.nombre}` })
        setCedula('')
        setClave('')
      } else {
        toast({
          title: 'No se pudo iniciar sesión',
          description: json.error || 'Respuesta inesperada del servidor',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setCargandoLogin(false)
    }
  }

  // === Pantalla de login ===
  if (!sesion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg mb-2">
              <Scale className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">Portal de Abogado</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu usuario o cédula y clave para ver tus casos jurídicos
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={iniciarSesion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cedula-abogado">Usuario o cédula</Label>
                <Input
                  id="cedula-abogado"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  required
                  placeholder="Ej: Jd_jsadr o tu cédula"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clave-abogado">Clave</Label>
                <div className="relative">
                  <Input
                    id="clave-abogado"
                    type={showClave ? 'text' : 'password'}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    placeholder="Tu clave de acceso"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClave(!showClave)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={cargandoLogin}>
                {cargandoLogin ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Ingresar
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Si no tienes cuenta, solicítala al administrador del sistema.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === Panel principal ===
  // Defensive: si por algún motivo sesion.abogado falta (p.ej. sesión legacy en storage),
  // mostrar el formulario de login en vez de crashear.
  if (!sesion?.abogado) {
    sessionStorage.removeItem('portal_abogado_sesion')
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg mb-2">
              <Scale className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">Portal de Abogado</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tu sesión expiró. Ingresa nuevamente con tu usuario o cédula y clave.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={iniciarSesion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cedula-abogado">Usuario o cédula</Label>
                <Input
                  id="cedula-abogado"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  required
                  placeholder="Ej: Jd_jsadr o tu cédula"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clave-abogado">Clave</Label>
                <div className="relative">
                  <Input
                    id="clave-abogado"
                    type={showClave ? 'text' : 'password'}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    placeholder="Tu clave de acceso"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClave(!showClave)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={cargandoLogin}>
                {cargandoLogin ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Ingresar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Portal de Abogado — ${sesion.abogado.nombre}`}
        subtitle={`Cédula ${sesion.abogado.cedula}`}
        icon={<Scale className="w-5 h-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={cerrarSesion}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="informe">
            <Briefcase className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Informe</span>
          </TabsTrigger>
          <TabsTrigger value="chat">
            <Send className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="admin">
            <Users className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Admin</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="informe" className="mt-4">
          <InformeCasos token={sesion.token} />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <ChatInternoAbogado token={sesion.token} nombre={sesion.abogado.nombre} />
        </TabsContent>
        <TabsContent value="admin" className="mt-4">
          <AdminAbogados />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// Informe de casos del abogado
// =====================================================
function InformeCasos({ token }: { token: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [casoSeligido, setCasoSeligido] = useState<CasoJuridico | null>(null)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/juridico/portal/casos?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        toast({
          title: 'Error',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) return null

  const { casos, resumen, abogado } = data

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="w-6 h-6 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Total Casos</p>
            <p className="text-2xl font-bold">{resumen.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gavel className="w-6 h-6 mx-auto text-orange-600 mb-1" />
            <p className="text-xs text-muted-foreground">Honorarios</p>
            <p className="text-base font-bold text-orange-700">
              {formatearMoneda(resumen.honorariosTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="text-base font-bold text-emerald-700">
              {formatearMoneda(resumen.honorariosPagados)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Bell className="w-6 h-6 mx-auto text-red-600 mb-1" />
            <p className="text-xs text-muted-foreground">Por Cobrar</p>
            <p className="text-base font-bold text-red-700">
              {formatearMoneda(resumen.honorariosPendientes)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Por estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Casos por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(resumen.porEstado).map(([estado, n]) => (
              <Badge key={estado} variant="outline" className="text-xs">
                {estado}: {String(n)}
              </Badge>
            ))}
            {resumen.total === 0 && (
              <span className="text-sm text-muted-foreground">
                No tienes casos asignados.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de casos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Casos Asignados</CardTitle>
            <Button variant="outline" size="sm" onClick={cargar}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {casos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No tienes casos jurídicos asignados todavía.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Juzgado</TableHead>
                  <TableHead>Radicado</TableHead>
                  <TableHead>Honorarios</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {casos.map((c: CasoJuridico) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {c.prestamo?.cliente?.nombre || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.prestamo?.cliente?.cedula}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.prestamo?.codigo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{c.juzgado || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{c.radicado || '—'}</TableCell>
                    <TableCell className="text-xs">{formatearMoneda(c.honorarios)}</TableCell>
                    <TableCell className="text-xs">{formatearFecha(c.fechaApertura)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCasoSeligido(c)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal detalle del caso */}
      <Dialog open={!!casoSeligido} onOpenChange={(o) => !o && setCasoSeligido(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalle del Caso
            </DialogTitle>
          </DialogHeader>
          {casoSeligido && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{casoSeligido.prestamo?.cliente?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Solicitud</p>
                  <p className="font-mono text-xs">{casoSeligido.prestamo?.codigo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant="outline">{casoSeligido.estado}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Juzgado</p>
                  <p>{casoSeligido.juzgado || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Radicado</p>
                  <p className="font-mono text-xs">{casoSeligido.radicado || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Reclamado</p>
                  <p>{formatearMoneda(casoSeligido.valorReclamado || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Honorarios</p>
                  <p>{formatearMoneda(casoSeligido.honorarios)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Honorarios Pagados</p>
                  <p className="text-emerald-700">{formatearMoneda(casoSeligido.honorariosPagados)}</p>
                </div>
              </div>

              {casoSeligido.descripcion && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                  <div className="p-3 bg-muted/40 rounded text-xs whitespace-pre-wrap">
                    {casoSeligido.descripcion}
                  </div>
                </div>
              )}

              {casoSeligido.alertas.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Alertas Pendientes ({casoSeligido.alertas.length})
                  </p>
                  <ul className="space-y-1 text-xs">
                    {casoSeligido.alertas.map((a) => (
                      <li key={a.id} className="p-2 bg-amber-50 border border-amber-200 rounded">
                        <strong>{a.tipo}:</strong> {a.descripcion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {casoSeligido.cronologia.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cronología reciente</p>
                  <ul className="space-y-1 text-xs">
                    {casoSeligido.cronologia.map((cr) => (
                      <li key={cr.id} className="p-2 bg-muted/30 rounded">
                        <div className="flex justify-between">
                          <strong>{cr.titulo}</strong>
                          <span className="text-muted-foreground">
                            {formatearFechaHora(cr.fecha)}
                          </span>
                        </div>
                        {cr.descripcion && <div className="mt-1">{cr.descripcion}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {casoSeligido.documentos.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Documentos ({casoSeligido.documentos.length})
                  </p>
                  <ul className="space-y-1 text-xs">
                    {casoSeligido.documentos.map((d) => (
                      <li key={d.id} className="p-2 bg-muted/30 rounded">
                        <FileText className="w-3 h-3 inline mr-1" />
                        <strong>{d.tipo}</strong>: {d.nombre}
                        <span className="text-muted-foreground ml-2">
                          {formatearFecha(d.fechaSubida)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// Chat interno del abogado
// =====================================================
function ChatInternoAbogado({ token, nombre }: { token: string; nombre: string }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [contenido, setContenido] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/juridico/portal/chat?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (json.success) {
        setMensajes(json.data.mensajes || [])
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 5000)
    return () => clearInterval(interval)
  }, [cargar])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contenido.trim()) return
    setEnviando(true)
    try {
      const res = await fetch('/api/juridico/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mensaje: contenido }),
      })
      const json = await res.json()
      if (json.success) {
        setContenido('')
        cargar()
      } else {
        toast({
          title: 'Error al enviar',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" />
          Chat Interno — {nombre}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Categoría: <Badge variant="outline">JURIDICO_INTERNO</Badge> · Visible para el equipo
          interno en el Centro de Comunicaciones
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-[420px] overflow-y-auto border rounded-lg p-3 space-y-2 bg-muted/20"
        >
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Cargando mensajes...
            </div>
          ) : mensajes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aún no hay mensajes. Inicia la conversación con el equipo interno.
            </div>
          ) : (
            mensajes.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.remitenteTipo === 'ASESOR' && m.remitenteNombre.includes(nombre)
                    ? 'items-end'
                    : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.remitenteTipo === 'ASESOR' && m.remitenteNombre.includes(nombre)
                      ? 'bg-primary text-primary-foreground'
                      : m.remitenteTipo === 'SISTEMA'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-muted text-foreground'
                  }`}
                >
                  <div className="text-[10px] font-semibold opacity-75 mb-0.5">
                    {m.remitenteNombre}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.contenido}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">
                    {formatearFechaHora(m.fechaEnvio)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={enviar} className="flex gap-2">
          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Escribe tu mensaje al equipo interno..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(e)
              }
            }}
            className="flex-1"
            disabled={enviando}
          />
          <Button type="submit" disabled={enviando || !contenido.trim()}>
            {enviando ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Admin: gestión de abogados (crear/activar/desactivar)
// =====================================================
function AdminAbogados() {
  const [abogados, setAbogados] = useState<AbogadoAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [form, setForm] = useState({ cedula: '', nombre: '', clave: '' })
  const [creando, setCreando] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/juridico/portal/auth')
      const json = await res.json()
      if (json.success) {
        setAbogados(json.data)
      } else {
        toast({
          title: 'Sin permisos',
          description: json.error || 'Solo el ADMIN puede gestionar abogados.',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crearAbogado = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreando(true)
    try {
      const res = await fetch('/api/juridico/portal/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Abogado creado', description: `${form.nombre} (${form.cedula})` })
        setForm({ cedula: '', nombre: '', clave: '' })
        setModalCrear(false)
        cargar()
      } else {
        toast({
          title: 'Error',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setCreando(false)
    }
  }

  const toggleActivo = async (a: AbogadoAdmin) => {
    try {
      const res = await fetch('/api/juridico/portal/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: a.id,
          accion: a.activo ? 'desactivar' : 'activar',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: json.mensaje })
        cargar()
      } else {
        toast({
          title: 'Error',
          description: json.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Error de red',
        description: e.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Abogados del Portal</CardTitle>
          <Button size="sm" onClick={() => setModalCrear(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuevo Abogado
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : abogados.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No hay abogados registrados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abogados.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">{a.cedula}</TableCell>
                  <TableCell>
                    {a.activo ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                        <CheckCircle className="w-3 h-3 mr-1" /> Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/15 text-red-700 border-red-300">
                        <XCircle className="w-3 h-3 mr-1" /> Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.ultimoAcceso ? formatearFechaHora(a.ultimoAcceso) : 'Nunca'}
                  </TableCell>
                  <TableCell className="text-xs">{formatearFecha(a.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActivo(a)}
                    >
                      {a.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Abogado</DialogTitle>
          </DialogHeader>
          <form onSubmit={crearAbogado} className="space-y-3">
            <div className="space-y-2">
              <Label>Cédula *</Label>
              <Input
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Clave inicial *</Label>
              <Input
                type="password"
                value={form.clave}
                onChange={(e) => setForm({ ...form, clave: e.target.value })}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                La clave se guarda con bcrypt (12 rounds). El abogado podrá cambiarla luego.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalCrear(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creando}>
                {creando ? 'Guardando...' : 'Crear Abogado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
