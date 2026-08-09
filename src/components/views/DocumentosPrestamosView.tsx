'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora, formatearMoneda } from '@/lib/finanzas'
import {
  FolderOpen, Upload, Search, Trash2, Eye, FileImage,
  MessageSquare, User, CreditCard, Receipt, File, X, Download,
  FileText, ShieldCheck, PenTool, Camera, FileCheck, ExternalLink,
  RefreshCw, Filter, CheckCircle,
} from 'lucide-react'

// =====================================================
// DocumentosPrestamosView
// Gestor documental integrado en el módulo Préstamos.
// Muestra en pestañas separadas:
//  1. Documentos subidos manualmente (DocumentoGestor)
//  2. Firmas electrónicas con fotos selfie + firma dibujada (FirmaElectronica)
//  3. Generación de pagarés y cartas (HTML imprimible)
// =====================================================

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

interface Firma {
  id: string
  prestamoId: string | null
  prestamoCodigo: string | null
  clienteId: string | null
  clienteNombre: string | null
  clienteCedula: string | null
  tipo: string
  estadoFirma: string
  esFirmaCodeudor: boolean
  firmanteRol: string | null
  firmanteNombre: string | null
  firmanteCedula: string | null
  tieneSelfie: boolean
  tieneFotoDocumento: boolean
  tieneFirmaDibujada: boolean
  otpCanal: string | null
  otpValidado: boolean
  otpFechaEnvio: string | null
  otpFechaValidacion: string | null
  intentosOTP: number
  ipFirma: string | null
  userAgent: string | null
  fechaFirmaCompleta: string | null
  createdAt: string
}

interface PrestamoLista {
  id: string
  codigo: string
  cliente?: { nombre: string; cedula: string }
  montoPrincipal: number
  estado: string
}

const TIPO_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  FOTO_CLIENTE: { label: 'Foto del Cliente', icon: User, color: 'bg-blue-100 text-blue-700' },
  PANTALLAZO_CONVERSACION: { label: 'Pantallazo Conversación', icon: MessageSquare, color: 'bg-purple-100 text-purple-700' },
  FOTO_DOCUMENTO: { label: 'Foto Documento', icon: CreditCard, color: 'bg-amber-100 text-amber-700' },
  FOTO_SELFI: { label: 'Selfie con Cédula', icon: FileImage, color: 'bg-emerald-100 text-emerald-700' },
  COMPROBANTE_PAGO: { label: 'Comprobante de Pago', icon: Receipt, color: 'bg-cyan-100 text-cyan-700' },
  PAGARE_FIRMA: { label: 'Pagaré firmado', icon: FileCheck, color: 'bg-rose-100 text-rose-700' },
  CARTA_INSTRUCCIONES: { label: 'Carta de Instrucciones', icon: FileText, color: 'bg-indigo-100 text-indigo-700' },
  CERTIFICADO_FIRMA: { label: 'Certificado de Firma', icon: ShieldCheck, color: 'bg-teal-100 text-teal-700' },
  OTRO: { label: 'Otro', icon: File, color: 'bg-gray-100 text-gray-700' },
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function DocumentosPrestamosView() {
  const [tab, setTab] = useState('gestor')
  const { toast } = useToast()
  const [exportando, setExportando] = useState(false)

  async function exportarExcelConsolidado() {
    try {
      setExportando(true)
      toast({ title: 'Generando Excel...', description: 'Esto puede tardar 30-60 segundos si hay muchas fotos.' })
      const res = await fetch('/api/documentos/exportar-excel', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().split('T')[0]
      a.download = `documentos-prestamos-${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: '✅ Excel descargado', description: 'Consolidado de documentos generado correctamente.' })
    } catch (e: any) {
      toast({ title: '❌ Error al exportar', description: e.message, variant: 'destructive' })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            Gestor Documental de Préstamos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pagarés, cartas, fotos selfie, firmas electrónicas y documentos vinculados a préstamos
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportarExcelConsolidado}
          disabled={exportando}
          className="bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/60"
          title="Descargar Excel consolidado con todas las fotos y metadatos"
        >
          <Download className={`w-4 h-4 mr-1.5 ${exportando ? 'animate-pulse' : ''}`} />
          {exportando ? 'Generando...' : 'Exportar Excel consolidado'}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="gestor">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="firmas">
            <PenTool className="w-3.5 h-3.5 mr-1.5" />
            Firmas y Selfies
          </TabsTrigger>
          <TabsTrigger value="generar">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Generar Pagaré/Carta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gestor" className="mt-4">
          <GestorDocumentosTab />
        </TabsContent>

        <TabsContent value="firmas" className="mt-4">
          <FirmasElectronicasTab />
        </TabsContent>

        <TabsContent value="generar" className="mt-4">
          <GenerarDocumentosTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// TAB 1: Gestor de Documentos (subidos manualmente)
// =====================================================
function GestorDocumentosTab() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [prestamos, setPrestamos] = useState<PrestamoLista[]>([])
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

  // Debounce 300ms para la búsqueda: evita disparar fetch en cada keystroke
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [busquedaDebounced, setBusquedaDebounced] = useState(busqueda)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusquedaDebounced(busqueda), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  useEffect(() => {
    cargar()
    cargarPrestamos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebounced, filtroTipo, filtroPrestamo])

  const cargar = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ accion: 'listar' })
      if (busquedaDebounced) params.set('q', busquedaDebounced)
      if (filtroTipo !== 'all') params.set('tipo', filtroTipo)
      if (filtroPrestamo !== 'all') params.set('prestamoId', filtroPrestamo)
      const res = await fetch(`/api/documentos?${params.toString()}`)
      const json = await res.json()
      if (json.success) setDocumentos(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cargarPrestamos = async () => {
    try {
      const res = await fetch('/api/prestamos')
      const json = await res.json()
      if (json.success) setPrestamos(json.data)
    } catch (e) {
      console.error(e)
    }
  }

  const manejarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({ title: 'Error', description: 'Solo se permiten imágenes o PDF', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'El archivo no puede superar 10MB', variant: 'destructive' })
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
          titulo,
          descripcion,
          archivoBase64: archivo,
          archivoNombre,
          archivoTipo,
          archivoTamano,
          subidoPor: 'Admin',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: '✅ Documento subido', description: json.mensaje, duration: 5000 })
        setModalSubir(false)
        setTitulo('')
        setDescripcion('')
        setArchivo(null)
        setArchivoNombre('')
        setPrestamoSel('')
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubiendo(false)
    }
  }

  const verDocumento = async (doc: Documento) => {
    try {
      const res = await fetch(`/api/documentos/${doc.id}`)
      const json = await res.json()
      if (json.success) {
        setModalVer(doc)
        setImagenVer(json.data.archivoBase64)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
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
        if (modalVer?.id === doc.id) {
          setModalVer(null)
          setImagenVer(null)
        }
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const descargarDocumento = (doc: Documento) => {
    window.open(`/api/documentos/${doc.id}?accion=descargar`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <FolderOpen className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Total documentos</p>
            <p className="text-lg font-bold">{documentos.length}</p>
          </CardContent>
        </Card>
        {['FOTO_SELFI', 'FOTO_DOCUMENTO', 'COMPROBANTE_PAGO', 'FOTO_CLIENTE'].map((t) => {
          const cfg = TIPO_CONFIG[t]
          const Icon = cfg.icon
          const count = documentos.filter((d) => d.tipo === t).length
          return (
            <Card key={t}>
              <CardContent className="p-3 text-center">
                <Icon className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className="text-lg font-bold">{count}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente, préstamo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroPrestamo} onValueChange={setFiltroPrestamo}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Préstamo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los préstamos</SelectItem>
            {prestamos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.codigo} — {p.cliente?.nombre || 'N/A'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={cargar} title="Recargar">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" onClick={() => setModalSubir(true)}>
          <Upload className="w-4 h-4 mr-2" /> Subir
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Préstamo / Cliente</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : documentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No hay documentos subidos todavía.</p>
                    <p className="text-xs mt-1">
                      Las fotos selfie con cédula se suben automáticamente al aceptar T&C.
                      Para subir documentos manuales, usa el botón <strong>"Subir"</strong>.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                documentos.map((d) => {
                  const cfg = TIPO_CONFIG[d.tipo] || TIPO_CONFIG.OTRO
                  const Icon = cfg.icon
                  return (
                    <TableRow key={d.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${cfg.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs">{cfg.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{d.titulo}</div>
                        {d.descripcion && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">
                            {d.descripcion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.prestamoCodigo ? (
                          <div>
                            <div className="font-mono text-xs">{d.prestamoCodigo}</div>
                            <div className="text-xs text-muted-foreground">{d.clienteNombre}</div>
                          </div>
                        ) : d.clienteNombre ? (
                          <div className="text-sm">
                            {d.clienteNombre}
                            <div className="text-xs text-muted-foreground">{d.clienteCedula}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="truncate max-w-[120px]">{d.archivoNombre}</div>
                        <div className="text-muted-foreground">{formatearTamano(d.archivoTamano)}</div>
                      </TableCell>
                      <TableCell className="text-xs">{d.subidoPor || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatearFechaHora(d.fechaSubida)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => verDocumento(d)} title="Ver">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => descargarDocumento(d)} title="Descargar">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => eliminarDocumento(d)}
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
        </CardContent>
      </Card>

      {/* Modal Subir */}
      <Dialog open={modalSubir} onOpenChange={setModalSubir}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Subir Documento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Préstamo relacionado (opcional)</Label>
              <Select value={prestamoSel} onValueChange={setPrestamoSel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un préstamo..." />
                </SelectTrigger>
                <SelectContent>
                  {prestamos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} — {p.cliente?.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si seleccionas un préstamo, el documento se registrará en su bitácora y se vinculará al cliente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Foto cédula cliente - frente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Observaciones..."
              />
            </div>
            <div className="space-y-2">
              <Label>Archivo (imagen o PDF) *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center space-y-2">
                {archivo ? (
                  <div className="space-y-2">
                    {archivoTipo.startsWith('image/') ? (
                      <img src={archivo} alt="preview" className="max-h-32 mx-auto rounded" />
                    ) : (
                      <FileText className="w-12 h-12 mx-auto text-red-600" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {archivoNombre} ({formatearTamano(archivoTamano)})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setArchivo(null)
                        setArchivoNombre('')
                      }}
                    >
                      <X className="w-3 h-3 mr-1" /> Quitar
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileImage className="w-8 h-8 mx-auto text-gray-400" />
                    <Button size="sm" variant="outline" asChild>
                      <label className="cursor-pointer">
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Seleccionar archivo
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={manejarArchivo}
                        />
                      </label>
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG, PDF - máx 10MB</p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalSubir(false)}>
                Cancelar
              </Button>
              <Button onClick={subirDocumento} disabled={!titulo || !archivo || subiendo}>
                {subiendo ? 'Subiendo...' : 'Subir Documento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Ver */}
      <Dialog
        open={!!modalVer}
        onOpenChange={(open) => {
          if (!open) {
            setModalVer(null)
            setImagenVer(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> {modalVer?.titulo}
            </DialogTitle>
          </DialogHeader>
          {modalVer && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded bg-muted/50">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{' '}
                  <strong>{TIPO_CONFIG[modalVer.tipo]?.label || modalVer.tipo}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Préstamo:</span>{' '}
                  <strong className="font-mono">{modalVer.prestamoCodigo || '—'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente:</span>{' '}
                  <strong>{modalVer.clienteNombre || '—'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Subido por:</span>{' '}
                  <strong>{modalVer.subidoPor || '—'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Fecha:</span>{' '}
                  <strong>{formatearFechaHora(modalVer.fechaSubida)}</strong>
                </div>
                {modalVer.descripcion && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Descripción:</span> {modalVer.descripcion}
                  </div>
                )}
              </div>
              {imagenVer && imagenVer.startsWith('data:image/') && (
                <div className="flex justify-center">
                  <img
                    src={imagenVer}
                    alt={modalVer.titulo}
                    className="max-h-[60vh] rounded-lg border"
                  />
                </div>
              )}
              {imagenVer && imagenVer.startsWith('data:application/pdf') && (
                <div className="flex justify-center">
                  <iframe src={imagenVer} className="w-full h-[60vh] rounded-lg border" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => descargarDocumento(modalVer)}>
                  <Download className="w-4 h-4 mr-1.5" /> Descargar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    eliminarDocumento(modalVer)
                    setModalVer(null)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// TAB 2: Firmas Electrónicas con fotos selfie y firma dibujada
// =====================================================
function FirmasElectronicasTab() {
  const [firmas, setFirmas] = useState<Firma[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [modalVer, setModalVer] = useState<Firma | null>(null)
  const [detalleFirma, setDetalleFirma] = useState<any>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const { toast } = useToast()

  // Debounce 300ms en búsqueda de firmas
  const debounceFirmasRef = useRef<NodeJS.Timeout | null>(null)
  const [busquedaDebouncedFirmas, setBusquedaDebouncedFirmas] = useState(busqueda)
  useEffect(() => {
    if (debounceFirmasRef.current) clearTimeout(debounceFirmasRef.current)
    debounceFirmasRef.current = setTimeout(() => setBusquedaDebouncedFirmas(busqueda), 300)
    return () => { if (debounceFirmasRef.current) clearTimeout(debounceFirmasRef.current) }
  }, [busqueda])

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebouncedFirmas, filtroEstado])

  const cargar = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (busquedaDebouncedFirmas) params.set('q', busquedaDebouncedFirmas)
      if (filtroEstado !== 'all') params.set('estado', filtroEstado)
      const res = await fetch(`/api/documentos/firmas?${params.toString()}`)
      const json = await res.json()
      if (json.success) setFirmas(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const verFirma = async (f: Firma) => {
    setModalVer(f)
    setDetalleFirma(null)
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/documentos/firmas?accion=detalle&id=${f.id}`)
      const json = await res.json()
      if (json.success) setDetalleFirma(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoadingDetalle(false)
    }
  }

  const descargarFoto = (campo: 'fotoSelfie' | 'fotoDocumento' | 'imagenFirma') => {
    if (!detalleFirma || !detalleFirma[campo]) return
    const link = document.createElement('a')
    link.href = detalleFirma[campo]
    const ext = detalleFirma[campo].includes('image/png') ? 'png' : 'jpg'
    const nombre =
      campo === 'fotoSelfie'
        ? `selfie_${detalleFirma.firmanteNombre || detalleFirma.cliente?.cedula || 'cliente'}.${ext}`
        : campo === 'fotoDocumento'
        ? `documento_${detalleFirma.firmanteNombre || 'cliente'}.${ext}`
        : `firma_${detalleFirma.firmanteNombre || 'cliente'}.png`
    link.download = nombre
    link.click()
  }

  const verCertificado = (firmaId: string) => {
    window.open(`/api/firma/certificado?firmaId=${firmaId}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <PenTool className="w-5 h-5 mx-auto text-violet-600 mb-1" />
            <p className="text-xs text-muted-foreground">Total firmas</p>
            <p className="text-lg font-bold">{firmas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <FileCheck className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-xs text-muted-foreground">Completadas</p>
            <p className="text-lg font-bold text-emerald-700">
              {firmas.filter((f) => f.estadoFirma === 'COMPLETADA').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Camera className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Con selfie</p>
            <p className="text-lg font-bold text-blue-700">
              {firmas.filter((f) => f.tieneSelfie).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <PenTool className="w-5 h-5 mx-auto text-rose-600 mb-1" />
            <p className="text-xs text-muted-foreground">Con firma dibujada</p>
            <p className="text-lg font-bold text-rose-700">
              {firmas.filter((f) => f.tieneFirmaDibujada).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ShieldCheck className="w-5 h-5 mx-auto text-amber-600 mb-1" />
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-lg font-bold text-amber-700">
              {firmas.filter((f) => f.estadoFirma === 'PENDIENTE').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, cédula, código de préstamo, firmante..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="COMPLETADA">Completadas</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
            <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
            <SelectItem value="EXPIRADA">Expiradas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={cargar} title="Recargar">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / Firmante</TableHead>
                <TableHead>Préstamo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Selfie / Doc / Firma</TableHead>
                <TableHead>OTP</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando firmas...
                  </TableCell>
                </TableRow>
              ) : firmas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <PenTool className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No hay firmas electrónicas registradas.</p>
                    <p className="text-xs mt-1">
                      Las firmas se generan automáticamente cuando un cliente acepta T&C con OTP y selfie.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                firmas.map((f) => (
                  <TableRow key={f.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium text-sm">
                        {f.firmanteNombre || f.clienteNombre || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {f.firmanteCedula || f.clienteCedula || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {f.prestamoCodigo ? (
                        <span className="font-mono text-xs">{f.prestamoCodigo}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          f.esFirmaCodeudor
                            ? 'text-violet-700 border-violet-300 bg-violet-50 text-[10px]'
                            : 'text-blue-700 border-blue-300 bg-blue-50 text-[10px]'
                        }
                      >
                        {f.firmanteRol || (f.esFirmaCodeudor ? 'CODEUDOR' : 'DEUDOR')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {f.estadoFirma === 'COMPLETADA' && (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" /> Completada
                        </Badge>
                      )}
                      {f.estadoFirma === 'PENDIENTE' && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                          Pendiente
                        </Badge>
                      )}
                      {f.estadoFirma === 'RECHAZADA' && (
                        <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">
                          Rechazada
                        </Badge>
                      )}
                      {f.estadoFirma === 'EXPIRADA' && (
                        <Badge variant="outline" className="text-gray-700 text-[10px]">
                          Expirada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${
                            f.tieneSelfie
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                          title={f.tieneSelfie ? 'Tiene selfie' : 'Sin selfie'}
                        >
                          <Camera className="w-3 h-3" />
                        </span>
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${
                            f.tieneFotoDocumento
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                          title={f.tieneFotoDocumento ? 'Tiene foto del documento' : 'Sin foto doc'}
                        >
                          <CreditCard className="w-3 h-3" />
                        </span>
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${
                            f.tieneFirmaDibujada
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                          title={f.tieneFirmaDibujada ? 'Tiene firma dibujada' : 'Sin firma'}
                        >
                          <PenTool className="w-3 h-3" />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {f.otpValidado ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                          ✓ {f.otpCanal}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">No validado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.fechaFirmaCompleta
                        ? formatearFechaHora(f.fechaFirmaCompleta)
                        : formatearFechaHora(f.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => verFirma(f)} title="Ver fotos y firma">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {f.estadoFirma === 'COMPLETADA' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-violet-700"
                          onClick={() => verCertificado(f.id)}
                          title="Ver certificado de firma"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Ver Firma */}
      <Dialog
        open={!!modalVer}
        onOpenChange={(open) => {
          if (!open) {
            setModalVer(null)
            setDetalleFirma(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-violet-600" />
              {modalVer?.firmanteNombre || modalVer?.clienteNombre || 'Firma'}
              {modalVer?.firmanteRol && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {modalVer.firmanteRol}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {modalVer && (
            <div className="space-y-3">
              {loadingDetalle ? (
                <div className="text-center py-12 text-muted-foreground">Cargando detalle...</div>
              ) : detalleFirma ? (
                <>
                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded bg-muted/50">
                    <div>
                      <span className="text-muted-foreground">Préstamo:</span>{' '}
                      <strong className="font-mono">{detalleFirma.prestamo?.codigo || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cliente:</span>{' '}
                      <strong>{detalleFirma.cliente?.nombre || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cédula:</span>{' '}
                      <strong className="font-mono">{detalleFirma.firmanteCedula || detalleFirma.cliente?.cedula || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estado:</span>{' '}
                      <strong>{detalleFirma.estadoFirma}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OTP canal:</span>{' '}
                      <strong>{detalleFirma.otpCanal || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OTP validado:</span>{' '}
                      <strong>{detalleFirma.otpValidado ? 'Sí' : 'No'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IP firma:</span>{' '}
                      <strong className="font-mono text-xs">{detalleFirma.ipFirma || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">User agent:</span>{' '}
                      <strong className="text-xs truncate">{detalleFirma.userAgent || '—'}</strong>
                    </div>
                    {detalleFirma.geoUbicacion && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Geo:</span>{' '}
                        <strong className="font-mono text-xs">{detalleFirma.geoUbicacion}</strong>
                      </div>
                    )}
                  </div>

                  {/* Fotos + firma */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Selfie */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" /> Selfie con cédula
                      </div>
                      {detalleFirma.fotoSelfie ? (
                        <>
                          <img
                            src={detalleFirma.fotoSelfie}
                            alt="Selfie"
                            className="w-full rounded-lg border max-h-48 object-cover"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => descargarFoto('fotoSelfie')}
                          >
                            <Download className="w-3 h-3 mr-1" /> Descargar
                          </Button>
                        </>
                      ) : (
                        <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">
                          Sin selfie
                        </div>
                      )}
                    </div>

                    {/* Foto documento */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" /> Foto documento
                      </div>
                      {detalleFirma.fotoDocumento ? (
                        <>
                          <img
                            src={detalleFirma.fotoDocumento}
                            alt="Documento"
                            className="w-full rounded-lg border max-h-48 object-cover"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => descargarFoto('fotoDocumento')}
                          >
                            <Download className="w-3 h-3 mr-1" /> Descargar
                          </Button>
                        </>
                      ) : (
                        <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">
                          Sin foto documento
                        </div>
                      )}
                    </div>

                    {/* Firma dibujada */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-1">
                        <PenTool className="w-3.5 h-3.5" /> Firma dibujada
                      </div>
                      {detalleFirma.imagenFirma ? (
                        <>
                          <div className="aspect-square rounded-lg border bg-white flex items-center justify-center p-2">
                            <img
                              src={detalleFirma.imagenFirma}
                              alt="Firma"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => descargarFoto('imagenFirma')}
                          >
                            <Download className="w-3 h-3 mr-1" /> Descargar
                          </Button>
                        </>
                      ) : (
                        <div className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">
                          Sin firma
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón certificado */}
                  {detalleFirma.estadoFirma === 'COMPLETADA' && (
                    <div className="flex justify-center pt-2 border-t">
                      <Button
                        variant="outline"
                        className="text-violet-700 border-violet-300 hover:bg-violet-50"
                        onClick={() => verCertificado(detalleFirma.id)}
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Ver Certificado de Firma Electrónica completo
                        <ExternalLink className="w-3 h-3 ml-2" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No se pudo cargar el detalle
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
// TAB 3: Generar pagarés y cartas (HTML imprimible)
// =====================================================
function GenerarDocumentosTab() {
  const [prestamos, setPrestamos] = useState<PrestamoLista[]>([])
  const [prestamoSel, setPrestamoSel] = useState('')
  const [tipoDoc, setTipoDoc] = useState('pagare-diligenciado')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    cargarPrestamos()
  }, [])

  const cargarPrestamos = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/prestamos')
      const json = await res.json()
      if (json.success) setPrestamos(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const generar = () => {
    if (!prestamoSel) {
      toast({ title: 'Error', description: 'Selecciona un préstamo', variant: 'destructive' })
      return
    }
    const url = `/api/documentos?prestamoId=${prestamoSel}&tipo=${tipoDoc}`
    window.open(url, '_blank')
    toast({
      title: 'Documento generado',
      description: 'Se abrió el documento en una nueva pestaña. Usa Ctrl+P para imprimir o guardar como PDF.',
      duration: 6000,
    })
  }

  const prestamoSeleccionado = prestamos.find((p) => p.id === prestamoSel)

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Generación de pagarés y cartas de instrucciones</p>
              <p className="text-xs">
                Selecciona un préstamo y el tipo de documento a generar. El documento se abrirá en una nueva
                pestaña con formato HTML imprimible, incluyendo firmas electrónicas verificadas (con foto selfie,
                firma dibujada, OTP validado y QR de verificación) cuando el préstamo ya haya sido firmado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generar documento legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Préstamo *</Label>
              <Select value={prestamoSel} onValueChange={setPrestamoSel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un préstamo..." />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>
                      Cargando...
                    </SelectItem>
                  ) : (
                    prestamos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} — {p.cliente?.nombre || 'N/A'} ({p.estado})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagare-diligenciado">
                    Pagaré diligenciado (con datos completos)
                  </SelectItem>
                  <SelectItem value="pagare-blanco">Pagaré en blanco (para diligenciar a mano)</SelectItem>
                  <SelectItem value="carta">Carta de instrucciones (con 10 cláusulas)</SelectItem>
                  <SelectItem value="combinado">
                    Pagaré + Carta combinados (PDF único con ambas firmas)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {prestamoSeleccionado && (
            <div className="p-3 rounded bg-muted/50 border text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Préstamo seleccionado:</span>{' '}
                <strong className="font-mono">{prestamoSeleccionado.codigo}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Cliente:</span>{' '}
                <strong>{prestamoSeleccionado.cliente?.nombre}</strong>{' '}
                <span className="text-xs text-muted-foreground">
                  (CC {prestamoSeleccionado.cliente?.cedula})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Monto:</span>{' '}
                <strong>{formatearMoneda(prestamoSeleccionado.montoPrincipal)}</strong>{' '}
                <span className="text-muted-foreground">· Estado:</span>{' '}
                <strong>{prestamoSeleccionado.estado}</strong>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={generar} disabled={!prestamoSel} className="bg-blue-600 hover:bg-blue-700">
              <FileText className="w-4 h-4 mr-2" />
              Generar documento
              <ExternalLink className="w-3.5 h-3.5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documentos disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <FileCheck className="w-8 h-8 text-rose-600" />
            <h4 className="font-semibold text-sm">Pagaré diligenciado</h4>
            <p className="text-xs text-muted-foreground">
              Documento legal con todos los datos del préstamo (monto, tasa, cuotas, fechas). Incluye firma
              electrónica verificada del deudor y codeudor (si aplica), con foto selfie, OTP validado y QR de
              verificación anti-falsificación.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <FileText className="w-8 h-8 text-amber-600" />
            <h4 className="font-semibold text-sm">Pagaré en blanco</h4>
            <p className="text-xs text-muted-foreground">
              Pagaré con campos vacíos para diligenciar manualmente. Útil cuando el préstamo se formaliza
              presencialmente y se llenan los datos a mano. Mantiene las firmas electrónicas verificadas si ya
              existen.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h4 className="font-semibold text-sm">Carta de instrucciones</h4>
            <p className="text-xs text-muted-foreground">
              Carta con 10 cláusulas legales redactadas por el abogado Johan Sebastián Alvarez Del Rio
              (acreedor). Incluye cláusula 9 sobre firma electrónica y biometría, cláusula aceleratoria,
              vencimiento anticipado e intereses de mora.
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-300 bg-emerald-50/30">
          <CardContent className="p-4 space-y-2">
            <FileCheck className="w-8 h-8 text-emerald-700" />
            <h4 className="font-semibold text-sm">Pagaré + Carta (PDF único) ⭐</h4>
            <p className="text-xs text-muted-foreground">
              Documento combinado: Pagaré diligenciado primero y debajo la Carta de Instrucciones,
              en un solo PDF. Cada uno con su propia sección de firma electrónica, fotos, OTP y
              sello de autenticidad. Garantiza la entrega de ambos documentos en una sola impresión.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
