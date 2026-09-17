'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import {
  GitBranch,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Copy,
  Eye,
  RotateCcw,
  GitCompare,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileCode,
  Package,
  Clock,
  HardDrive,
  Shield,
} from 'lucide-react'

interface Snapshot {
  id: string
  uuid: string
  version: string
  nombre: string
  descripcion: string | null
  estado: string
  tamano: number
  rutaArchivo: string
  checksum: string | null
  archivosTotal: number
  modulosAfectados: string | null
  tipo: string
  usuarioId: string | null
  usuarioNombre: string | null
  motivo: string | null
  metadata: string | null
  createdAt: string
}

const ESTADOS = {
  COMPLETADO: { label: 'Completado', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  FALLIDO: { label: 'Fallido', color: 'bg-red-500/15 text-red-300 border-red-400/40' },
  RESTAURADO: { label: 'Restaurado', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
}

const TIPOS = {
  MANUAL: { label: 'Manual', color: 'bg-blue-500/15 text-blue-300' },
  AUTO_PRE_CAMBIO: { label: 'Auto (pre-cambio)', color: 'bg-amber-500/15 text-amber-300' },
  AUTO_PRE_REFACTOR: { label: 'Auto (pre-refactor)', color: 'bg-violet-500/15 text-violet-300' },
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatearFechaHora(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' })
}

export function SnapshotsProyectoView() {
  const { toast } = useToast()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [modalDetalles, setModalDetalles] = useState<Snapshot | null>(null)
  const [modalComparar, setModalComparar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [compararResult, setCompararResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form crear
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    version: '',
  })

  // Comparar
  const [compararA, setCompararA] = useState('')
  const [compararB, setCompararB] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/snapshots', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setSnapshots(json.data || [])
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrirCrear = () => {
    // Sugerir versión
    const ultimaVersion = snapshots[0]?.version || '1.0.0'
    const parts = ultimaVersion.split('.').map(Number)
    const sugerida = parts.length === 3 ? `${parts[0]}.${parts[1]}.${parts[2] + 1}` : '1.0.1'
    setForm({
      nombre: `Snapshot ${new Date().toLocaleString('es-CO', { dateStyle: 'short' })}`,
      descripcion: '',
      version: sugerida,
    })
    setModalCrear(true)
  }

  const crear = async () => {
    if (!form.nombre || form.nombre.length < 3) {
      toast({ title: 'Nombre muy corto', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Snapshot creado', description: json.mensaje })
        setModalCrear(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const restaurar = async (snap: Snapshot) => {
    if (!confirm(`¿Restaurar el snapshot ${snap.version}? Se creará un snapshot automático del estado actual antes de restaurar.`)) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/snapshots/${snap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'restaurar' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Snapshot restaurado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const duplicar = async (snap: Snapshot) => {
    setEnviando(true)
    try {
      const res = await fetch(`/api/snapshots/${snap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'duplicar' }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Snapshot duplicado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const exportar = async (snap: Snapshot) => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/api/snapshots?descargar=${snap.uuid}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        toast({ title: 'Error al exportar', description: errJson.error || `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `snapshot_${snap.uuid}.json`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: 'Error al exportar', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (snap: Snapshot) => {
    if (!confirm(`¿Eliminar el snapshot ${snap.version}? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/snapshots/${snap.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Snapshot eliminado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const verDetalles = async (snap: Snapshot) => {
    try {
      const res = await fetch(`/api/snapshots/${snap.id}`)
      const json = await res.json()
      if (json.success) {
        setModalDetalles({ ...snap, ...json.data })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const comparar = async () => {
    if (!compararA || !compararB) {
      toast({ title: 'Selecciona dos snapshots', variant: 'destructive' })
      return
    }
    if (compararA === compararB) {
      toast({ title: 'Selecciona snapshots diferentes', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`/api/snapshots/${compararA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'comparar', compararCon: compararB }),
      })
      const json = await res.json()
      if (json.success) {
        setCompararResult(json.data)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      const texto = await file.text()
      const res = await fetch(`/api/snapshots/${snapshots[0]?.id || 'temp'}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'importar', contenido: texto }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Snapshot importado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error al importar', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control de Versiones y Snapshots"
        subtitle="Protección integral del proyecto: captura, restaura y compara el estado completo del código"
        icon={<GitBranch className="w-5 h-5" />}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={importar}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={enviando}>
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModalComparar(true)}>
              <GitCompare className="w-4 h-4 mr-2" />
              Comparar
            </Button>
            <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
            <Button size="sm" onClick={abrirCrear}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Snapshot
            </Button>
          </>
        }
      />

      {/* Banner de protección */}
      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-violet-200 mb-1">Protección del Proyecto Activada</p>
              <p className="text-xs text-violet-100/80">
                Cada snapshot captura {snapshots[0]?.archivosTotal || '~200'} archivos del código fuente + configuración.
                Antes de cualquier restauración se crea automáticamente un snapshot de seguridad.
                La IA debe crear un snapshot antes de modificar código estructural.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
              <GitBranch className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-2xl font-bold text-primary">{snapshots.length}</span>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Manuales</span>
              <Plus className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-blue-400">
              {snapshots.filter(s => s.tipo === 'MANUAL').length}
            </span>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Automáticos</span>
              <Shield className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-amber-400">
              {snapshots.filter(s => s.tipo !== 'MANUAL').length}
            </span>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Almacenado</span>
              <HardDrive className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-sm font-bold text-violet-400">
              {formatearTamano(snapshots.reduce((s, snap) => s + snap.tamano, 0))}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de snapshots */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Historial de Snapshots ({snapshots.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p>Cargando snapshots...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No hay snapshots. Crea el primero para proteger el proyecto.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versión</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>UUID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Archivos</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <span className="font-mono text-sm font-bold text-primary">v{s.version}</span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{s.nombre}</p>
                        {s.descripcion && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-xs">{s.descripcion}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[10px] text-muted-foreground">{s.uuid.substring(0, 8)}...</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${TIPOS[s.tipo as keyof typeof TIPOS]?.color || ''}`}>
                          {TIPOS[s.tipo as keyof typeof TIPOS]?.label || s.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${ESTADOS[s.estado as keyof typeof ESTADOS]?.color || ''}`}>
                          {ESTADOS[s.estado as keyof typeof ESTADOS]?.label || s.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{s.archivosTotal}</TableCell>
                      <TableCell className="text-xs">{formatearTamano(s.tamano)}</TableCell>
                      <TableCell className="text-xs">{s.usuarioNombre || '—'}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{formatearFechaHora(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => verDetalles(s)} title="Ver detalles">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => restaurar(s)} title="Restaurar" disabled={enviando}>
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => exportar(s)} title="Exportar">
                            <Download className="w-3.5 h-3.5 text-blue-400" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => duplicar(s)} title="Duplicar">
                            <Copy className="w-3.5 h-3.5 text-violet-400" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => eliminar(s)} title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Crear */}
      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Snapshot del Proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs text-blue-700 dark:text-blue-300">
              El snapshot capturará todo el código fuente (src/), archivos de configuración (package.json, schema.prisma, next.config.ts, etc.) y la estructura del proyecto.
            </div>
            <div className="space-y-2">
              <Label>Versión *</Label>
              <Input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="Ej: 1.0.25"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Antes de modificar el módulo de préstamos"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Describe qué cambios se van a realizar después de este snapshot..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={enviando}>
              {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando...</> : 'Crear Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalles */}
      <Dialog open={!!modalDetalles} onOpenChange={(o) => !o && setModalDetalles(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Snapshot {modalDetalles?.version}</DialogTitle>
          </DialogHeader>
          {modalDetalles && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">UUID</p>
                  <p className="font-mono text-xs break-all">{modalDetalles.uuid}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Checksum</p>
                  <p className="font-mono text-xs break-all">{modalDetalles.checksum?.substring(0, 32)}...</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted/50 rounded-md text-center">
                  <FileCode className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{modalDetalles.archivosTotal}</p>
                  <p className="text-[10px] text-muted-foreground">Archivos</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md text-center">
                  <HardDrive className="w-5 h-5 mx-auto mb-1 text-violet-400" />
                  <p className="text-lg font-bold">{formatearTamano(modalDetalles.tamano)}</p>
                  <p className="text-[10px] text-muted-foreground">Tamaño</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <p className="text-xs font-bold">{formatearFechaHora(modalDetalles.createdAt)}</p>
                  <p className="text-[10px] text-muted-foreground">Fecha</p>
                </div>
              </div>
              {modalDetalles.modulosAfectados && (
                <div>
                  <p className="text-xs font-semibold mb-2">Módulos Capturados</p>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      try {
                        const mods = JSON.parse(modalDetalles.modulosAfectados)
                        return mods.map((m: string) => (
                          <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                        ))
                      } catch {
                        return <span className="text-xs text-muted-foreground">N/A</span>
                      }
                    })()}
                  </div>
                </div>
              )}
              {modalDetalles.descripcion && (
                <div>
                  <p className="text-xs font-semibold mb-1">Descripción</p>
                  <p className="text-sm text-muted-foreground">{modalDetalles.descripcion}</p>
                </div>
              )}
              {modalDetalles.motivo && (
                <div>
                  <p className="text-xs font-semibold mb-1">Motivo</p>
                  <Badge variant="outline" className="text-[10px]">{modalDetalles.motivo}</Badge>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalles(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Comparar */}
      <Dialog open={modalComparar} onOpenChange={setModalComparar}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparar Snapshots</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Snapshot A (anterior)</Label>
                <select
                  className="w-full p-2 rounded-md border border-border bg-background text-sm"
                  value={compararA}
                  onChange={(e) => setCompararA(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {snapshots.map(s => (
                    <option key={s.id} value={s.id}>v{s.version} — {s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Snapshot B (posterior)</Label>
                <select
                  className="w-full p-2 rounded-md border border-border bg-background text-sm"
                  value={compararB}
                  onChange={(e) => setCompararB(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {snapshots.map(s => (
                    <option key={s.id} value={s.id}>v{s.version} — {s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={comparar} disabled={enviando || !compararA || !compararB} className="w-full">
              {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Comparando...</> : <><GitCompare className="w-4 h-4 mr-2" /> Comparar</>}
            </Button>

            {compararResult && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-500/10 rounded-md text-center border border-emerald-500/20">
                    <Plus className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                    <p className="text-lg font-bold text-emerald-400">{compararResult.agregados.length}</p>
                    <p className="text-[10px] text-muted-foreground">Agregados</p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-md text-center border border-red-500/20">
                    <Trash2 className="w-5 h-5 mx-auto mb-1 text-red-400" />
                    <p className="text-lg font-bold text-red-400">{compararResult.eliminados.length}</p>
                    <p className="text-[10px] text-muted-foreground">Eliminados</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-md text-center border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                    <p className="text-lg font-bold text-amber-400">{compararResult.modificados.length}</p>
                    <p className="text-[10px] text-muted-foreground">Modificados</p>
                  </div>
                </div>

                {compararResult.modulosAfectados.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Módulos Afectados</p>
                    <div className="flex flex-wrap gap-1">
                      {compararResult.modulosAfectados.map((m: string) => (
                        <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {compararResult.agregados.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1 text-emerald-400">Archivos Agregados</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {compararResult.agregados.map((f: string) => (
                        <p key={f} className="text-[10px] font-mono text-emerald-300">+ {f}</p>
                      ))}
                    </div>
                  </div>
                )}
                {compararResult.eliminados.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1 text-red-400">Archivos Eliminados</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {compararResult.eliminados.map((f: string) => (
                        <p key={f} className="text-[10px] font-mono text-red-300">- {f}</p>
                      ))}
                    </div>
                  </div>
                )}
                {compararResult.modificados.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1 text-amber-400">Archivos Modificados</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {compararResult.modificados.map((f: string) => (
                        <p key={f} className="text-[10px] font-mono text-amber-300">~ {f}</p>
                      ))}
                    </div>
                  </div>
                )}
                {compararResult.totalCambios === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm text-muted-foreground">No hay diferencias entre los snapshots</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalComparar(false); setCompararResult(null) }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
