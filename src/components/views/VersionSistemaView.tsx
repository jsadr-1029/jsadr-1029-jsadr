'use client'

import { useEffect, useState, useRef } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  GitBranch,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Database,
  Download,
  Upload,
  RotateCcw,
  FileText,
  FileJson,
  Info,
  Lightbulb,
  Loader2,
  ShieldCheck,
  HardDrive,
  Calendar,
  Activity,
  AlertTriangle,
} from 'lucide-react'

// ===================== TIPOS =====================
interface VersionSistema {
  id: string
  numero: string
  nombre: string
  descripcion: string | null
  cambios: string | null
  tipo: string
  activa: boolean
  fechaActivacion: string | null
  backupId: string | null
  createdAt: string
  updatedAt: string
}

interface Backup {
  id: string
  nombre: string
  tipo: string
  tamano: number
  rutaArchivo: string
  checksum: string | null
  entidadTipo: string | null
  estado: string
  generadoPor: string | null
  restauradoEn: string | null
  metadata: string | null
  createdAt: string
}

// ===================== CONSTANTES =====================
const TIPOS_VERSION = [
  { value: 'MAYOR', label: 'Mayor', color: 'text-violet-300 border-violet-400/40 bg-violet-500/15' },
  { value: 'MENOR', label: 'Menor', color: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/15' },
  { value: 'PATCH', label: 'Patch', color: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15' },
  { value: 'HOTFIX', label: 'Hotfix', color: 'text-amber-300 border-amber-400/40 bg-amber-500/15' },
  { value: 'RESTAURACION', label: 'Restauración', color: 'text-rose-300 border-rose-400/40 bg-rose-500/15' },
]

const TIPOS_BACKUP = [
  { value: 'COMPLETO', label: 'Completo (todos los datos)' },
  { value: 'DATOS', label: 'Solo datos operativos' },
  { value: 'PARCIAL', label: 'Parcial (configuración)' },
]

function formatearTamano(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function obtenerColorTipo(tipo: string) {
  return TIPOS_VERSION.find((t) => t.value === tipo) || TIPOS_VERSION[0]
}

// Sugiere el siguiente número de versión (incrementa PATCH por defecto)
function sugerirSiguienteVersion(versiones: VersionSistema[]): string {
  if (versiones.length === 0) return '1.0.0'
  // Tomar la más alta según semver
  const ordenadas = [...versiones].sort((a, b) => {
    const [a1, a2, a3] = a.numero.split('.').map(Number)
    const [b1, b2, b3] = b.numero.split('.').map(Number)
    return b1 - a1 || b2 - a2 || b3 - a3
  })
  const [mayor, menor, patch] = ordenadas[0].numero.split('.').map(Number)
  return `${mayor}.${menor}.${patch + 1}`
}

// ===================== COMPONENTE PRINCIPAL =====================
export function VersionSistemaView() {
  const [tab, setTab] = useState('versiones')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistema y Versiones"
        subtitle="Gestión de versiones, backups y ficha técnica del sistema"
        icon={<GitBranch className="w-5 h-5" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="versiones">
            <GitBranch className="w-4 h-4 mr-2" />
            Versiones
          </TabsTrigger>
          <TabsTrigger value="backups">
            <Database className="w-4 h-4 mr-2" />
            Backups
          </TabsTrigger>
          <TabsTrigger value="ficha">
            <FileText className="w-4 h-4 mr-2" />
            Ficha Técnica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="versiones">
          <VersionesPanel />
        </TabsContent>
        <TabsContent value="backups">
          <BackupsPanel />
        </TabsContent>
        <TabsContent value="ficha">
          <FichaTecnicaPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===================== PANEL VERSIONES =====================
function VersionesPanel() {
  const [versiones, setVersiones] = useState<VersionSistema[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<VersionSistema | null>(null)
  const [activando, setActivando] = useState<VersionSistema | null>(null)
  const [guardando, setGuardando] = useState(false)
  const { toast } = useToast()

  const [form, setForm] = useState({
    numero: '',
    nombre: '',
    descripcion: '',
    tipo: 'MAYOR',
    cambios: '',
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/versiones')
      const json = await res.json()
      if (json.success) setVersiones(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      numero: sugerirSiguienteVersion(versiones),
      nombre: '',
      descripcion: '',
      tipo: 'MAYOR',
      cambios: '',
    })
    setModal(true)
  }

  const abrirEditar = (v: VersionSistema) => {
    setEditando(v)
    let cambiosText = ''
    if (v.cambios) {
      try {
        const arr = JSON.parse(v.cambios)
        cambiosText = Array.isArray(arr) ? arr.join('\n') : String(arr)
      } catch {
        cambiosText = v.cambios
      }
    }
    setForm({
      numero: v.numero,
      nombre: v.nombre,
      descripcion: v.descripcion || '',
      tipo: v.tipo || 'MAYOR',
      cambios: cambiosText,
    })
    setModal(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      // Convertir cambios textarea (uno por línea) a array
      const cambiosArr = form.cambios
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      const payload: any = {
        numero: form.numero,
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        tipo: form.tipo,
        cambios: cambiosArr.length > 0 ? cambiosArr : undefined,
      }

      const url = editando ? `/api/versiones/${editando.id}` : '/api/versiones'
      const method = editando ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: editando ? 'Versión actualizada' : 'Versión creada',
          description: `v${form.numero} — ${form.nombre}`,
        })
        setModal(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (v: VersionSistema) => {
    try {
      const res = await fetch(`/api/versiones/${v.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Versión eliminada', description: `v${v.numero}` })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const activar = async () => {
    if (!activando) return
    try {
      const res = await fetch(`/api/versiones/${activando.id}/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generarBackup: true }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Versión activada',
          description: json.message || `v${activando.numero} activada`,
        })
        setActivando(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Versiones del Sistema</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Gestiona el ciclo de vida de cada versión. Solo puede haber una activa a la vez.
            </p>
          </div>
          <Button onClick={abrirNuevo} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Versión
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Versión</TableHead>
                <TableHead className="text-muted-foreground">Nombre</TableHead>
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">Cambios</TableHead>
                <TableHead className="text-muted-foreground">Estado</TableHead>
                <TableHead className="text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                    Cargando versiones...
                  </TableCell>
                </TableRow>
              ) : versiones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No hay versiones registradas. Crea la primera versión del sistema.
                  </TableCell>
                </TableRow>
              ) : (
                versiones.map((v) => {
                  const tipoCfg = obtenerColorTipo(v.tipo)
                  let cambiosCount = 0
                  if (v.cambios) {
                    try {
                      const arr = JSON.parse(v.cambios)
                      cambiosCount = Array.isArray(arr) ? arr.length : 1
                    } catch {
                      cambiosCount = 1
                    }
                  }
                  return (
                    <TableRow
                      key={v.id}
                      className={`border-white/5 hover:bg-white/5 ${v.activa ? 'bg-emerald-500/5' : ''}`}
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          v{v.numero}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{v.nombre}</p>
                        {v.descripcion && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                            {v.descripcion}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${tipoCfg.color}`}>
                          {tipoCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-white/5">
                          {cambiosCount} cambio{cambiosCount !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.activa ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground bg-white/5">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatearFecha(v.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!v.activa && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
                              onClick={() => setActivando(v)}
                              title="Activar versión"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 hover:bg-white/10"
                            onClick={() => abrirEditar(v)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!v.activa && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                              onClick={() => eliminar(v)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Modal Crear/Editar versión */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-2xl glass-card-strong">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              {editando ? `Editar Versión v${editando.numero}` : 'Nueva Versión del Sistema'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de versión *</Label>
                <Input
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  required
                  disabled={!!editando}
                  placeholder="1.0.0"
                  pattern="\d+\.\d+\.\d+"
                  title="Formato: X.Y.Z (ej: 3.1.0)"
                />
                <p className="text-xs text-muted-foreground">
                  Formato semántico X.Y.Z (sin &quot;v&quot;)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Tipo de versión *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_VERSION.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} — {t.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre descriptivo *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  placeholder="ej: Actualización de motor de cálculo financiero"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={2}
                  placeholder="Resumen general del cambio (opcional)"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Changelog (un cambio por línea)</Label>
                <Textarea
                  value={form.cambios}
                  onChange={(e) => setForm({ ...form, cambios: e.target.value })}
                  rows={6}
                  placeholder={`Nueva funcionalidad X agregada
Corregido error en cálculo de mora
Mejora de rendimiento en reportes`}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Cada línea se guardará como un cambio independiente en el changelog.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardando}
                className="gradient-primary text-white"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : editando ? (
                  'Guardar Cambios'
                ) : (
                  'Crear Versión'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar activación */}
      <AlertDialog
        open={!!activando}
        onOpenChange={(open) => !open && setActivando(null)}
      >
        <AlertDialogContent className="glass-card-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Activar versión {activando && `v${activando.numero}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se generará un backup automático (PRE_ACTIVACION) antes de cambiar la versión activa.
              <br />
              <br />
              <strong className="text-foreground">Versión:</strong>{' '}
              {activando?.numero} — {activando?.nombre}
              <br />
              <strong className="text-foreground">Acción:</strong> Esta versión se activará
              y las demás se desactivarán automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={activar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Activar y generar backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ===================== PANEL BACKUPS =====================
function BackupsPanel() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [restaurando, setRestaurando] = useState<Backup | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [restaurandoArchivo, setRestaurandoArchivo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'COMPLETO',
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backups')
      const json = await res.json()
      if (json.success) setBackups(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const abrirNuevo = () => {
    setForm({
      nombre: `Backup ${new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`,
      descripcion: '',
      tipo: 'COMPLETO',
    })
    setModal(true)
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          entidadTipo: form.tipo,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Backup generado',
          description: form.nombre,
        })
        setModal(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  const descargar = (b: Backup) => {
    window.open(`/api/backups?descargar=${b.id}`, '_blank')
  }

  const restaurar = async () => {
    if (!restaurando) return
    try {
      const res = await fetch('/api/backups/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: restaurando.id,
          sobrescribir: true,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Backup restaurado',
          description: json.message || 'Operación completada',
        })
        setRestaurando(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (b: Backup) => {
    if (!confirm(`¿Eliminar el backup "${b.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/backups?id=${b.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Backup eliminado', description: b.nombre })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const restaurarDesdeArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestaurandoArchivo(true)
    try {
      const texto = await file.text()
      // Validar que sea JSON parseable
      JSON.parse(texto)
      const res = await fetch('/api/backups/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivo: texto,
          sobrescribir: true,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Restauración completada',
          description: `Archivo: ${file.name}`,
        })
        cargar()
      } else {
        toast({ title: 'Error al restaurar', description: json.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({
        title: 'Archivo inválido',
        description: 'El archivo debe ser un JSON válido de backup.',
        variant: 'destructive',
      })
    } finally {
      setRestaurandoArchivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalTamano = backups.reduce((s, b) => s + (b.tamano || 0), 0)

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Database className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Backups</p>
                <p className="text-xl font-bold">{backups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tamaño Total</p>
                <p className="text-xl font-bold">{formatearTamano(totalTamano)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completados</p>
                <p className="text-xl font-bold">
                  {backups.filter((b) => b.estado === 'COMPLETADO').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Restaurados</p>
                <p className="text-xl font-bold">
                  {backups.filter((b) => b.estado === 'RESTAURADO').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Backups del Sistema</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Crea, descarga y restaura puntos de recuperación completos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={restaurandoArchivo}
              >
                {restaurandoArchivo ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Restaurar desde archivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={restaurarDesdeArchivo}
              />
              <Button onClick={abrirNuevo} className="gradient-primary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Crear Backup
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Nombre</TableHead>
                  <TableHead className="text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-muted-foreground">Entidad</TableHead>
                  <TableHead className="text-muted-foreground">Tamaño</TableHead>
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-right text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                      Cargando backups...
                    </TableCell>
                  </TableRow>
                ) : backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No hay backups registrados. Crea tu primer backup manual.
                    </TableCell>
                  </TableRow>
                ) : (
                  backups.map((b) => {
                    let descripcionMeta: string | null = null
                    if (b.metadata) {
                      try {
                        const m = JSON.parse(b.metadata)
                        descripcionMeta = m.descripcion || null
                      } catch {}
                    }
                    return (
                      <TableRow
                        key={b.id}
                        className="border-white/5 hover:bg-white/5"
                      >
                        <TableCell>
                          <p className="text-sm font-medium">{b.nombre}</p>
                          {descripcionMeta && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                              {descripcionMeta}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              b.tipo === 'PRE_ACTIVACION'
                                ? 'text-amber-300 border-amber-400/40 bg-amber-500/15'
                                : b.tipo === 'AUTOMATICO'
                                ? 'text-cyan-300 border-cyan-400/40 bg-cyan-500/15'
                                : 'text-violet-300 border-violet-400/40 bg-violet-500/15'
                            }`}
                          >
                            {b.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {b.entidadTipo || 'TODOS'}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {formatearTamano(b.tamano)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatearFechaHora(b.createdAt)}
                        </TableCell>
                        <TableCell>
                          {b.estado === 'COMPLETADO' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completado
                            </Badge>
                          ) : b.estado === 'RESTAURADO' ? (
                            <Badge className="bg-amber-500/15 text-amber-300 border border-amber-400/30">
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Restaurado
                            </Badge>
                          ) : b.estado === 'FALLIDO' ? (
                            <Badge className="bg-rose-500/15 text-rose-300 border border-rose-400/30">
                              Fallido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {b.estado}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 hover:bg-white/10"
                              onClick={() => descargar(b)}
                              title="Descargar"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                              onClick={() => setRestaurando(b)}
                              title="Restaurar"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                              onClick={() => eliminar(b)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal crear backup */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="glass-card-strong">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Crear Backup Manual
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={crear} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Backup descriptivo"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
                placeholder="Razón del backup (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de backup *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_BACKUP.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El sistema generará un archivo JSON con la información solicitada y calculará su checksum SHA-256.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardando}
                className="gradient-primary text-white"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Generar Backup
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar restauración */}
      <AlertDialog
        open={!!restaurando}
        onOpenChange={(open) => !open && setRestaurando(null)}
      >
        <AlertDialogContent className="glass-card-strong">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-5 h-5" />
              Restaurar Backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-rose-300">⚠️ Acción destructiva.</strong>
              <br />
              Vas a restaurar el backup <strong className="text-foreground">{restaurando?.nombre}</strong>.
              Esta operación sobrescribirá los datos actuales del sistema (clientes,
              solicitudes, pagos, configuración).
              <br />
              <br />
              Se recomienda generar un backup del estado actual antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={restaurar}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar ahora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===================== PANEL FICHA TÉCNICA =====================
function FichaTecnicaPanel() {
  const [codigo, setCodigo] = useState('')

  const verHTML = () => {
    if (!codigo) {
      alert('Ingresa un código de solicitud o ID primero.')
      return
    }
    const param = codigo.match(/^[0-9a-f]{8,}$/i) ? 'prestamoId' : 'codigo'
    window.open(`/api/ficha-tecnica?${param}=${encodeURIComponent(codigo)}`, '_blank')
  }

  const descargarJSON = () => {
    if (!codigo) {
      alert('Ingresa un código de solicitud o ID primero.')
      return
    }
    const param = codigo.match(/^[0-9a-f]{8,}$/i) ? 'prestamoId' : 'codigo'
    window.open(
      `/api/ficha-tecnica?${param}=${encodeURIComponent(codigo)}&formato=json`,
      '_blank'
    )
  }

  return (
    <div className="space-y-4">
      {/* Acciones */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Generar Ficha Técnica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Código o ID del solicitud</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ej: PR-2024-001 o un ID largo (cuid)"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              La ficha técnica incluye datos del cliente, variables financieras, saldos,
              tabla de amortización y más.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={verHTML} className="gradient-primary text-white">
              <FileText className="w-4 h-4 mr-2" />
              Ver ficha técnica (HTML)
            </Button>
            <Button onClick={descargarJSON} variant="outline">
              <FileJson className="w-4 h-4 mr-2" />
              Descargar JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center mb-3">
              <Info className="w-5 h-5 text-violet-300" />
            </div>
            <h3 className="font-semibold mb-2">Datos del Cliente</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Nombre, cédula, contacto</li>
              <li>• Departamento y municipio</li>
              <li>• Categoría asignada</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-cyan-300" />
            </div>
            <h3 className="font-semibold mb-2">Variables Financieras</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Monto principal y cuota</li>
              <li>• Tasa anual y moratoria</li>
              <li>• Plazo y frecuencia</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-3">
              <Calendar className="w-5 h-5 text-emerald-300" />
            </div>
            <h3 className="font-semibold mb-2">Saldos y Mora</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Capital, interés y total</li>
              <li>• Cuotas pagadas</li>
              <li>• Días y monto de mora</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <h3 className="font-semibold mb-2">Tabla de Amortización</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Cronograma completo</li>
              <li>• Vencimientos por cuota</li>
              <li>• Capital + interés</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 text-rose-300" />
            </div>
            <h3 className="font-semibold mb-2">Firmas y Legales</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Firma electrónica registrada</li>
              <li>• Caso jurídico (si existe)</li>
              <li>• Cuenta de recaudo</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center mb-3">
              <FileJson className="w-5 h-5 text-indigo-300" />
            </div>
            <h3 className="font-semibold mb-2">Formatos Disponibles</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• HTML imprimible (A4)</li>
              <li>• JSON estructurado</li>
              <li>• Compatible con PDF</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recomendaciones */}
      <Card className="glass-card border-amber-400/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-300">
            <Lightbulb className="w-5 h-5" />
            Recomendaciones de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">✅ Buenas prácticas</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Genera la ficha técnica antes de cualquier modificación al solicitud.</li>
                <li>• Usa el formato HTML para imprimir o compartir con el cliente.</li>
                <li>• El formato JSON es ideal para integraciones y respaldos.</li>
                <li>• La ficha refleja el estado actual al momento de la consulta.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">🔒 Seguridad</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• La ficha HTML puede compartirse mediante enlace firmado.</li>
                <li>• No incluye datos sensibles como tokens o contraseñas.</li>
                <li>• Valida siempre el código del solicitud antes de generar.</li>
                <li>• Archiva las fichas en el expediente del cliente.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
