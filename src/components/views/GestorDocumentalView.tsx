'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import {
  FolderOpen, Upload, Search, Trash2, Eye, FileImage,
  MessageSquare, User, CreditCard, Receipt, File, X, Download,
} from 'lucide-react'

interface Documento {
  id: string
  prestamoId: string | null
  prestamoCodigo: string | null
  clienteId: string | null
  clienteNombre: string | null
  clienteCedula: string | null
  tipo: string
  titulo: string
  descripcion: string | null
  archivoNombre: string
  archivoTipo: string
  archivoTamano: number
  subidoPor: string | null
  fechaSubida: string
  tieneArchivo: boolean
}

const TIPO_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  FOTO_CLIENTE: { label: 'Foto del Cliente', icon: User, color: 'bg-blue-100 text-blue-700' },
  PANTALLAZO_CONVERSACION: { label: 'Pantallazo Conversación', icon: MessageSquare, color: 'bg-purple-100 text-purple-700' },
  FOTO_DOCUMENTO: { label: 'Foto Documento', icon: CreditCard, color: 'bg-amber-100 text-amber-700' },
  FOTO_SELFI: { label: 'Selfie con Cédula', icon: FileImage, color: 'bg-emerald-100 text-emerald-700' },
  COMPROBANTE_PAGO: { label: 'Comprobante de Pago', icon: Receipt, color: 'bg-cyan-100 text-cyan-700' },
  OTRO: { label: 'Otro', icon: File, color: 'bg-gray-100 text-gray-700' },
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function GestorDocumentalView() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [prestamos, setPrestamos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSubir, setModalSubir] = useState(false)
  const [modalVer, setModalVer] = useState<Documento | null>(null)
  const [imagenVer, setImagenVer] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('all')
  const [filtroPrestamo, setFiltroPrestamo] = useState('all')
  const { toast } = useToast()

  const [prestamoSel, setPrestamoSel] = useState('')
  const [tipoDoc, setTipoDoc] = useState('FOTO_CLIENTE')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState<string | null>(null)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [archivoTipo, setArchivoTipo] = useState('')
  const [archivoTamano, setArchivoTamano] = useState(0)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => { cargar(); cargarPrestamos() }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/documentos')
      const json = await res.json()
      if (json.success) setDocumentos(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cargarPrestamos = async () => {
    try {
      const res = await fetch('/api/prestamos')
      const json = await res.json()
      if (json.success) setPrestamos(json.data)
    } catch (e) { console.error(e) }
  }

  const documentosFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      const matchBusqueda = !busqueda ||
        d.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.descripcion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.clienteNombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.prestamoCodigo || '').toLowerCase().includes(busqueda.toLowerCase())
      const matchTipo = filtroTipo === 'all' || d.tipo === filtroTipo
      const matchPrestamo = filtroPrestamo === 'all' || d.prestamoId === filtroPrestamo
      return matchBusqueda && matchTipo && matchPrestamo
    })
  }, [documentos, busqueda, filtroTipo, filtroPrestamo])

  const manejarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Solo se permiten imágenes', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no puede superar 10MB', variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setArchivo(reader.result as string)
      setArchivoNombre(file.name)
      setArchivoTipo(file.type)
      setArchivoTamano(file.size)
    }
    reader.readAsDataURL(file)
  }

  const subirDocumento = async () => {
    if (!titulo || !archivo) {
      toast({ title: 'Error', description: 'Título y archivo son obligatorios', variant: 'destructive' })
      return
    }
    setSubiendo(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prestamoId: prestamoSel || null,
          tipo: tipoDoc,
          titulo, descripcion,
          archivoBase64: archivo,
          archivoNombre, archivoTipo, archivoTamano,
          subidoPor: 'Admin',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: '✅ Documento subido', description: json.mensaje, duration: 5000 })
        setModalSubir(false)
        setTitulo(''); setDescripcion(''); setArchivo(null); setArchivoNombre(''); setPrestamoSel('')
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally { setSubiendo(false) }
  }

  const verDocumento = async (doc: Documento) => {
    try {
      const res = await fetch(`/api/documentos/${doc.id}`)
      const json = await res.json()
      if (json.success) {
        setModalVer(doc)
        setImagenVer(json.data.archivoBase64)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminarDocumento = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    try {
      const res = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Documento eliminado' })
        if (modalVer?.id === doc.id) { setModalVer(null); setImagenVer(null) }
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const descargarDocumento = async (doc: Documento) => {
    try {
      const res = await fetch(`/api/documentos/${doc.id}`)
      const json = await res.json()
      if (json.success) {
        const link = document.createElement('a')
        link.href = json.data.archivoBase64
        link.download = doc.archivoNombre || doc.titulo
        link.click()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Gestor Documental
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fotos de clientes, pantallazos de conversaciones y documentos vinculados a préstamos
          </p>
        </div>
        <Button size="sm" onClick={() => setModalSubir(true)}>
          <Upload className="w-4 h-4 mr-2" /> Subir Documento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, cliente, préstamo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroPrestamo} onValueChange={setFiltroPrestamo}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Préstamo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los préstamos</SelectItem>
            {prestamos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.cliente?.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Préstamo / Cliente</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : documentosFiltrados.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay documentos.</TableCell></TableRow>
              ) : (
                documentosFiltrados.map((d) => {
                  const cfg = TIPO_CONFIG[d.tipo] || TIPO_CONFIG.OTRO
                  const Icon = cfg.icon
                  return (
                    <TableRow key={d.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${cfg.color}`}><Icon className="w-4 h-4" /></div>
                          <span className="text-xs">{cfg.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{d.titulo}</div>
                        {d.descripcion && <div className="text-xs text-muted-foreground truncate max-w-xs">{d.descripcion}</div>}
                      </TableCell>
                      <TableCell>
                        {d.prestamoCodigo ? (
                          <div><div className="font-mono text-xs">{d.prestamoCodigo}</div><div className="text-xs text-muted-foreground">{d.clienteNombre}</div></div>
                        ) : d.clienteNombre ? <div className="text-sm">{d.clienteNombre}</div> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="truncate max-w-[120px]">{d.archivoNombre}</div>
                        <div className="text-muted-foreground">{formatearTamano(d.archivoTamano)}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatearFechaHora(d.fechaSubida)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => verDocumento(d)} title="Ver"><Eye className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => descargarDocumento(d)} title="Descargar"><Download className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => eliminarDocumento(d)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalSubir} onOpenChange={setModalSubir}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Subir Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Préstamo relacionado (opcional)</Label>
              <Select value={prestamoSel} onValueChange={setPrestamoSel}>
                <SelectTrigger><SelectValue placeholder="Selecciona un préstamo..." /></SelectTrigger>
                <SelectContent>
                  {prestamos.map((p) => (<SelectItem key={p.id} value={p.id}>{p.codigo} — {p.cliente?.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Si seleccionas un préstamo, el documento se registrará en su bitácora.</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (<SelectItem key={key} value={key}>{cfg.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Foto cédula cliente - frente" required />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div className="space-y-2">
              <Label>Archivo (imagen) *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center space-y-2">
                {archivo ? (
                  <div className="space-y-2">
                    <img src={archivo} alt="preview" className="max-h-32 mx-auto rounded" />
                    <p className="text-xs text-muted-foreground">{archivoNombre} ({formatearTamano(archivoTamano)})</p>
                    <Button size="sm" variant="outline" onClick={() => { setArchivo(null); setArchivoNombre('') }}><X className="w-3 h-3 mr-1" /> Quitar</Button>
                  </div>
                ) : (
                  <>
                    <FileImage className="w-8 h-8 mx-auto text-gray-400" />
                    <Button size="sm" variant="outline" asChild>
                      <label className="cursor-pointer"><Upload className="w-3.5 h-3.5 mr-1.5" /> Seleccionar imagen<input type="file" accept="image/*" className="hidden" onChange={manejarArchivo} /></label>
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG - máx 10MB</p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalSubir(false)}>Cancelar</Button>
              <Button onClick={subirDocumento} disabled={!titulo || !archivo || subiendo}>{subiendo ? 'Subiendo...' : 'Subir Documento'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalVer} onOpenChange={(open) => { if (!open) { setModalVer(null); setImagenVer(null) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> {modalVer?.titulo}</DialogTitle>
          </DialogHeader>
          {modalVer && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded bg-muted/50">
                <div><span className="text-muted-foreground">Tipo:</span> <strong>{TIPO_CONFIG[modalVer.tipo]?.label || modalVer.tipo}</strong></div>
                <div><span className="text-muted-foreground">Préstamo:</span> <strong className="font-mono">{modalVer.prestamoCodigo || '—'}</strong></div>
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{modalVer.clienteNombre || '—'}</strong></div>
                <div><span className="text-muted-foreground">Subido por:</span> <strong>{modalVer.subidoPor || '—'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Fecha:</span> <strong>{formatearFechaHora(modalVer.fechaSubida)}</strong></div>
                {modalVer.descripcion && <div className="col-span-2"><span className="text-muted-foreground">Descripción:</span> {modalVer.descripcion}</div>}
              </div>
              {imagenVer && <div className="flex justify-center"><img src={imagenVer} alt={modalVer.titulo} className="max-h-[60vh] rounded-lg border" /></div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => descargarDocumento(modalVer)}><Download className="w-4 h-4 mr-1.5" /> Descargar</Button>
                <Button variant="destructive" size="sm" onClick={() => { eliminarDocumento(modalVer); setModalVer(null) }}><Trash2 className="w-4 h-4 mr-1.5" /> Eliminar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
