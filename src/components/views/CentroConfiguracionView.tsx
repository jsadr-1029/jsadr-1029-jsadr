'use client'

// =====================================================
// CentroConfiguracionView v3.6 — Jsadr
// 14 pestañas:
//   Empresa | Dominios | Correos | SMTP | Integraciones | Variables |
//   Ambientes | SSL | Almacenamiento | Estado Sistema | Mantenimiento |
//   Backups | Auditoría | Versiones
// =====================================================

import { useEffect, useState, useCallback } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import {
  Settings,
  Building2,
  Globe,
  Mail,
  Server,
  Plug,
  Variable,
  Layers,
  Lock,
  HardDrive,
  Activity,
  Wrench,
  Database,
  History,
  GitBranch,
  Plus,
  Edit,
  Trash2,
  Save,
  TestTube2,
  Download,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  FileArchive,
  RefreshCw,
  Loader2,
  FileCode,
  Clock,
  BookOpen,
  Info,
  AlertCircle,
  Send,
  ShieldCheck,
  Bot,
  Eye,
} from 'lucide-react'
import { SnapshotsProyectoView } from '@/components/views/SnapshotsProyectoView'
import { BotIcons } from '@/components/views/BotIcons'
import { HubIAPanel } from '@/components/views/hub-ia/HubIAPanel'
import { EliminarConfirmacionDialog } from '@/components/views/EliminarConfirmacionDialog'

const API = '/api/configuracion-global'

// === TIPOS GLOBALES ===
interface Empresa {
  id: string
  nombre: string
  razonSocial: string | null
  nit: string | null
  direccion: string | null
  ciudad: string | null
  pais: string
  telefono: string | null
  emailPrincipal: string | null
  sitioWeb: string | null
  colorPrimario: string
  colorSecundario: string
  idioma: string
  zonaHoraria: string
  moneda: string
}

interface Dominio {
  id: string
  nombre: string
  url: string
  tipo: string
  estado: string
  ambiente: string
  sslValido: boolean
  sslVence: string | null
  ultimoCheck: string | null
  usuarioResp: string | null
}

interface Correo {
  id: string
  nombre: string
  email: string
  tipo: string
  responsable: string | null
  estado: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpPassBackup?: string | null
  ssl: boolean
  tls: boolean
  starttls: boolean
  esPrincipal: boolean
  esRespaldo: boolean
  esNoReply: boolean
  aliasRemitente: string | null
  nombreRemitente: string | null
  ultimoTest: string | null
  ultimoTestOk: boolean | null
}

interface Integracion {
  id: string
  nombre: string
  proveedor: string
  endpoint: string | null
  apiKey: string | null
  apiSecret: string | null
  metodoAuth: string
  estado: string
  timeout: number
  reintentos: number
  ambiente: string
  observaciones: string | null
  ultimoCheck: string | null
  ultimoCheckOk: boolean | null
}

interface Variable {
  id: string
  clave: string
  valor: string
  tipo: string
  descripcion: string | null
  categoria: string
  editable: boolean
}

interface Ambiente {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  configJson: string | null
}

interface CertificadoSSL {
  id: string
  dominio: string
  fechaEmision: string | null
  fechaVencimiento: string | null
  estado: string
  emisor: string | null
  diasRestantes: number | null
  alertaEnviada: boolean
}

interface Almacenamiento {
  id: string
  proveedor: string
  bucket: string | null
  region: string | null
  accessKey: string | null
  secretKey: string | null
  endpoint: string | null
  activo: boolean
  rutaDocumentos: string
  rutaFotos: string
  rutaContratos: string
  rutaFirmas: string
  rutaHistoriales: string
  rutaPortalCliente: string
}

interface Servicio {
  id: string
  servicio: string
  estado: string
  ultimoCheck: string
  detalle: string | null
  latenciaMs: number | null
}

interface Mantenimiento {
  id: string
  activo: boolean
  mensaje: string
  inicio: string | null
  fin: string | null
  permitirAdmin: boolean
}

interface Version {
  id: string
  numero: number
  seccion: string
  descripcion: string | null
  configJson: string
  usuarioId: string | null
  usuarioNombre: string | null
  ipOrigen: string | null
  userAgent: string | null
  motivo: string | null
  createdAt: string
}

interface Auditoria {
  id: string
  seccion: string
  campo: string
  valorAnterior: string | null
  valorNuevo: string | null
  usuarioId: string | null
  usuarioNombre: string | null
  ipOrigen: string | null
  motivo: string | null
  createdAt: string
}

// === COMPONENTE PRINCIPAL ===
export function CentroConfiguracionView() {
  const [tab, setTab] = useState('empresa')

  const TABS = [
    { value: 'empresa', label: 'Empresa', icon: Building2 },
    { value: 'dominios', label: 'Dominios', icon: Globe },
    { value: 'correos', label: 'Correos', icon: Mail },
    { value: 'smtp', label: 'SMTP', icon: Server },
    { value: 'integraciones', label: 'Integraciones', icon: Plug },
    { value: 'variables', label: 'Variables', icon: Variable },
    { value: 'ambientes', label: 'Ambientes', icon: Layers },
    { value: 'ssl', label: 'SSL', icon: Lock },
    { value: 'almacenamiento', label: 'Almacenamiento', icon: HardDrive },
    { value: 'estado', label: 'Estado Sistema', icon: Activity },
    { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
    { value: 'backups', label: 'Backups', icon: Database },
    { value: 'auditoria', label: 'Auditoría', icon: History },
    { value: 'versiones', label: 'Versiones', icon: GitBranch },
    { value: 'snapshots', label: 'Snapshots', icon: GitBranch },
    { value: 'codigo-fuente', label: 'Código Fuente', icon: Package },
    { value: 'asistente-ia', label: 'Asistente IA', icon: Bot },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Configuración"
        subtitle="Configuración global, integraciones, seguridad y estado del sistema"
        icon={<Settings className="w-5 h-5" />}
      />

      <BotIcons modulo="configuracion" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-8 lg:grid-cols-17 w-full h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex flex-col items-center gap-1 py-2 text-xs">
              <t.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{t.label}</span>
              <span className="lg:hidden">{t.label.slice(0, 4)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="empresa"><EmpresaPanel /></TabsContent>
        <TabsContent value="dominios"><DominiosPanel /></TabsContent>
        <TabsContent value="correos"><CorreosPanel /></TabsContent>
        <TabsContent value="smtp"><SMTPPanel /></TabsContent>
        <TabsContent value="integraciones"><IntegracionesPanel /></TabsContent>
        <TabsContent value="variables"><VariablesPanel /></TabsContent>
        <TabsContent value="ambientes"><AmbientesPanel /></TabsContent>
        <TabsContent value="ssl"><SSLPanel /></TabsContent>
        <TabsContent value="almacenamiento"><AlmacenamientoPanel /></TabsContent>
        <TabsContent value="estado"><EstadoPanel /></TabsContent>
        <TabsContent value="mantenimiento"><MantenimientoPanel /></TabsContent>
        <TabsContent value="backups"><BackupsPanel /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaPanel /></TabsContent>
        <TabsContent value="versiones"><VersionesPanel /></TabsContent>
        <TabsContent value="snapshots"><SnapshotsProyectoView /></TabsContent>
        <TabsContent value="codigo-fuente"><CodigoFuentePanel /></TabsContent>
        <TabsContent value="asistente-ia"><HubIAPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

// === HELPERS ===
async function patchSeccion(seccion: string, data: Record<string, unknown>, motivo?: string) {
  const res = await fetch(API, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seccion, data, motivo }),
  })
  return res.json()
}

async function postAccion(accion: string, payload: Record<string, unknown>) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, payload }),
  })
  return res.json()
}

// === 1. EMPRESA ===
function EmpresaPanel() {
  const [data, setData] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=empresa`)
    const json = await res.json()
    if (json.success) setData(json.data.empresa)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!data) return
    setSaving(true)
    const json = await patchSeccion('empresa', data as unknown as Record<string, unknown>, 'Actualización datos empresa')
    if (json.success) toast({ title: 'Empresa actualizada' })
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    setSaving(false)
  }

  if (loading || !data) return <div className="text-muted-foreground p-4">Cargando…</div>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Datos de la Empresa</CardTitle>
        <Button onClick={guardar} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
        <Field label="Razón Social" value={data.razonSocial || ''} onChange={(v) => setData({ ...data, razonSocial: v })} />
        <Field label="NIT" value={data.nit || ''} onChange={(v) => setData({ ...data, nit: v })} />
        <Field label="Teléfono" value={data.telefono || ''} onChange={(v) => setData({ ...data, telefono: v })} />
        <Field label="Email Principal" value={data.emailPrincipal || ''} onChange={(v) => setData({ ...data, emailPrincipal: v })} />
        <Field label="Sitio Web" value={data.sitioWeb || ''} onChange={(v) => setData({ ...data, sitioWeb: v })} />
        <Field label="Dirección" value={data.direccion || ''} onChange={(v) => setData({ ...data, direccion: v })} />
        <Field label="Ciudad" value={data.ciudad || ''} onChange={(v) => setData({ ...data, ciudad: v })} />
        <Field label="País" value={data.pais} onChange={(v) => setData({ ...data, pais: v })} />
        <Field label="Moneda" value={data.moneda} onChange={(v) => setData({ ...data, moneda: v })} />
        <Field label="Idioma" value={data.idioma} onChange={(v) => setData({ ...data, idioma: v })} />
        <Field label="Zona Horaria" value={data.zonaHoraria} onChange={(v) => setData({ ...data, zonaHoraria: v })} />
        <Field label="Color Primario" value={data.colorPrimario} onChange={(v) => setData({ ...data, colorPrimario: v })} />
        <Field label="Color Secundario" value={data.colorSecundario} onChange={(v) => setData({ ...data, colorSecundario: v })} />
      </CardContent>
    </Card>
  )
}

// === 2. DOMINIOS (CRUD + GUÍA) ===
function DominiosPanel() {
  const [items, setItems] = useState<Dominio[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Dominio | null>(null)
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  // === Refuerzo eliminación ===
  const [pendienteEliminar, setPendienteEliminar] = useState<{ id: string; tipo: string; nombre: string; detalle?: string } | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    url: '',
    tipo: 'principal',
    estado: 'activo',
    ambiente: 'produccion',
    usuarioResp: '',
  })
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=dominios`)
    const json = await res.json()
    if (json.success) setItems(json.data.dominios)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      nombre: '',
      url: '',
      tipo: 'principal',
      estado: 'activo',
      ambiente: 'produccion',
      usuarioResp: '',
    })
    setModal(true)
  }
  const abrirEditar = (d: Dominio) => {
    setEditando(d)
    setForm({
      nombre: d.nombre,
      url: d.url,
      tipo: d.tipo,
      estado: d.estado,
      ambiente: d.ambiente,
      usuarioResp: d.usuarioResp || '',
    })
    setModal(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validar URL
    if (form.url && !/^https?:\/\//i.test(form.url)) {
      toast({
        title: 'URL inválida',
        description: 'La URL debe comenzar con http:// o https://',
        variant: 'destructive',
      })
      return
    }
    if (editando) {
      const json = await patchSeccion('dominios', { id: editando.id, ...form })
      if (json.success) toast({ title: 'Dominio actualizado' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    } else {
      const json = await postAccion('crear_dominio', form)
      if (json.success) toast({ title: 'Dominio creado' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setModal(false)
    cargar()
  }

  const eliminar = async (id: string) => {
    // Refuerzo: el botón "Eliminar" abre el modal que pide la clave maestra "Eliminar"
    const dominio = items.find((d) => d.id === id)
    setPendienteEliminar({
      id,
      tipo: 'dominio',
      nombre: dominio?.nombre || id,
      detalle: dominio?.url,
    })
  }

  const confirmarEliminar = async () => {
    if (!pendienteEliminar) return
    setEliminando(true)
    const json = await postAccion('eliminar_dominio', { id: pendienteEliminar.id, clave: 'Eliminar' })
    setEliminando(false)
    if (json.success) {
      toast({ title: 'Dominio eliminado', description: pendienteEliminar.nombre })
      setPendienteEliminar(null)
      cargar()
    } else {
      toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
    }
  }

  const testear = async (id: string) => {
    const json = await postAccion('test_dominio', { id })
    if (json.success) {
      toast({
        title: json.data.ok ? 'Test OK' : 'Test falló',
        description: json.data.mensaje,
        variant: json.data.ok ? 'default' : 'destructive',
      })
      cargar()
    }
  }

  const copiarAlPortapapeles = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast({ title: 'Copiado', description: 'Texto copiado al portapapeles' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* === Tarjeta de Gestión de Dominios === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" /> Dominios
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => setGuiaAbierta((v) => !v)} size="sm" variant="outline">
              <BookOpen className="w-4 h-4 mr-1" /> {guiaAbierta ? 'Ocultar guía' : 'Ver guía'}
            </Button>
            <Button onClick={abrirNuevo} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nuevo dominio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium">Aún no tienes dominios configurados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pulsa <span className="font-medium">Nuevo dominio</span> para conectar el tuyo,
                o <span className="font-medium">Ver guía</span> para seguir el paso a paso.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>SSL</TableHead>
                  <TableHead>Últ. check</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.nombre}
                      {d.usuarioResp && (
                        <p className="text-[10px] text-muted-foreground">Resp: {d.usuarioResp}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline font-mono"
                      >
                        {d.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <EstadoServicioBadge estado={d.estado} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{d.ambiente}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.sslValido ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle className="w-4 h-4" /> Válido
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs">
                          <XCircle className="w-4 h-4" /> Sin SSL
                        </span>
                      )}
                      {d.sslVence && (
                        <p className="text-[10px] text-muted-foreground">
                          Vence: {new Date(d.sslVence).toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.ultimoCheck
                        ? new Date(d.ultimoCheck).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => testear(d.id)} title="Probar dominio">
                          <TestTube2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(d)} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminar(d.id)} title="Eliminar">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <Dialog open={modal} onOpenChange={setModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar Dominio' : 'Conectar nuevo dominio'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={guardar} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Field
                    label="Nombre identificador"
                    value={form.nombre}
                    onChange={(v) => setForm({ ...form, nombre: v })}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ej: <code>Jsadr Producción</code> · Solo para uso interno.
                  </p>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Field
                    label="URL completa del dominio"
                    value={form.url}
                    onChange={(v) => setForm({ ...form, url: v })}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Debe incluir <code>https://</code>. Ej: <code>https://jsadr.com.co</code>
                  </p>
                </div>

                <SelectField
                  label="Tipo de dominio"
                  value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v })}
                  options={['principal', 'secundario', 'redirect', 'subdominio']}
                />
                <SelectField
                  label="Estado"
                  value={form.estado}
                  onChange={(v) => setForm({ ...form, estado: v })}
                  options={['activo', 'inactivo', 'redireccion']}
                />
                <SelectField
                  label="Ambiente"
                  value={form.ambiente}
                  onChange={(v) => setForm({ ...form, ambiente: v })}
                  options={['produccion', 'staging', 'desarrollo']}
                />
                <Field
                  label="Usuario responsable"
                  value={form.usuarioResp}
                  onChange={(v) => setForm({ ...form, usuarioResp: v })}
                />
              </div>

              <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-semibold flex items-center gap-1 mb-1">
                  <Info className="w-3.5 h-3.5" /> Importante
                </p>
                <p>
                  Guardar el dominio aquí <strong>solo lo registra en la plataforma</strong>.
                  Para que el dominio apunte realmente a esta aplicación, debes configurar
                  los DNS en tu proveedor (Cloudflare, GoDaddy, Hostinger, etc.).
                  Sigue la guía «Conectar un dominio» abajo.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  {editando ? 'Guardar cambios' : 'Conectar dominio'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Card>

      {/* === Guía integrada para conectar/cambiar dominio === */}
      {guiaAbierta && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-primary" />
              Guía: Conectar y cambiar tu dominio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            {/* Pasos para conectar */}
            <div>
              <h4 className="font-semibold mb-2">A. Conectar un dominio nuevo</h4>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Compra el dominio</strong> en un
                  registrador (GoDaddy, Namecheap, Hostinger, Google Domains, etc.).
                  Ej: <code className="bg-muted px-1 rounded">jsadr.com.co</code>.
                </li>
                <li>
                  <strong className="text-foreground">Apunta el DNS al hosting/plataforma</strong>.
                  Entra al panel de tu registrador y agrega uno de estos registros:
                  <div className="mt-2 ml-6 space-y-2">
                    <div className="rounded-md border bg-muted/40 p-2 text-xs">
                      <p className="font-semibold text-foreground mb-1">Opción 1 — Registro A (recomendado)</p>
                      <p>Tipo: <code className="bg-background px-1 rounded">A</code></p>
                      <p>Nombre/Host: <code className="bg-background px-1 rounded">@</code></p>
                      <p>Valor: <code className="bg-background px-1 rounded">21.0.18.219</code> (IP del servidor)</p>
                      <p>TTL: Automático (o 3600s)</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 mt-1 text-[11px] px-2"
                        onClick={() => copiarAlPortapapeles('21.0.18.219')}
                      >
                        Copiar IP
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/40 p-2 text-xs">
                      <p className="font-semibold text-foreground mb-1">Opción 2 — Registro CNAME (para subdominios)</p>
                      <p>Tipo: <code className="bg-background px-1 rounded">CNAME</code></p>
                      <p>Nombre/Host: <code className="bg-background px-1 rounded">app</code> (o el subdominio)</p>
                      <p>Valor: <code className="bg-background px-1 rounded">preview-SPACE-Z-AI.cloudspace.dev.</code> (con punto final)</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 mt-1 text-[11px] px-2"
                        onClick={() => copiarAlPortapapeles('preview-SPACE-Z-AI.cloudspace.dev.')}
                      >
                        Copiar CNAME
                      </Button>
                    </div>
                  </div>
                </li>
                <li>
                  <strong className="text-foreground">Espera la propagación DNS</strong>.
                  Puede tardar entre 5 minutos y 24 horas. Verifica con{' '}
                  <code className="bg-muted px-1 rounded">dig jsadr.com.co</code> o en{' '}
                  <a
                    href="https://dnschecker.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    dnschecker.org
                  </a>
                  .
                </li>
                <li>
                  <strong className="text-foreground">Configura el certificado SSL</strong>.
                  Si tu hosting no lo provisiona automáticamente (Let&apos;s Encrypt), solicita
                  el SSL en el panel del hosting o usa Cloudflare en modo &quot;Full SSL&quot;.
                </li>
                <li>
                  <strong className="text-foreground">Registra el dominio aquí</strong>:
                  pulsa <span className="font-medium">&quot;Nuevo dominio&quot;</span> arriba,
                  completa el formulario (URL con <code>https://</code>) y guarda.
                </li>
                <li>
                  <strong className="text-foreground">Prueba la conexión</strong> con el botón{' '}
                  <TestTube2 className="inline w-3 h-3" /> &quot;Test&quot; en la tabla. Debe
                  mostrar <span className="text-emerald-600 font-medium">SSL Válido</span>.
                </li>
              </ol>
            </div>

            <hr className="border-border" />

            {/* Cambiar dominio */}
            <div>
              <h4 className="font-semibold mb-2">B. Cambiar el dominio por otro</h4>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Apunta el nuevo dominio</strong> al
                  servidor siguiendo los pasos A.1, A.2 y A.3 con el nuevo dominio.
                </li>
                <li>
                  <strong className="text-foreground">Registra el nuevo dominio</strong> aquí
                  con &quot;Nuevo dominio&quot; y déjalo en estado{' '}
                  <code className="bg-muted px-1 rounded">activo</code>.
                </li>
                <li>
                  <strong className="text-foreground">Cambia el dominio anterior</strong> a{' '}
                  <code className="bg-muted px-1 rounded">inactivo</code> o{' '}
                  <code className="bg-muted px-1 rounded">redireccion</code>:
                  pulsa el botón <Edit className="inline w-3 h-3" /> &quot;Editar&quot; en
                  la fila del dominio viejo y cambia el campo &quot;Estado&quot;.
                </li>
                <li>
                  <strong className="text-foreground">Configura un redirect 301</strong> en tu
                  hosting/proxy para que el dominio viejo redirija al nuevo (evita perder SEO).
                  En Cloudflare: <em>Rules &gt; Redirect Rules</em>. En nginx:{' '}
                  <code className="bg-muted px-1 rounded">return 301 https://nuevo-dominio.co$request_uri;</code>
                </li>
                <li>
                  <strong className="text-foreground">Actualiza el campo URL</strong> en el
                  dominio principal del sistema (en{' '}
                  <span className="font-medium">Configuración Global &gt; Empresa</span>) y
                  avisa a tus clientes la nueva URL.
                </li>
                <li>
                  <strong className="text-foreground">Verifica</strong>: prueba ambos dominios
                  con el botón Test. El nuevo debe estar &quot;SSL Válido&quot;, el viejo
                  puede mostrar &quot;Sin SSL&quot; si ya no lo tiene.
                </li>
              </ol>
            </div>

            <hr className="border-border" />

            {/* Notas adicionales */}
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
              <p className="font-semibold flex items-center gap-1 mb-1 text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" /> Notas importantes
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  El registro aquí es <strong>solo informativo</strong> para la plataforma;
                  el apuntado real del dominio depende de la configuración DNS en tu
                  proveedor.
                </li>
                <li>
                  Si usas <strong>Cloudflare</strong>, activa el modo &quot;Full SSL&quot;
                  (no &quot;Flexible&quot;) para evitar redirecciones infinitas.
                </li>
                <li>
                  Los certificados SSL caducan cada 90 días (Let&apos;s Encrypt). Configura
                  auto-renovación o usa Cloudflare que gestiona el edge certificate.
                </li>
                <li>
                  Si el botón &quot;Test&quot; muestra &quot;URL inválida&quot;, revisa que
                  la URL comience con <code>https://</code> y no tenga espacios.
                </li>
                <li>
                  Si el dominio no carga tras 24h, contacta al proveedor de DNS o revisa
                  el firewall del servidor (puerto 80/443 abierto).
                </li>
              </ul>
            </div>

            {/* Plantilla para el archivo hosts local */}
            <div>
              <h4 className="font-semibold mb-2">C. (Opcional) Probar localmente antes de DNS</h4>
              <p className="text-muted-foreground text-xs mb-2">
                Si quieres probar el dominio antes de propagar el DNS, edita tu archivo{' '}
                <code className="bg-muted px-1 rounded">
                  /etc/hosts
                </code>{' '}
                (Linux/Mac) o{' '}
                <code className="bg-muted px-1 rounded">C:\Windows\System32\drivers\etc\hosts</code>{' '}
                (Windows) como administrador y agrega:
              </p>
              <div className="rounded-md bg-slate-950 text-slate-100 p-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span>21.0.18.219  jsadr.com.co</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] px-2 text-slate-300"
                    onClick={() => copiarAlPortapapeles('21.0.18.219  jsadr.com.co')}
                  >
                    Copiar
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span>21.0.18.219  www.jsadr.com.co</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] px-2 text-slate-300"
                    onClick={() => copiarAlPortapapeles('21.0.18.219  www.jsadr.com.co')}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Borra estas líneas cuando termines de probar para no interferir con el DNS real.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Modal de confirmación reforzada para eliminación === */}
      <EliminarConfirmacionDialog
        open={pendienteEliminar !== null}
        onClose={() => { if (!eliminando) setPendienteEliminar(null) }}
        onConfirm={confirmarEliminar}
        recursoTipo="dominio"
        recursoNombre={pendienteEliminar?.nombre || ''}
        recursoDetalle={pendienteEliminar?.detalle}
        cargando={eliminando}
      />
    </div>
  )
}

// === 3. CORREOS (CRUD + Compositor + Enviados) ===
function CorreosPanel() {
  const [items, setItems] = useState<Correo[]>([])
  const [envios, setEnvios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalComposer, setModalComposer] = useState(false)
  const [modalEnviados, setModalEnviados] = useState(false)
  const [editando, setEditando] = useState<Correo | null>(null)
  // === Refuerzo eliminación ===
  const [pendienteEliminar, setPendienteEliminar] = useState<{ id: string; nombre: string; detalle?: string } | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [form, setForm] = useState<Partial<Correo>>({})
  const [composer, setComposer] = useState<{
    correoInstitucionalId: string
    destinatario: string
    asunto: string
    cuerpo: string
    formato: 'texto' | 'html'
  }>({
    correoInstitucionalId: '',
    destinatario: '',
    asunto: '',
    cuerpo: '',
    formato: 'texto',
  })
  const [enviando, setEnviando] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=correos`)
    const json = await res.json()
    if (json.success) setItems(json.data.correos)
    setLoading(false)
  }, [])

  const cargarEnvios = useCallback(async () => {
    try {
      const res = await fetch(`${API}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'correos_enviados' }),
      })
      const json = await res.json()
      if (json.success) setEnvios(json.data.envios)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      nombre: '',
      email: '',
      tipo: 'principal',
      estado: 'activo',
      responsable: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      ssl: true,
      tls: true,
    })
    setModal(true)
  }
  const abrirEditar = (c: Correo) => {
    setEditando(c)
    setForm({ ...c })
    setModal(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editando) {
      const json = await patchSeccion('correos', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Correo actualizado' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    } else {
      const json = await postAccion('crear_correo', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Correo creado' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setModal(false)
    cargar()
  }

  const eliminar = async (id: string) => {
    // Refuerzo: el botón "Eliminar" abre el modal que pide la clave maestra "Eliminar"
    const correo = items.find((c) => c.id === id)
    setPendienteEliminar({
      id,
      nombre: correo?.email || id,
      detalle: correo
        ? `${correo.smtpHost || '—'}:${correo.smtpPort || '—'} · ${correo.esPrincipal ? 'PRINCIPAL' : 'Secundario'}`
        : undefined,
    })
  }

  const confirmarEliminar = async () => {
    if (!pendienteEliminar) return
    setEliminando(true)
    const json = await postAccion('eliminar_correo', { id: pendienteEliminar.id, clave: 'Eliminar' })
    setEliminando(false)
    if (json.success) {
      toast({ title: 'Correo eliminado', description: pendienteEliminar.nombre })
      setPendienteEliminar(null)
      cargar()
    } else {
      toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
    }
  }

  const establecerPrincipal = async (c: Correo) => {
    if (!confirm(`¿Establecer ${c.email} como correo PRINCIPAL?`)) return
    // Quitar principal a todos
    for (const it of items) {
      if (it.esPrincipal && it.id !== c.id) {
        await patchSeccion('correos', { id: it.id, esPrincipal: false })
      }
    }
    // Establecer este como principal
    const json = await patchSeccion('correos', { id: c.id, esPrincipal: true, estado: 'activo' })
    if (json.success) {
      toast({ title: 'Correo principal actualizado', description: c.email })
      cargar()
    } else {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
  }

  const abrirComposer = (c?: Correo) => {
    const principal = items.find((x) => x.esPrincipal) || items[0]
    setComposer({
      correoInstitucionalId: c?.id || principal?.id || '',
      destinatario: '',
      asunto: '',
      cuerpo: '',
      formato: 'texto',
    })
    setModalComposer(true)
  }

  const enviarCorreo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composer.destinatario || !composer.asunto || !composer.cuerpo) {
      toast({ title: 'Faltan campos', description: 'Destinatario, asunto y cuerpo son obligatorios', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      const json = await postAccion('enviar_correo', composer)
      if (json.success) {
        toast({
          title: 'Correo enviado',
          description: json.data?.mensaje || `Enviado a ${composer.destinatario}`,
        })
        setModalComposer(false)
        cargarEnvios()
      } else {
        toast({
          title: 'No se pudo enviar',
          description: json.error || json.data?.mensaje,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const verEnviados = async () => {
    await cargarEnvios()
    setModalEnviados(true)
  }

  const eliminarEnvio = async (id: string) => {
    const json = await postAccion('eliminar_envio_correo', { id })
    if (json.success) {
      toast({ title: 'Registro eliminado' })
      cargarEnvios()
    }
  }

  // === Estado resumen del correo principal ===
  const correoPrincipal = items.find((c) => c.esPrincipal)

  return (
    <div className="space-y-4">
      {/* === Tarjeta principal === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Correos Institucionales
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={verEnviados} size="sm" variant="outline">
              <Clock className="w-4 h-4 mr-1" /> Enviados
            </Button>
            <Button
              onClick={() => abrirComposer()}
              size="sm"
              disabled={items.length === 0}
            >
              <Send className="w-4 h-4 mr-1" /> Enviar correo
            </Button>
            <Button onClick={abrirNuevo} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Banner del correo principal */}
          {correoPrincipal && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="text-[10px]">PRINCIPAL</Badge>
                    <span className="font-semibold text-sm">{correoPrincipal.nombre}</span>
                  </div>
                  <p className="text-sm font-mono">{correoPrincipal.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    SMTP: {correoPrincipal.smtpHost || '—'}:{correoPrincipal.smtpPort || '—'} ·{' '}
                    {correoPrincipal.ssl ? 'SSL' : 'TLS'}
                    {correoPrincipal.smtpPass
                      ? ' · Credenciales: OK'
                      : ' · ⚠ Falta configurar contraseña SMTP'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => abrirComposer(correoPrincipal)}
                  disabled={!correoPrincipal.smtpPass}
                >
                  <Send className="w-4 h-4 mr-1" /> Enviar desde aquí
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium">No hay correos configurados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pulsa <span className="font-medium">Nuevo</span> para configurar tu primer correo.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>SMTP</TableHead>
                  <TableHead>Último Test</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className={c.esPrincipal ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">
                      {c.nombre}
                      {c.esPrincipal && (
                        <Badge className="ml-2 text-[10px]" variant="default">PRINCIPAL</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{c.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <EstadoServicioBadge estado={c.estado} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.smtpHost || '—'}:{c.smtpPort}
                      {c.smtpPass ? (
                        <span className="text-emerald-600 ml-1">✓</span>
                      ) : (
                        <span className="text-red-500 ml-1" title="Sin contraseña">✗</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.ultimoTestOk === null ? (
                        <span className="text-xs text-muted-foreground">Sin test</span>
                      ) : c.ultimoTestOk ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirComposer(c)}
                          title="Enviar correo desde esta cuenta"
                          disabled={!c.smtpPass}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        {!c.esPrincipal && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => establecerPrincipal(c)}
                            title="Establecer como principal"
                          >
                            <CheckCircle className="w-4 h-4 text-amber-500" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminar(c.id)} title="Eliminar">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* === Modal editar/crear correo === */}
        <Dialog open={modal} onOpenChange={setModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar Correo' : 'Nuevo Correo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={form.nombre || ''} onChange={(v) => setForm({ ...form, nombre: v })} required />
              <Field label="Email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} required />
              <SelectField label="Tipo" value={form.tipo || 'principal'} onChange={(v) => setForm({ ...form, tipo: v })} options={['principal', 'ventas', 'soporte', 'admin', 'noreply']} />
              <Field label="Responsable" value={form.responsable || ''} onChange={(v) => setForm({ ...form, responsable: v })} />
              <Field label="SMTP Host" value={form.smtpHost || ''} onChange={(v) => setForm({ ...form, smtpHost: v })} placeholder="smtp.hostinger.com" />
              <Field label="SMTP Puerto" type="number" value={String(form.smtpPort ?? 587)} onChange={(v) => setForm({ ...form, smtpPort: Number(v) })} />
              <Field label="SMTP User" value={form.smtpUser || ''} onChange={(v) => setForm({ ...form, smtpUser: v })} placeholder="jsa@jsadr.com.co" />
              <Field
                label="SMTP Pass"
                value={form.smtpPass && form.smtpPass !== '********' ? form.smtpPass : ''}
                onChange={(v) => setForm({ ...form, smtpPass: v })}
                placeholder={editando?.smtpPass ? '•••••• (dejar vacío para mantener)' : 'Contraseña del correo'}
              />
              <Field
                label="Nombre del remitente"
                value={form.nombreRemitente || ''}
                onChange={(v) => setForm({ ...form, nombreRemitente: v })}
                placeholder="Jsadr"
              />
              <Field
                label="Alias del remitente"
                value={form.aliasRemitente || ''}
                onChange={(v) => setForm({ ...form, aliasRemitente: v })}
                placeholder="jsa"
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ssl ?? false}
                  onCheckedChange={(v) => setForm({ ...form, ssl: v, tls: !v, smtpPort: v ? 465 : (form.smtpPort || 587) })}
                /> <Label>SSL (puerto 465) {form.ssl ? '✓' : ''}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.tls ?? true}
                  onCheckedChange={(v) => setForm({ ...form, tls: v, ssl: !v, smtpPort: v ? 587 : (form.smtpPort || 465) })}
                /> <Label>TLS / STARTTLS (puerto 587) {form.tls ? '✓' : ''}</Label>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={form.esPrincipal ?? false}
                  onCheckedChange={(v) => setForm({ ...form, esPrincipal: v })}
                />
                <Label>Establecer como correo principal</Label>
              </div>
              <div className="col-span-2 rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-semibold flex items-center gap-1 mb-1">
                  <Info className="w-3.5 h-3.5" /> Configuración SMTP común
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Hostinger</strong>: smtp.hostinger.com · puerto 465 (SSL) o 587 (TLS)</li>
                  <li><strong>Gmail</strong>: smtp.gmail.com · puerto 465 (SSL) — usa contraseña de aplicación</li>
                  <li><strong>Outlook/Hotmail</strong>: smtp.office365.com · puerto 587 (TLS)</li>
                  <li><strong>Zoho</strong>: smtp.zoho.com · puerto 465 (SSL)</li>
                </ul>
              </div>
              <div className="col-span-2 flex justify-end pt-2">
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" /> Guardar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* === Modal Compositor === */}
        <Dialog open={modalComposer} onOpenChange={setModalComposer}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Componer y enviar correo
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={enviarCorreo} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Cuenta remitente</Label>
                <Select
                  value={composer.correoInstitucionalId}
                  onValueChange={(v) => setComposer({ ...composer, correoInstitucionalId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el correo remitente" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled={!c.smtpPass}>
                        {c.email}
                        {c.esPrincipal ? ' (principal)' : ''}
                        {!c.smtpPass ? ' · ⚠ sin SMTP' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Para (destinatario)</Label>
                <Input
                  type="email"
                  value={composer.destinatario}
                  onChange={(e) => setComposer({ ...composer, destinatario: e.target.value })}
                  placeholder="cliente@ejemplo.com  (separa varios con coma)"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Asunto</Label>
                <Input
                  type="text"
                  value={composer.asunto}
                  onChange={(e) => setComposer({ ...composer, asunto: e.target.value })}
                  placeholder="Asunto del correo"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Mensaje</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Formato:</span>
                    <Select
                      value={composer.formato}
                      onValueChange={(v) => setComposer({ ...composer, formato: v as 'texto' | 'html' })}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="texto">Texto plano</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  value={composer.cuerpo}
                  onChange={(e) => setComposer({ ...composer, cuerpo: e.target.value })}
                  placeholder={composer.formato === 'html' ? '<h1>Hola</h1><p>Contenido...</p>' : 'Escribe el mensaje aquí...'}
                  rows={10}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-800 dark:text-amber-200">
                <p className="flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Permiso de envío:
                </p>
                <p className="mt-1 ml-5">
                  Cada envío queda registrado en la bitácora con remitente, destinatario, asunto y estado.
                  Solo se pueden enviar correos desde cuentas con SMTP completamente configurado
                  (host, puerto, usuario y contraseña).
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalComposer(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviando}>
                  {enviando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" /> Enviar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* === Modal Enviados === */}
        <Dialog open={modalEnviados} onOpenChange={setModalEnviados}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Correos enviados (últimos 100)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {envios.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aún no has enviado correos desde el panel.
                </p>
              ) : (
                envios.map((env) => (
                  <div
                    key={env.id}
                    className="rounded-md border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={env.estado === 'ENVIADO' ? 'default' : 'destructive'}
                            className="text-[10px]"
                          >
                            {env.estado}
                          </Badge>
                          <span className="text-sm font-semibold truncate">{env.asunto}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <strong>De:</strong> {env.remitenteEmail} → <strong>Para:</strong>{' '}
                          {env.destinatario}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {env.fechaEnvio
                            ? new Date(env.fechaEnvio).toLocaleString('es-CO')
                            : new Date(env.createdAt).toLocaleString('es-CO')}
                          {env.enviadoPorNombre ? ` · por ${env.enviadoPorNombre}` : ''}
                        </p>
                        {env.mensajeError && (
                          <p className="text-xs text-red-500 mt-1">⚠ {env.mensajeError}</p>
                        )}
                        <details className="mt-1">
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                            Ver mensaje
                          </summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded whitespace-pre-wrap font-mono">
                            {env.cuerpo.slice(0, 500)}
                            {env.cuerpo.length > 500 ? '...' : ''}
                          </pre>
                        </details>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => eliminarEnvio(env.id)}
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalEnviados(false)}>Cerrar</Button>
              <Button variant="outline" onClick={cargarEnvios}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {/* === Modal de confirmación reforzada para eliminación === */}
      <EliminarConfirmacionDialog
        open={pendienteEliminar !== null}
        onClose={() => { if (!eliminando) setPendienteEliminar(null) }}
        onConfirm={confirmarEliminar}
        recursoTipo="correo institucional"
        recursoNombre={pendienteEliminar?.nombre || ''}
        recursoDetalle={pendienteEliminar?.detalle}
        cargando={eliminando}
      />
    </div>
  )
}

// === 4. SMTP (test) ===
function SMTPPanel() {
  const [items, setItems] = useState<Correo[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [editando, setEditando] = useState<Correo | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Correo>>({})
  const [guardando, setGuardando] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=smtp`)
    const json = await res.json()
    if (json.success) setItems(json.data.correos)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const testear = async (id: string) => {
    setTesting(id)
    const json = await postAccion('test_smtp', { id })
    if (json.success) {
      toast({
        title: json.data.ok ? 'Test SMTP OK' : 'Test SMTP falló',
        description: json.data.mensaje,
        variant: json.data.ok ? 'default' : 'destructive',
      })
      cargar()
    } else {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setTesting(null)
  }

  // === DISASTER RECOVERY: restaurar SMTP desde backup ===
  // Si .env pierde API_ENCRYPTION_KEY, las contraseñas SMTP en BD quedan indescifrables.
  // Este botón toma el smtpPassBackup (cifrado con llave hardcoded) y lo re-encripta
  // con la API_ENCRYPTION_KEY actual, sincronizando también conexionAPI.
  const restaurarDesdeBackup = async (id?: string) => {
    if (!confirm(
      '¿Restaurar la contraseña SMTP desde el backup?\n\n' +
      'Esto desencripta el backup (cifrado con llave hardcoded), ' +
      're-encripta con la API_ENCRYPTION_KEY actual, y sincroniza la tabla conexionAPI.\n\n' +
      'Útil cuando el .env pierde la API_ENCRYPTION_KEY y los correos dejaron de enviarse.'
    )) return
    setRestaurando(id || 'all')
    const json = await postAccion('restaurar_smtp_backup', id ? { id } : {})
    if (json.success) {
      toast({
        title: json.data.testOk ? '✅ SMTP restaurado y verificado' : '⚠️ SMTP restaurado (test falló)',
        description: `${json.data.email} → ${json.data.smtpHost}:${json.data.smtpPort}. ${json.data.testMensaje}`,
        variant: json.data.testOk ? 'default' : 'destructive',
      })
      cargar()
    } else {
      toast({
        title: 'No se pudo restaurar',
        description: json.error,
        variant: 'destructive',
      })
    }
    setRestaurando(null)
  }

  const abrirEditar = (c: Correo) => {
    setEditando(c)
    // Inicializar form con valores actuales; pass vacío para que usuario escriba nueva
    setForm({
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      smtpHost: c.smtpHost || '',
      smtpPort: c.smtpPort ?? 587,
      smtpUser: c.smtpUser || '',
      smtpPass: '', // siempre vacío al abrir — por seguridad
      ssl: c.ssl ?? true,
      tls: c.tls ?? true,
      nombreRemitente: c.nombreRemitente || '',
      aliasRemitente: c.aliasRemitente || '',
      esPrincipal: c.esPrincipal,
    })
    setModal(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setGuardando(true)

    // Construir payload: si smtpPass viene vacío, mandamos '********' para que el backend mantenga el actual
    const payload: Record<string, unknown> = {
      id: form.id,
      nombre: form.nombre,
      email: form.email,
      smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort) || 587,
      smtpUser: form.smtpUser,
      ssl: form.ssl ?? true,
      tls: form.tls ?? true,
      nombreRemitente: form.nombreRemitente,
      aliasRemitente: form.aliasRemitente,
      esPrincipal: form.esPrincipal,
    }
    // Si el usuario escribió una contraseña nueva, la mandamos; si no, mandamos '********' (mantener)
    if (form.smtpPass && form.smtpPass.trim() !== '') {
      payload.smtpPass = form.smtpPass
    } else {
      payload.smtpPass = '********'
    }

    const json = await patchSeccion('correos', payload)
    if (json.success) {
      toast({ title: 'SMTP actualizado', description: `Configuración guardada para ${form.email}` })
      setModal(false)
      cargar()
    } else {
      toast({ title: 'Error al guardar', description: json.error, variant: 'destructive' })
    }
    setGuardando(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" /> Configuración SMTP</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Edita host, puerto, usuario y contraseña SMTP de cada correo. La contraseña se guarda cifrada (AES-256). Si dejas el campo vacío al editar, se mantiene la contraseña actual.
        </p>
      </CardHeader>
      <CardContent>
        {/* === Banner de disaster recovery === */}
        {items.length > 0 && (
          <div className="mb-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Backup de credenciales SMTP (Disaster Recovery)
            </p>
            <p className="mt-1 ml-5">
              Cada vez que guardas una contraseña SMTP, se crea automáticamente un <strong>backup cifrado con una llave hardcoded</strong> en el código fuente
              (independiente del <code>.env</code>). Si el <code>.env</code> pierde <code>API_ENCRYPTION_KEY</code> y los correos dejan de enviarse,
              pulsa <strong>&quot;Restaurar desde backup&quot;</strong> para re-encriptar la contraseña con la llave actual y sincronizar <code>conexionAPI</code>.
            </p>
            <div className="mt-2 ml-5 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => restaurarDesdeBackup()}
                disabled={restaurando !== null}
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              >
                {restaurando === 'all' ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Restaurando…</>
                ) : (
                  <><RotateCcw className="w-4 h-4 mr-1" /> Restaurar correo principal desde backup</>
                )}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Solo restaura el correo principal activo. Para restaurar otro, usa el botón individual abajo.
              </span>
            </div>
          </div>
        )}

        {loading ? <p className="text-muted-foreground">Cargando…</p> : items.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm font-medium">No hay correos configurados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ve a la pestaña <strong>Correos</strong> y pulsa <strong>Nuevo</strong> para crear tu primer correo, luego vuelve aquí para configurar su SMTP.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {c.email}
                    {c.esPrincipal && <Badge className="text-[10px]">PRINCIPAL</Badge>}
                    {c.smtpPass ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-[10px]">SMTP OK</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[10px]">SMTP sin contraseña</Badge>
                    )}
                    {c.smtpPassBackup ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-500/40 text-[10px] flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Backup OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-600 border-rose-500/40 text-[10px]">Sin backup</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-mono">{c.smtpHost || '—'}:{c.smtpPort || '—'}</span> · {c.ssl ? 'SSL' : 'TLS'} · user: <span className="font-mono">{c.smtpUser || '—'}</span>
                  </div>
                  {c.ultimoTest && (
                    <div className="text-xs mt-1">
                      Último test: {formatearFechaHora(c.ultimoTest)} —{' '}
                      {c.ultimoTestOk ? <span className="text-emerald-400">OK</span> : <span className="text-red-400">Falló</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="default" onClick={() => abrirEditar(c)}>
                    <Edit className="w-4 h-4 mr-1" /> Editar SMTP
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => testear(c.id)} disabled={testing === c.id}>
                    <TestTube2 className="w-4 h-4 mr-1" /> {testing === c.id ? 'Testeando…' : 'Probar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restaurarDesdeBackup(c.id)}
                    disabled={!c.smtpPassBackup || restaurando !== null}
                    title={c.smtpPassBackup ? 'Restaurar contraseña SMTP desde el backup cifrado' : 'No hay backup guardado para este correo'}
                    className="border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10"
                  >
                    {restaurando === c.id ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /></>
                    ) : (
                      <><RotateCcw className="w-4 h-4 mr-1" /> Restaurar</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* === Modal editar SMTP === */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar configuración SMTP — {editando?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
            <Field label="Nombre" value={form.nombre || ''} onChange={(v) => setForm({ ...form, nombre: v })} required />
            <Field label="Email" value={form.email || ''} onChange={(v) => setForm({ ...form, email: v })} required />
            <Field label="SMTP Host" value={form.smtpHost || ''} onChange={(v) => setForm({ ...form, smtpHost: v })} placeholder="smtp.hostinger.com" required />
            <Field label="SMTP Puerto" type="number" value={String(form.smtpPort ?? 587)} onChange={(v) => setForm({ ...form, smtpPort: Number(v) })} required />
            <Field label="SMTP User" value={form.smtpUser || ''} onChange={(v) => setForm({ ...form, smtpUser: v })} placeholder="jsa@jsadr.com.co" required />
            <Field
              label="SMTP Pass"
              type="password"
              value={form.smtpPass || ''}
              onChange={(v) => setForm({ ...form, smtpPass: v })}
              placeholder={editando?.smtpPass ? '•••••• (dejar vacío para mantener actual)' : 'Contraseña del correo'}
            />
            <Field
              label="Nombre del remitente"
              value={form.nombreRemitente || ''}
              onChange={(v) => setForm({ ...form, nombreRemitente: v })}
              placeholder="Jsadr"
            />
            <Field
              label="Alias del remitente"
              value={form.aliasRemitente || ''}
              onChange={(v) => setForm({ ...form, aliasRemitente: v })}
              placeholder="jsa"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={form.ssl ?? false}
                onCheckedChange={(v) => setForm({ ...form, ssl: v, tls: !v, smtpPort: v ? 465 : (form.smtpPort || 587) })}
              /> <Label>SSL (puerto 465) {form.ssl ? '✓' : ''}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.tls ?? true}
                onCheckedChange={(v) => setForm({ ...form, tls: v, ssl: !v, smtpPort: v ? 587 : (form.smtpPort || 465) })}
              /> <Label>TLS / STARTTLS (puerto 587) {form.tls ? '✓' : ''}</Label>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={form.esPrincipal ?? false}
                onCheckedChange={(v) => setForm({ ...form, esPrincipal: v })}
              />
              <Label>Establecer como correo principal</Label>
            </div>
            <div className="col-span-2 rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-900 dark:text-blue-200">
              <p className="font-semibold flex items-center gap-1 mb-1">
                <Info className="w-3.5 h-3.5" /> Configuración SMTP común
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><strong>Hostinger</strong>: smtp.hostinger.com · puerto 465 (SSL) o 587 (TLS)</li>
                <li><strong>Gmail</strong>: smtp.gmail.com · puerto 465 (SSL) — usa contraseña de aplicación</li>
                <li><strong>Outlook/Hotmail</strong>: smtp.office365.com · puerto 587 (TLS)</li>
                <li><strong>Zoho</strong>: smtp.zoho.com · puerto 465 (SSL)</li>
              </ul>
            </div>
            <div className="col-span-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Sobre la contraseña SMTP
              </p>
              <p className="mt-1 ml-5">
                Si dejas el campo <strong>SMTP Pass</strong> vacío, se mantiene la contraseña actual (no se sobreescribe).
                Para cambiarla, escribe la nueva contraseña. Se guarda cifrada con AES-256.
              </p>
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// === 5. INTEGRACIONES (CRUD + test) ===
function IntegracionesPanel() {
  const [items, setItems] = useState<Integracion[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Integracion | null>(null)
  // === Refuerzo eliminación ===
  const [pendienteEliminar, setPendienteEliminar] = useState<{ id: string; nombre: string; detalle?: string } | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [form, setForm] = useState<Partial<Integracion>>({})
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=integraciones`)
    const json = await res.json()
    if (json.success) setItems(json.data.integraciones)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', proveedor: '', endpoint: '', apiKey: '', apiSecret: '', metodoAuth: 'bearer', estado: 'activa', timeout: 30, reintentos: 3, ambiente: 'produccion', observaciones: '' })
    setModal(true)
  }
  const abrirEditar = (i: Integracion) => { setEditando(i); setForm({ ...i }); setModal(true) }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editando) {
      const json = await patchSeccion('integraciones', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Integración actualizada' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    } else {
      const json = await postAccion('crear_integracion', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Integración creada' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setModal(false)
    cargar()
  }

  const eliminar = async (id: string) => {
    // Refuerzo: el botón "Eliminar" abre el modal que pide la clave maestra "Eliminar"
    const integ = items.find((i) => i.id === id)
    setPendienteEliminar({
      id,
      nombre: integ?.nombre || id,
      detalle: integ
        ? `Proveedor: ${integ.proveedor} · Auth: ${integ.metodoAuth} · Ambiente: ${integ.ambiente}${integ.apiKey ? ' · API key: ********' : ''}`
        : undefined,
    })
  }

  const confirmarEliminar = async () => {
    if (!pendienteEliminar) return
    setEliminando(true)
    const json = await postAccion('eliminar_integracion', { id: pendienteEliminar.id, clave: 'Eliminar' })
    setEliminando(false)
    if (json.success) {
      toast({ title: 'Integración eliminada', description: pendienteEliminar.nombre })
      setPendienteEliminar(null)
      cargar()
    } else {
      toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
    }
  }

  const testear = async (id: string) => {
    const json = await postAccion('test_integracion', { id })
    if (json.success) {
      toast({
        title: json.data.ok ? 'Test OK' : 'Test falló',
        description: json.data.mensaje,
        variant: json.data.ok ? 'default' : 'destructive',
      })
      cargar()
    }
  }

  return (
    <div className="space-y-6">
      {/* === Tarjeta dedicada: Botón Bancolombia === */}
      <BancolombiaCard />

      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Plug className="w-5 h-5" /> Otras Integraciones</CardTitle>
        <Button onClick={abrirNuevo} size="sm"><Plus className="w-4 h-4 mr-1" /> Nueva</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.nombre}</TableCell>
                  <TableCell>{i.proveedor}</TableCell>
                  <TableCell><Badge variant="outline">{i.metodoAuth}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{i.ambiente}</Badge></TableCell>
                  <TableCell><EstadoServicioBadge estado={i.estado} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => testear(i.id)} title="Test"><TestTube2 className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(i)} title="Editar"><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => eliminar(i.id)} title="Eliminar"><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Integración' : 'Nueva Integración'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
            <Field label="Nombre" value={form.nombre || ''} onChange={(v) => setForm({ ...form, nombre: v })} required />
            <Field label="Proveedor" value={form.proveedor || ''} onChange={(v) => setForm({ ...form, proveedor: v })} required />
            <Field label="Endpoint" value={form.endpoint || ''} onChange={(v) => setForm({ ...form, endpoint: v })} />
            <SelectField label="Auth" value={form.metodoAuth || 'bearer'} onChange={(v) => setForm({ ...form, metodoAuth: v })} options={['bearer', 'basic', 'apikey', 'oauth2', 'none']} />
            <Field label="API Key" value={form.apiKey && form.apiKey !== '********' ? form.apiKey : ''} onChange={(v) => setForm({ ...form, apiKey: v })} placeholder={editando?.apiKey ? '•••• (vacío = mantener)' : ''} />
            <Field label="API Secret" value={form.apiSecret && form.apiSecret !== '********' ? form.apiSecret : ''} onChange={(v) => setForm({ ...form, apiSecret: v })} placeholder={editando?.apiSecret ? '•••• (vacío = mantener)' : ''} />
            <SelectField label="Ambiente" value={form.ambiente || 'produccion'} onChange={(v) => setForm({ ...form, ambiente: v })} options={['produccion', 'staging', 'desarrollo']} />
            <SelectField label="Estado" value={form.estado || 'activa'} onChange={(v) => setForm({ ...form, estado: v })} options={['activa', 'inactiva', 'error']} />
            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones || ''} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end pt-2">
              <Button type="submit"><Save className="w-4 h-4 mr-2" /> Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Modal de confirmación reforzada para eliminación === */}
      <EliminarConfirmacionDialog
        open={pendienteEliminar !== null}
        onClose={() => { if (!eliminando) setPendienteEliminar(null) }}
        onConfirm={confirmarEliminar}
        recursoTipo="integración"
        recursoNombre={pendienteEliminar?.nombre || ''}
        recursoDetalle={pendienteEliminar?.detalle}
        cargando={eliminando}
      />
    </Card>
    </div>
  )
}

// === 5b. BANCOLOMBIA BOTÓN DE PAGO (tarjeta dedicada) ===
function BancolombiaCard() {
  const [config, setConfig] = useState<{
    configurada: boolean
    id?: string
    clientId?: string | null
    commerceId?: string
    ambiente?: 'sandbox' | 'produccion'
    redirectUrl?: string
    webhookUrl?: string
    activa?: boolean
    probada?: boolean
    fechaUltimaPrueba?: string | null
    resultadoUltimaPrueba?: string | null
    updatedAt?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    commerceId: '',
    ambiente: 'sandbox' as 'sandbox' | 'produccion',
    redirectUrl: '',
    webhookUrl: '',
    activa: true,
  })
  const { toast } = useToast()

  const API_BC = '/api/configuracion-global/bancolombia'

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API_BC)
      const json = await res.json()
      if (json.success && json.data) {
        setConfig(json.data)
        if (json.data.configurada) {
          setForm({
            clientId: json.data.clientId || '', // viene con máscara "••••••••"
            clientSecret: json.data.clientId ? '••••••••' : '', // también enmascarado
            commerceId: json.data.commerceId || '',
            ambiente: (json.data.ambiente as 'sandbox' | 'produccion') || 'sandbox',
            redirectUrl: json.data.redirectUrl || '',
            webhookUrl: json.data.webhookUrl || '',
            activa: json.data.activa ?? true,
          })
        }
      }
    } catch (e) {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(API_BC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Credenciales de Bancolombia guardadas', description: `Ambiente: ${form.ambiente}` })
        cargar()
      } else {
        toast({ title: 'Error al guardar', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  const probar = async () => {
    setTesting(true)
    try {
      // Si hay credenciales en el form sin guardar, probarlas; si no, probar las de BD
      const body: Record<string, unknown> = {}
      if (form.clientId && !form.clientId.startsWith('••••')) {
        body.clientId = form.clientId
        body.clientSecret = form.clientSecret
        body.commerceId = form.commerceId
        body.ambiente = form.ambiente
      }
      const res = await fetch(`${API_BC}/probar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: json.data.ok ? '✅ Conexión exitosa' : '❌ Conexión fallida',
          description: json.data.mensaje,
          variant: json.data.ok ? 'default' : 'destructive',
        })
        cargar()
      } else {
        toast({ title: 'Error al probar', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setTesting(false)
  }

  const ambienteBadge = config?.configurada
    ? (config.ambiente === 'produccion'
      ? <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/30">PRODUCCIÓN</Badge>
      : <Badge className="bg-sky-500/15 text-sky-300 border-sky-400/30">SANDBOX</Badge>)
    : null

  const estadoBadge = !config?.configurada
    ? <Badge variant="outline">No configurada</Badge>
    : config.activa
      ? (config.probada
        ? <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/30">Activa</Badge>
        : <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/30">Sin probar</Badge>)
      : <Badge variant="outline">Inactiva</Badge>

  return (
    <Card className="border-yellow-500/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 border border-yellow-400/30 flex items-center justify-center font-bold text-yellow-300 text-sm">
              BC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>Botón Bancolombia</span>
                {ambienteBadge}
                {estadoBadge}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pasarela de pago para Persona Natural — redirige al cliente a Bancolombia para autorizar
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowGuide(!showGuide)}>
            <BookOpen className="w-4 h-4 mr-1" />
            {showGuide ? 'Ocultar guía' : 'Ver guía'}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {showGuide && (
          <div className="bg-sky-500/5 border border-sky-400/20 rounded-lg p-4 text-sm space-y-2">
            <div className="font-semibold text-sky-300 flex items-center gap-1">
              <Info className="w-4 h-4" /> Guía rápida — Cómo obtener tus credenciales
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Entra a <a href="https://developer.bancolombia.com" target="_blank" rel="noreferrer" className="text-sky-400 underline">developer.bancolombia.com</a> y crea una cuenta de desarrollador.</li>
              <li>Crea una nueva aplicación y selecciona el producto <strong>Botón Bancolombia</strong>.</li>
              <li>Bancolombia te entregará: <strong>Client ID</strong>, <strong>Client Secret</strong> y <strong>Commerce ID</strong>.</li>
              <li>Configura las URLs de redirección y webhook en el portal de Bancolombia:
                <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                  <li><strong>Redirect URL</strong>: la URL a la que vuelve el cliente tras pagar.</li>
                  <li><strong>Webhook URL</strong>: la URL donde Bancolombia envía la confirmación asíncrona del pago.</li>
                </ul>
              </li>
              <li>Para pruebas usa el ambiente <strong>Sandbox</strong>. Para cobros reales cambia a <strong>Producción</strong>.</li>
              <li>Pega las credenciales en el formulario de abajo y haz clic en <strong>"Probar conexión"</strong> antes de guardar.</li>
            </ol>
            <div className="bg-amber-500/10 border border-amber-400/20 rounded p-2 text-xs text-amber-200 mt-2">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Las credenciales se guardan <strong>cifradas</strong> en la base de datos. El Client Secret nunca se muestra después de guardarlo.
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Cargando configuración…</p>
        ) : (
          <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client ID *</Label>
              <Input
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder={config?.configurada ? '•••••••• (vacío = mantener)' : 'Tu Client ID de Bancolombia'}
                required
              />
            </div>
            <div>
              <Label className="text-xs">Client Secret *</Label>
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={config?.configurada ? '•••••••• (vacío = mantener)' : 'Tu Client Secret'}
                required={!config?.configurada}
              />
            </div>
            <div>
              <Label className="text-xs">Commerce ID</Label>
              <Input
                value={form.commerceId}
                onChange={(e) => setForm({ ...form, commerceId: e.target.value })}
                placeholder="Identificador del comercio (opcional)"
              />
            </div>
            <div>
              <Label className="text-xs">Ambiente</Label>
              <Select value={form.ambiente} onValueChange={(v: 'sandbox' | 'produccion') => setForm({ ...form, ambiente: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (pruebas)</SelectItem>
                  <SelectItem value="produccion">Producción (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Redirect URL (a donde vuelve el cliente tras pagar)</Label>
              <Input
                value={form.redirectUrl}
                onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })}
                placeholder="https://jsadr-jsadr.vercel.app/api/pagos/bancolombia-redirect"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Webhook URL (donde Bancolombia confirma el pago)</Label>
              <Input
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://jsadr-jsadr.vercel.app/api/pagos/bancolombia-webhook"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2 pt-1">
              <Switch
                checked={form.activa}
                onCheckedChange={(v) => setForm({ ...form, activa: v })}
              />
              <Label className="text-xs cursor-pointer" onClick={() => setForm({ ...form, activa: !form.activa })}>
                Activar esta pasarela como método de pago en el Portal del Cliente
              </Label>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2 pt-3 border-t border-white/10">
              <Button type="submit" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando…' : 'Guardar credenciales'}
              </Button>
              <Button type="button" variant="outline" onClick={probar} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-2" />}
                {testing ? 'Probando…' : 'Probar conexión'}
              </Button>
              {config?.fechaUltimaPrueba && (
                <span className="text-xs text-muted-foreground self-center ml-2">
                  Última prueba: {formatearFechaHora(config.fechaUltimaPrueba)} —{' '}
                  <span className={config.probada ? 'text-emerald-300' : 'text-red-300'}>
                    {config.probada ? 'OK' : 'Falló'}
                  </span>
                  {config.resultadoUltimaPrueba && ` (${config.resultadoUltimaPrueba.slice(0, 60)})`}
                </span>
              )}
            </div>
          </form>
        )}

        <div className="bg-muted/30 border border-white/5 rounded-lg p-3 text-xs text-muted-foreground">
          <div className="font-semibold mb-1 text-foreground">Endpoints del sistema:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 font-mono">
            <div><span className="text-muted-foreground">Checkout:</span> POST /api/pagos/bancolombia-checkout</div>
            <div><span className="text-muted-foreground">Redirect:</span> GET /api/pagos/bancolombia-redirect</div>
            <div><span className="text-muted-foreground">Webhook:</span> POST /api/pagos/bancolombia-webhook</div>
            <div><span className="text-muted-foreground">Test:</span> POST /api/configuracion-global/bancolombia/probar</div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/5">
            <span className="text-muted-foreground">Flujo:</span> Cliente hace clic en "Pagar con Bancolombia" →
            servidor obtiene token OAuth2 → crea payment-intent con firma HMAC →
            redirige a Bancolombia → cliente autoriza → Bancolombia llama webhook →
            pago se marca como APLICADO en la BD.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// === 6. VARIABLES GLOBALES (CRUD) ===
function VariablesPanel() {
  const [items, setItems] = useState<Variable[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Variable | null>(null)
  // === Refuerzo eliminación ===
  const [pendienteEliminar, setPendienteEliminar] = useState<{ id: string; nombre: string; detalle?: string } | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [form, setForm] = useState<Partial<Variable>>({})
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=variables`)
    const json = await res.json()
    if (json.success) setItems(json.data.variables)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ clave: '', valor: '', tipo: 'string', descripcion: '', categoria: 'general', editable: true })
    setModal(true)
  }
  const abrirEditar = (v: Variable) => { setEditando(v); setForm({ ...v }); setModal(true) }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editando) {
      const json = await patchSeccion('variables', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Variable actualizada' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    } else {
      const json = await postAccion('crear_variable', form as Record<string, unknown>)
      if (json.success) toast({ title: 'Variable creada' })
      else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setModal(false)
    cargar()
  }

  const eliminar = async (id: string) => {
    // Refuerzo: el botón "Eliminar" abre el modal que pide la clave maestra "Eliminar"
    const variable = items.find((v) => v.id === id)
    setPendienteEliminar({
      id,
      nombre: variable?.clave || id,
      detalle: variable
        ? `Tipo: ${variable.tipo} · Categoría: ${variable.categoria}${variable.tipo === 'secret' ? ' · ⚠ Contiene un secreto (API key, token, etc.)' : ''}`
        : undefined,
    })
  }

  const confirmarEliminar = async () => {
    if (!pendienteEliminar) return
    setEliminando(true)
    const json = await postAccion('eliminar_variable', { id: pendienteEliminar.id, clave: 'Eliminar' })
    setEliminando(false)
    if (json.success) {
      toast({ title: 'Variable eliminada', description: pendienteEliminar.nombre })
      setPendienteEliminar(null)
      cargar()
    } else {
      toast({ title: 'No se pudo eliminar', description: json.error, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Variable className="w-5 h-5" /> Variables Globales</CardTitle>
        <Button onClick={abrirNuevo} size="sm"><Plus className="w-4 h-4 mr-1" /> Nueva</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs font-medium">{v.clave}</TableCell>
                  <TableCell className="font-mono text-xs">{v.valor}</TableCell>
                  <TableCell><Badge variant="outline">{v.tipo}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{v.categoria}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(v)} disabled={!v.editable} title="Editar"><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => eliminar(v.id)} title="Eliminar"><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Variable' : 'Nueva Variable'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <Field label="Clave" value={form.clave || ''} onChange={(v) => setForm({ ...form, clave: v })} required disabled={!!editando} />
            <Field label="Valor" value={form.valor || ''} onChange={(v) => setForm({ ...form, valor: v })} required />
            <SelectField label="Tipo" value={form.tipo || 'string'} onChange={(v) => setForm({ ...form, tipo: v })} options={['string', 'number', 'boolean', 'json', 'secret']} />
            <Field label="Categoría" value={form.categoria || 'general'} onChange={(v) => setForm({ ...form, categoria: v })} />
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion || ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit"><Save className="w-4 h-4 mr-2" /> Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Modal de confirmación reforzada para eliminación === */}
      <EliminarConfirmacionDialog
        open={pendienteEliminar !== null}
        onClose={() => { if (!eliminando) setPendienteEliminar(null) }}
        onConfirm={confirmarEliminar}
        recursoTipo="variable global"
        recursoNombre={pendienteEliminar?.nombre || ''}
        recursoDetalle={pendienteEliminar?.detalle}
        cargando={eliminando}
      />
    </Card>
  )
}

// === 7. AMBIENTES ===
function AmbientesPanel() {
  const [items, setItems] = useState<Ambiente[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=ambientes`)
    const json = await res.json()
    if (json.success) setItems(json.data.ambientes)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const toggleActivo = async (a: Ambiente) => {
    const json = await patchSeccion('ambientes', { id: a.id, activo: !a.activo })
    if (json.success) { toast({ title: `Ambiente ${a.activo ? 'desactivado' : 'activado'}` }); cargar() }
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
  }

  if (loading) return <p className="text-muted-foreground p-4">Cargando…</p>

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" /> Ambientes</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((a) => (
          <div key={a.id} className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{a.nombre}</h4>
              <Switch checked={a.activo} onCheckedChange={() => toggleActivo(a)} />
            </div>
            {a.descripcion && <p className="text-xs text-muted-foreground mb-2">{a.descripcion}</p>}
            <Badge variant={a.activo ? 'default' : 'outline'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge>
          </div>
        ))}
        {items.length === 0 && <p className="text-muted-foreground text-sm col-span-3">No hay ambientes configurados.</p>}
      </CardContent>
    </Card>
  )
}

// === 8. SSL ===
function SSLPanel() {
  const [items, setItems] = useState<CertificadoSSL[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=ssl`)
    const json = await res.json()
    if (json.success) setItems(json.data.certificados)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <p className="text-muted-foreground p-4">Cargando…</p>

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Certificados SSL</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dominio</TableHead>
              <TableHead>Emisor</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.dominio}</TableCell>
                <TableCell className="text-xs">{c.emisor || '—'}</TableCell>
                <TableCell className="text-xs">{c.fechaVencimiento ? formatearFechaHora(c.fechaVencimiento) : '—'}</TableCell>
                <TableCell>
                  {c.diasRestantes != null && (
                    <Badge variant={c.diasRestantes < 15 ? 'destructive' : c.diasRestantes < 30 ? 'outline' : 'default'}>
                      {c.diasRestantes} días
                    </Badge>
                  )}
                </TableCell>
                <TableCell><EstadoServicioBadge estado={c.estado} /></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">Sin certificados registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// === 9. ALMACENAMIENTO ===
function AlmacenamientoPanel() {
  const [data, setData] = useState<Almacenamiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=almacenamiento`)
    const json = await res.json()
    if (json.success) setData(json.data.almacenamiento)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!data) return
    setSaving(true)
    const json = await patchSeccion('almacenamiento', data as unknown as Record<string, unknown>)
    if (json.success) toast({ title: 'Almacenamiento actualizado' })
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    setSaving(false)
  }

  if (loading || !data) return <p className="text-muted-foreground p-4">Cargando…</p>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5" /> Almacenamiento</CardTitle>
        <Button onClick={guardar} disabled={saving}><Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar'}</Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Proveedor" value={data.proveedor} onChange={(v) => setData({ ...data, proveedor: v })} options={['local', 's3', 'minio', 'gcs', 'azure']} />
        <Field label="Bucket" value={data.bucket || ''} onChange={(v) => setData({ ...data, bucket: v })} />
        <Field label="Región" value={data.region || ''} onChange={(v) => setData({ ...data, region: v })} />
        <Field label="Endpoint" value={data.endpoint || ''} onChange={(v) => setData({ ...data, endpoint: v })} />
        <Field label="Access Key" value={data.accessKey && data.accessKey !== '********' ? data.accessKey : ''} onChange={(v) => setData({ ...data, accessKey: v })} placeholder={data.accessKey ? '•••• (vacío = mantener)' : ''} />
        <Field label="Secret Key" value={data.secretKey && data.secretKey !== '********' ? data.secretKey : ''} onChange={(v) => setData({ ...data, secretKey: v })} placeholder={data.secretKey ? '•••• (vacío = mantener)' : ''} />
        <div className="flex items-center gap-2 col-span-2"><Switch checked={data.activo} onCheckedChange={(v) => setData({ ...data, activo: v })} /> <Label>Activo</Label></div>
        <Field label="Ruta Documentos" value={data.rutaDocumentos} onChange={(v) => setData({ ...data, rutaDocumentos: v })} />
        <Field label="Ruta Fotos" value={data.rutaFotos} onChange={(v) => setData({ ...data, rutaFotos: v })} />
        <Field label="Ruta Contratos" value={data.rutaContratos} onChange={(v) => setData({ ...data, rutaContratos: v })} />
        <Field label="Ruta Firmas" value={data.rutaFirmas} onChange={(v) => setData({ ...data, rutaFirmas: v })} />
        <Field label="Ruta Historiales" value={data.rutaHistoriales} onChange={(v) => setData({ ...data, rutaHistoriales: v })} />
        <Field label="Ruta Portal Cliente" value={data.rutaPortalCliente} onChange={(v) => setData({ ...data, rutaPortalCliente: v })} />
      </CardContent>
    </Card>
  )
}

// === 10. ESTADO DEL SISTEMA (grid de servicios) ===
function EstadoPanel() {
  const [items, setItems] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=estado`)
    const json = await res.json()
    if (json.success) setItems(json.data.servicios)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <p className="text-muted-foreground p-4">Cargando…</p>

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Estado de Servicios</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => {
          const color =
            s.estado === 'operativo' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' :
            s.estado === 'degradado' ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' :
            s.estado === 'caido' ? 'bg-red-500/15 text-red-300 border-red-400/30' :
            'bg-white/10 text-foreground border-white/20'
          return (
            <div key={s.id} className="p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{s.servicio}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>{s.estado}</span>
              </div>
              {s.detalle && <p className="text-xs text-muted-foreground mb-2">{s.detalle}</p>}
              <div className="text-xs text-muted-foreground">
                Último check: {formatearFechaHora(s.ultimoCheck)}
                {s.latenciaMs != null && <span> · {s.latenciaMs}ms</span>}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// === 11. MANTENIMIENTO — Centro de Operaciones ===
function MantenimientoPanel() {
  const [data, setData] = useState<Mantenimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=mantenimiento`)
    const json = await res.json()
    if (json.success) setData(json.data.mantenimiento)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // === Guardar toda la configuración ===
  const guardar = async () => {
    if (!data) return
    setSaving(true)
    const json = await patchSeccion('mantenimiento', data as unknown as Record<string, unknown>, 'Modo mantenimiento')
    if (json.success) toast({ title: 'Configuración de mantenimiento actualizada' })
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    setSaving(false)
  }

  // === TOGGLE RÁPIDO — Activa/desactiva el modo mantenimiento con un click ===
  // Este es el botón principal del "centro de operaciones": permite al admin
  // activar el mantenimiento de emergencia sin tener que hacer scroll y guardar
  // toda la configuración. Pone un mensaje por defecto y guarda inmediatamente.
  const toggleMantenimiento = async () => {
    if (!data) return
    setToggling(true)
    const nuevoEstado = !data.activo
    const nuevoData = {
      ...data,
      activo: nuevoEstado,
      // Si se activa sin mensaje, poner uno por defecto
      mensaje: nuevoEstado && !data.mensaje
        ? 'El sistema se encuentra en mantenimiento programado. Volveremos pronto.'
        : data.mensaje,
    }
    setData(nuevoData)
    const json = await patchSeccion('mantenimiento', nuevoData as unknown as Record<string, unknown>, 'Toggle mantenimiento')
    if (json.success) {
      toast({
        title: nuevoEstado ? '🚧 Mantenimiento ACTIVADO' : '✅ Sistema operativo',
        description: nuevoEstado
          ? 'Los clientes verán el mensaje de mantenimiento al intentar iniciar sesión.'
          : 'Los clientes pueden iniciar sesión normalmente.',
        variant: nuevoEstado ? 'destructive' : 'default',
      })
    } else {
      // Revertir en caso de error
      setData(data)
      toast({ title: 'Error al cambiar mantenimiento', description: json.error, variant: 'destructive' })
    }
    setToggling(false)
  }

  if (loading || !data) return <p className="text-muted-foreground p-4">Cargando…</p>

  const estaActivo = data.activo

  return (
    <div className="space-y-6">
      {/* =====================================================
          BANNER PRINCIPAL — Estado del sistema + Toggle grande
          ===================================================== */}
      <div className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
        estaActivo
          ? 'border-amber-400 bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 shadow-lg shadow-amber-500/20'
          : 'border-emerald-400 bg-gradient-to-br from-emerald-900/40 via-green-900/30 to-teal-900/40 shadow-lg shadow-emerald-500/20'
      }`}>
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10">
          {estaActivo ? (
            // Patrón de advertencia
            <div className="w-full h-full" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(251,191,36,0.4) 20px, rgba(251,191,36,0.4) 40px)',
            }} />
          ) : (
            // Patrón de OK
            <div className="w-full h-full" style={{
              backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
          )}
        </div>

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Estado actual */}
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl ${
                estaActivo ? 'bg-amber-500/30' : 'bg-emerald-500/30'
              }`}>
                {estaActivo ? (
                  <AlertTriangle className="w-9 h-9 text-amber-300" />
                ) : (
                  <CheckCircle className="w-9 h-9 text-emerald-300" />
                )}
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                  estaActivo ? 'text-amber-300' : 'text-emerald-300'
                }`}>
                  Estado del Sistema
                </p>
                <h2 className={`text-2xl font-bold ${
                  estaActivo ? 'text-amber-100' : 'text-emerald-100'
                }`}>
                  {estaActivo ? 'En Mantenimiento' : 'Operativo'}
                </h2>
                <p className={`text-sm mt-1 ${
                  estaActivo ? 'text-amber-200/70' : 'text-emerald-200/70'
                }`}>
                  {estaActivo
                    ? 'Los clientes no pueden iniciar sesión — ven el mensaje de mantenimiento.'
                    : 'Los clientes pueden iniciar sesión normalmente.'}
                </p>
              </div>
            </div>

            {/* Toggle grande */}
            <button
              type="button"
              onClick={toggleMantenimiento}
              disabled={toggling}
              className={`shrink-0 px-6 py-4 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 ${
                estaActivo
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
              }`}
            >
              {toggling ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 inline animate-spin" />
                  Procesando…
                </>
              ) : estaActivo ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2 inline" />
                  Desactivar Mantenimiento
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2 inline" />
                  Activar Mantenimiento
                </>
              )}
            </button>
          </div>

          {/* Info de timing */}
          {(data.inicio || data.fin) && (
            <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.inicio && (
                <div className="rounded-lg bg-black/20 p-3">
                  <p className="text-xs text-white/60 font-medium">Inicio programado</p>
                  <p className="text-sm text-white font-mono mt-0.5">
                    {new Date(data.inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                  </p>
                </div>
              )}
              {data.fin && (
                <div className="rounded-lg bg-black/20 p-3">
                  <p className="text-xs text-white/60 font-medium">Fin programado</p>
                  <p className="text-sm text-white font-mono mt-0.5">
                    {new Date(data.fin).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          CONFIGURACIÓN DETALLADA
          ===================================================== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Configuración Detallada de Mantenimiento
          </CardTitle>
          <Button onClick={guardar} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle activo */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {estaActivo ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
              <div>
                <div className="font-semibold">Modo mantenimiento</div>
                <div className="text-xs text-muted-foreground">
                  Activa/desactiva el modo mantenimiento para usuarios finales
                </div>
              </div>
            </div>
            <Switch checked={data.activo} onCheckedChange={(v) => setData({ ...data, activo: v })} />
          </div>

          {/* Mensaje a mostrar */}
          <div>
            <Label className="text-sm font-medium">Mensaje a mostrar en el login</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Este texto se mostrará a los clientes cuando intenten iniciar sesión durante el mantenimiento.
            </p>
            <Textarea
              value={data.mensaje}
              onChange={(e) => setData({ ...data, mensaje: e.target.value })}
              rows={3}
              placeholder="El sistema se encuentra en mantenimiento. Volveremos pronto."
            />
          </div>

          {/* Fechas programadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Inicio programado (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Formato: YYYY-MM-DDTHH:MM</p>
              <Input
                value={data.inicio ? new Date(data.inicio).toISOString().slice(0, 16) : ''}
                onChange={(e) => setData({ ...data, inicio: e.target.value || null })}
                type="datetime-local"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Fin programado (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Formato: YYYY-MM-DDTHH:MM</p>
              <Input
                value={data.fin ? new Date(data.fin).toISOString().slice(0, 16) : ''}
                onChange={(e) => setData({ ...data, fin: e.target.value || null })}
                type="datetime-local"
              />
            </div>
          </div>

          {/* Permitir admin */}
          <div className="flex items-center gap-3 p-4 rounded-lg border border-white/10 bg-white/5">
            <Switch checked={data.permitirAdmin} onCheckedChange={(v) => setData({ ...data, permitirAdmin: v })} />
            <div>
              <div className="font-medium">Permitir acceso a administradores</div>
              <div className="text-xs text-muted-foreground">
                Los administradores podrán iniciar sesión durante el mantenimiento para realizar tareas.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =====================================================
          VISTA PREVIA — Cómo lo verá el cliente
          ===================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Vista Previa — Cómo lo verá el cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`rounded-xl p-6 border-2 ${
            estaActivo
              ? 'border-amber-400 bg-amber-950/30'
              : 'border-emerald-400 bg-emerald-950/20'
          }`}>
            <div className="flex items-start gap-3">
              {estaActivo ? (
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-bold text-lg ${
                  estaActivo ? 'text-amber-200' : 'text-emerald-200'
                }`}>
                  {estaActivo ? 'Sistema en Mantenimiento' : 'Sistema Operativo'}
                </p>
                <p className={`text-sm mt-1 ${
                  estaActivo ? 'text-amber-100/80' : 'text-emerald-100/80'
                }`}>
                  {data.mensaje || 'El sistema se encuentra en mantenimiento. Volveremos pronto.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// === 12. BACKUPS ===
function BackupsPanel() {
  const [versiones, setVersiones] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=backups`)
    const json = await res.json()
    if (json.success) setVersiones(json.data.versiones.filter((v: Version) => v.seccion === 'backup'))
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const generarBackup = async () => {
    setGenerando(true)
    const json = await postAccion('backup_config', {})
    if (json.success) {
      toast({ title: 'Backup generado', description: `Versión #${json.data.numero}` })
      // Descargar JSON
      const blob = new Blob([JSON.stringify(json.data.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_config_${json.data.timestamp.replace(/[:.]/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      cargar()
    } else {
      toast({ title: 'Error', description: json.error, variant: 'destructive' })
    }
    setGenerando(false)
  }

  const restaurar = async (versionId: string) => {
    if (!confirm('¿Restaurar esta versión? Esto puede modificar la configuración actual.')) return
    setRestaurando(versionId)
    const json = await postAccion('restaurar_version', { versionId })
    if (json.success) toast({ title: 'Versión restaurada' })
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    setRestaurando(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Backups de Configuración</CardTitle>
        <Button onClick={generarBackup} disabled={generando}>
          <Download className="w-4 h-4 mr-2" /> {generando ? 'Generando…' : 'Generar Backup'}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Generado por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versiones.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">#{v.numero}</TableCell>
                  <TableCell className="text-xs">{v.descripcion}</TableCell>
                  <TableCell className="text-xs">{v.usuarioNombre}</TableCell>
                  <TableCell className="text-xs">{formatearFechaHora(v.createdAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => restaurar(v.id)} disabled={restaurando === v.id}>
                      <RotateCcw className="w-4 h-4 mr-1" /> {restaurando === v.id ? 'Restaurando…' : 'Restaurar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {versiones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">Sin backups aún</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// === 13. AUDITORÍA ===
function AuditoriaPanel() {
  const [items, setItems] = useState<Auditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const url = filtro ? `${API}?seccion=auditoria&seccionFiltro=${encodeURIComponent(filtro)}` : `${API}?seccion=auditoria`
    const res = await fetch(url)
    const json = await res.json()
    if (json.success) setItems(json.data.auditoria)
    setLoading(false)
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Auditoría de Cambios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <Input placeholder="Filtrar por sección…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <Button variant="outline" onClick={cargar}>Actualizar</Button>
        </div>
        {loading ? <p className="text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sección</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead>Nuevo</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="outline">{a.seccion}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.campo}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px] truncate">{a.valorAnterior || '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[150px] truncate">{a.valorNuevo || '—'}</TableCell>
                  <TableCell className="text-xs">{a.usuarioNombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.ipOrigen}</TableCell>
                  <TableCell className="text-xs">{formatearFechaHora(a.createdAt)}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">Sin registros</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// === 14. VERSIONES ===
function VersionesPanel() {
  const [items, setItems] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const { toast } = useToast()

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`${API}?seccion=versiones`)
    const json = await res.json()
    if (json.success) setItems(json.data.versiones)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const restaurar = async (versionId: string) => {
    if (!confirm('¿Restaurar esta versión?')) return
    setRestaurando(versionId)
    const json = await postAccion('restaurar_version', { versionId })
    if (json.success) toast({ title: 'Versión restaurada' })
    else toast({ title: 'Error', description: json.error, variant: 'destructive' })
    setRestaurando(null)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" /> Historial de Versiones</CardTitle></CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Cargando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Sección</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">#{v.numero}</TableCell>
                  <TableCell><Badge variant="outline">{v.seccion}</Badge></TableCell>
                  <TableCell className="text-xs">{v.descripcion}</TableCell>
                  <TableCell className="text-xs">{v.usuarioNombre}</TableCell>
                  <TableCell className="text-xs">{formatearFechaHora(v.createdAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => restaurar(v.id)} disabled={restaurando === v.id}>
                      <RotateCcw className="w-4 h-4 mr-1" /> {restaurando === v.id ? '…' : 'Restaurar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">Sin versiones registradas</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// === COMPONENTES DE UI REUTILIZABLES ===

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
  placeholder = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-red-400"> *</span>}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function EstadoServicioBadge({ estado }: { estado: string }) {
  const cfg: Record<string, string> = {
    activo: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    activa: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    operativo: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    inactivo: 'bg-white/10 text-muted-foreground border-white/20',
    inactiva: 'bg-white/10 text-muted-foreground border-white/20',
    error: 'bg-red-500/15 text-red-300 border-red-400/30',
    caido: 'bg-red-500/15 text-red-300 border-red-400/30',
    degradado: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    redireccion: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  }
  const cls = cfg[estado] || 'bg-white/10 text-foreground border-white/20'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{estado}</span>
}

// =====================================================
// Panel: CÓDIGO FUENTE — Descarga del ZIP del proyecto
// =====================================================
// Permite descargar el código fuente completo del sistema
// en formato ZIP. El ZIP se regenera automáticamente cuando
// se detectan cambios en los archivos del proyecto.
// =====================================================
interface CodigoFuenteInfo {
  existeZip: boolean
  ruta: string
  nombreArchivo: string
  tamano: number
  tamanoFormateado: string
  archivos: number
  hash: string
  fechaGeneracion: string
  ultimaModificacionCodigo: string
  zipDesactualizado: boolean
  urlDescarga: string
}

function CodigoFuentePanel() {
  const [info, setInfo] = useState<CodigoFuenteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerando, setRegenerando] = useState(false)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const { toast } = useToast()

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/configuracion-global/codigo-fuente?accion=info')
      const json = await res.json()
      if (json.success) {
        setInfo(json.data)
        // Si el ZIP está desactualizado y auto-update está activo, regenerar
        if (json.data.zipDesactualizado && autoUpdate) {
          await regenerar(true)
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const regenerar = async (silencioso = false) => {
    try {
      if (!silencioso) setRegenerando(true)
      const res = await fetch('/api/configuracion-global/codigo-fuente?accion=regenerar')
      const json = await res.json()
      if (json.success) {
        // Recargar info
        await cargar()
        if (!silencioso) {
          toast({
            title: '✅ ZIP regenerado',
            description: json.mensaje,
          })
        }
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setRegenerando(false)
    }
  }

  const descargar = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/configuracion-global/codigo-fuente?accion=descargar', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        toast({ title: 'Error al descargar', description: errJson.error || `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = 'jsadr-proyecto.zip'
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: 'Descarga iniciada',
        description: 'El archivo ZIP se está descargando. Guárdalo en tu computador.',
        duration: 5000,
      })
    } catch (e: any) {
      toast({ title: 'Error al descargar', description: e.message, variant: 'destructive' })
    }
  }

  useEffect(() => {
    cargar()
    // Auto-refresh cada 60 segundos para detectar cambios
    const interval = setInterval(cargar, 60000)
    return () => clearInterval(interval)
  }, [autoUpdate])

  if (loading && !info) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          Cargando información del código fuente...
        </CardContent>
      </Card>
    )
  }

  if (!info) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No se pudo cargar la información del código fuente.
          <Button variant="outline" className="mt-3" onClick={cargar}>
            <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-violet-400/30 bg-violet-500/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-violet-500/10 shrink-0">
              <Package className="w-8 h-8 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-violet-300">Código Fuente del Proyecto</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Descarga el código completo del sistema Jsadr en formato ZIP. El archivo se
                actualiza automáticamente cuando detecta cambios en el código fuente.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  id="auto-update-codigo"
                  checked={autoUpdate}
                  onCheckedChange={setAutoUpdate}
                />
                <Label htmlFor="auto-update-codigo" className="text-xs cursor-pointer">
                  Actualización automática (detecta cambios cada 60s)
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas del ZIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <FileArchive className="w-6 h-6 mx-auto mb-1 text-blue-400" />
            <p className="text-xs text-muted-foreground">Tamaño</p>
            <p className="text-lg font-bold">{info.tamanoFormateado}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileCode className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
            <p className="text-xs text-muted-foreground">Archivos</p>
            <p className="text-lg font-bold">{info.archivos.toLocaleString('es-CO')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-1 text-amber-400" />
            <p className="text-xs text-muted-foreground">Generado</p>
            <p className="text-xs font-bold mt-1">
              {new Date(info.fechaGeneracion).toLocaleString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs text-muted-foreground">Último cambio código</p>
            <p className="text-xs font-bold mt-1">
              {new Date(info.ultimaModificacionCodigo).toLocaleString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado del ZIP */}
      <Card className={info.zipDesactualizado ? 'border-amber-400/40 bg-amber-500/5' : 'border-emerald-400/30 bg-emerald-500/5'}>
        <CardContent className="p-4">
          {info.zipDesactualizado ? (
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">
                  ZIP desactualizado
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se detectaron cambios en el código fuente posteriores a la última generación del ZIP.
                  {autoUpdate ? ' Regenerando automáticamente...' : ' Click en "Regenerar ZIP" para actualizar.'}
                </p>
              </div>
              {regenerando && (
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">
                  ZIP actualizado
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El ZIP contiene la versión más reciente del código fuente.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información técnica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Información técnica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre del archivo:</span>
            <strong className="font-mono">{info.nombreArchivo}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tamaño:</span>
            <strong>{info.tamanoFormateado} ({info.tamano.toLocaleString('es-CO')} bytes)</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Número de archivos:</span>
            <strong>{info.archivos.toLocaleString('es-CO')}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hash SHA-256:</span>
            <strong className="font-mono text-xs">{info.hash}...</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha de generación:</span>
            <strong>{formatearFechaHora(info.fechaGeneracion)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Última modificación del código:</span>
            <strong>{formatearFechaHora(info.ultimaModificacionCodigo)}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Qué incluye el ZIP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            ¿Qué incluye el ZIP?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Código fuente completo:</strong>{' '}
              <span className="text-muted-foreground">src/, prisma/, public/, scripts/</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Configuración:</strong>{' '}
              <span className="text-muted-foreground">package.json, tsconfig.json, next.config.ts, vercel.json, tailwind.config.ts</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Documentación:</strong>{' '}
              <span className="text-muted-foreground">README.md, DEPLOY.md</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong>Excluido (por seguridad/peso):</strong>{' '}
              <span className="text-muted-foreground">
                .env (secretos), node_modules/, .next/, db/, download/, upload/, snapshots/, tool-results/
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => regenerar(false)}
          disabled={regenerando}
        >
          {regenerando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerar ZIP
            </>
          )}
        </Button>
        <Button
          onClick={descargar}
          disabled={regenerando}
          className="bg-violet-600 hover:bg-violet-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar ZIP ({info.tamanoFormateado})
        </Button>
      </div>

      {/* Nota para subir a GitHub */}
      <Card className="border-blue-400/30 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-300 mb-1">
                ¿Para subir a GitHub?
              </p>
              <p className="text-muted-foreground">
                Después de descargar el ZIP: 1) Descomprímelo en tu computador,
                2) Entra a tu repo de GitHub, 3) Click en "uploading an existing file",
                4) Arrastra todos los archivos descomprimidos, 5) Click "Commit changes".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
