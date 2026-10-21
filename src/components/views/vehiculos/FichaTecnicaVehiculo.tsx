'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Download, FileText, Package, Wrench, Calendar, Car, AlertTriangle, Plus, Trash2, FileCheck, Phone, MapPin, Upload, CheckCircle } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, EstadoBadge } from './helpers'

const TIPOS_DOCUMENTO = ['SOAT', 'TECNOMECANICA', 'TARJETA_PROPIEDAD', 'SEGURO', 'POLIZA_TODO_RIESGO', 'CONTRATO', 'OTRO']
const ESTADOS_INVENTARIO = ['NUEVO', 'BUENO', 'REGULAR', 'MALO']

const COLORES_DOC: Record<string, string> = {
  VIGENTE: 'bg-green-100 text-green-800 border-green-300',
  POR_VENCER: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  VENCIDO: 'bg-red-100 text-red-800 border-red-300',
}

// === Helper: comprimir imagen (cámara o archivo) a base64 ===
// Reduce tamaño a maxWidth 1280px calidad 0.7 para no exceder body size del API
function comprimirImagen(file: File, maxWidth: number = 1280, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) {
          h = (h * maxWidth) / w
          w = maxWidth
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas error'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function FichaTecnicaVehiculo({ vehiculoId, onClose }: { vehiculoId: string; onClose?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [itemModal, setItemModal] = useState(false)
  const [docModal, setDocModal] = useState(false)
  const [itemForm, setItemForm] = useState<any>({
    nombre: '', descripcion: '', cantidad: 1, estado: 'BUENO', fotoUrl: '', notas: '',
  })
  const [docForm, setDocForm] = useState<any>({
    tipo: 'SOAT', numero: '', fechaEmision: '', fechaVencimiento: '',
    entidadEmisora: '', archivoUrl: '', notas: '',
  })

  const cargar = async () => {
    setLoading(true)
    const r = await apiFetch(`/api/vehiculos/vehiculos/${vehiculoId}/ficha-tecnica`)
    if (r.success) setData(r.data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [vehiculoId])

  const descargarPDF = async (tipo: string = 'completo') => {
    // El PDF requiere autenticación → usar fetch con token
    try {
      let token: string | null = null
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try { token = JSON.parse(userStr).token || JSON.parse(userStr).accessToken } catch {}
      }
      const res = await fetch(`/api/vehiculos/vehiculos/${vehiculoId}/pdf-entrega?tipo=${tipo}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        toast({ title: 'Error al generar PDF', description: `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ficha_${data?.vehiculo?.placa || 'vehiculo'}_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'PDF descargado', description: 'Documento generado correctamente' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // === Manejo de fotos con cámara nativa ===
  const handleItemPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirImagen(file)
      setItemForm(prev => ({ ...prev, fotoUrl: base64 }))
      toast({ title: 'Foto cargada', description: 'Imagen del item lista' })
    } catch (err: any) {
      toast({ title: 'Error al cargar imagen', description: err.message, variant: 'destructive' })
    }
  }

  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      // Si es PDF, leerlo como base64 directamente (sin comprimir)
      if (file.type === 'application/pdf') {
        const reader = new FileReader()
        reader.onload = (ev) => {
          setDocForm(prev => ({ ...prev, archivoUrl: ev.target?.result as string }))
          toast({ title: 'PDF cargado', description: 'Documento listo' })
        }
        reader.readAsDataURL(file)
      } else {
        // Imagen: comprimir
        const base64 = await comprimirImagen(file)
        setDocForm(prev => ({ ...prev, archivoUrl: base64 }))
        toast({ title: 'Foto cargada', description: 'Documento listo' })
      }
    } catch (err: any) {
      toast({ title: 'Error al cargar archivo', description: err.message, variant: 'destructive' })
    }
  }

  const guardarItem = async () => {
    if (!itemForm.nombre) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    const r = await apiFetch(`/api/vehiculos/vehiculos/${vehiculoId}/inventario`, {
      method: 'POST',
      body: JSON.stringify(itemForm),
    })
    if (r.success) {
      toast({ title: 'Item agregado al inventario' })
      setItemModal(false)
      setItemForm({ nombre: '', descripcion: '', cantidad: 1, estado: 'BUENO', fotoUrl: '', notas: '' })
      cargar()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const eliminarItem = async (itemId: string) => {
    if (!confirm('¿Eliminar este item del inventario?')) return
    const r = await apiFetch(`/api/vehiculos/vehiculos/${vehiculoId}/inventario/${itemId}`, { method: 'DELETE' })
    if (r.success) {
      toast({ title: 'Item eliminado' })
      cargar()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const guardarDoc = async () => {
    if (!docForm.tipo) {
      toast({ title: 'Tipo requerido', variant: 'destructive' })
      return
    }
    const r = await apiFetch(`/api/vehiculos/vehiculos/${vehiculoId}/documentos`, {
      method: 'POST',
      body: JSON.stringify(docForm),
    })
    if (r.success) {
      toast({ title: 'Documento agregado' })
      setDocModal(false)
      setDocForm({ tipo: 'SOAT', numero: '', fechaEmision: '', fechaVencimiento: '', entidadEmisora: '', archivoUrl: '', notas: '' })
      cargar()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando ficha técnica...</div>
  }

  if (!data) {
    return <div className="p-8 text-center text-red-600">Error al cargar la ficha</div>
  }

  const v = data.vehiculo
  const k = data.kpis

  return (
    <div className="space-y-4 p-2">
      {/* Header con acciones */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" />
            {v.placa} - {v.marca} {v.modelo}
          </h2>
          <p className="text-sm text-muted-foreground">Ficha técnica completa del vehículo</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => descargarPDF('ficha')}>
            <FileText className="w-4 h-4 mr-1" /> Solo ficha
          </Button>
          <Button variant="outline" size="sm" onClick={() => descargarPDF('inventario')}>
            <Package className="w-4 h-4 mr-1" /> Solo inventario
          </Button>
          <Button size="sm" onClick={() => descargarPDF('completo')}>
            <Download className="w-4 h-4 mr-1" /> PDF completo
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex overflow-x-auto whitespace-nowrap md:grid md:grid-cols-6 w-full no-scrollbar h-auto">
          <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
          <TabsTrigger value="inventario" className="text-xs">Inventario</TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
          <TabsTrigger value="mantenimientos" className="text-xs">Mantenim.</TabsTrigger>
          <TabsTrigger value="repuestos" className="text-xs">Repuestos</TabsTrigger>
          <TabsTrigger value="contratos" className="text-xs">Contratos</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Kilometraje</div>
              <div className="text-lg font-bold">{(v.kilometraje || 0).toLocaleString('es-CO')} km</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Ingresos</div>
              <div className="text-lg font-bold text-emerald-700">{formatCOP(k.totalIngresos)}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Gastos + Mant.</div>
              <div className="text-lg font-bold text-red-700">{formatCOP(k.totalGastos + k.totalMantenimientos)}</div>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Rentabilidad neta</div>
              <div className={`text-lg font-bold ${k.rentabilidadNeta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCOP(k.rentabilidadNeta)}
              </div>
            </CardContent></Card>
          </div>

          {/* Foto */}
          {v.fotoUrl && (
            <Card><CardContent className="p-3">
              <img src={v.fotoUrl} alt={v.placa} className="w-full max-h-64 object-contain rounded" />
            </CardContent></Card>
          )}

          {/* Datos básicos */}
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del vehículo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div><span className="text-muted-foreground">Placa:</span> <strong>{v.placa}</strong></div>
              <div><span className="text-muted-foreground">Marca/Modelo:</span> {v.marca} {v.modelo}</div>
              <div><span className="text-muted-foreground">Año:</span> {v.anio || '—'}</div>
              <div><span className="text-muted-foreground">Color:</span> {v.color || '—'}</div>
              <div><span className="text-muted-foreground">VIN:</span> {v.vin || '—'}</div>
              <div><span className="text-muted-foreground">Motor:</span> {v.motor || '—'}</div>
              <div><span className="text-muted-foreground">Estado:</span> <EstadoBadge estado={v.estado} /></div>
              <div><span className="text-muted-foreground">Fecha compra:</span> {formatDate(v.fechaCompra)}</div>
              <div><span className="text-muted-foreground">Valor compra:</span> {formatCOP(v.valorCompra)}</div>
            </CardContent>
          </Card>

          {/* Alertas */}
          {data.alertas.length > 0 && (
            <Card className="border-red-300">
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" /> Alertas activas ({data.alertas.length})
              </CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {data.alertas.map(a => (
                    <div key={a.id} className="p-2 rounded border text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{a.titulo}</span>
                        <Badge className={`text-xs ${a.severidad === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {a.severidad}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{a.descripcion}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* INVENTARIO */}
        <TabsContent value="inventario" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Inventario de entrega ({data.inventario.length} items)</h3>
            <Button size="sm" onClick={() => setItemModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar item
            </Button>
          </div>
          {data.inventario.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No hay items en el inventario. Agrega llaves, documentos, herramientas, accesorios...
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.inventario.map((item: any) => (
                <Card key={item.id}><CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.nombre}</span>
                        <Badge className="text-xs bg-blue-100 text-blue-800">x{item.cantidad}</Badge>
                        <Badge className={`text-xs ${
                          item.estado === 'NUEVO' ? 'bg-green-100 text-green-800' :
                          item.estado === 'BUENO' ? 'bg-blue-100 text-blue-800' :
                          item.estado === 'REGULAR' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>{item.estado}</Badge>
                      </div>
                      {item.descripcion && <div className="text-sm text-muted-foreground mt-1">{item.descripcion}</div>}
                      {item.notas && <div className="text-xs text-muted-foreground mt-1">📝 {item.notas}</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        Ingresado: {formatDate(item.fechaIngreso || item.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {item.fotoUrl && (
                        <img src={item.fotoUrl} alt={item.nombre} className="w-16 h-16 object-cover rounded border" />
                      )}
                      <Button size="sm" variant="outline" onClick={() => eliminarItem(item.id)} className="text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Documentos ({data.documentos.length})</h3>
            <Button size="sm" onClick={() => setDocModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Agregar documento
            </Button>
          </div>
          {data.documentos.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <FileCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No hay documentos registrados.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.documentos.map((d: any) => (
                <Card key={d.id}><CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.tipo}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${COLORES_DOC[d.estado] || COLORES_DOC.VIGENTE}`}>
                          {d.estado}
                        </span>
                      </div>
                      {d.numero && <div className="text-xs text-muted-foreground mt-1">N° {d.numero}</div>}
                      {d.entidadEmisora && <div className="text-xs">{d.entidadEmisora}</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        {d.fechaEmision && <span>Emitido: {formatDate(d.fechaEmision)} </span>}
                        {d.fechaVencimiento && <span>· Vence: {formatDate(d.fechaVencimiento)}</span>}
                      </div>
                      {d.diasParaVencer !== null && d.diasParaVencer !== undefined && (
                        <div className={`text-xs mt-1 ${d.diasParaVencer < 0 ? 'text-red-700 font-medium' : d.diasParaVencer < 15 ? 'text-yellow-700 font-medium' : 'text-green-700'}`}>
                          {d.diasParaVencer < 0
                            ? `Vencido hace ${Math.abs(d.diasParaVencer)} días`
                            : `${d.diasParaVencer} días para vencer`}
                        </div>
                      )}
                    </div>
                    {d.archivoUrl && (
                      <a href={d.archivoUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <FileCheck className="w-3 h-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MANTENIMIENTOS */}
        <TabsContent value="mantenimientos" className="space-y-3 mt-4">
          <h3 className="font-semibold">Historial de mantenimientos ({data.mantenimientos.length})</h3>
          {data.mantenimientos.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No hay mantenimientos registrados.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.mantenimientos.map((m: any) => (
                <Card key={m.id}><CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{formatDate(m.fecha)}</span>
                        <Badge className="text-xs bg-blue-100 text-blue-800">{m.tipo}</Badge>
                        <span className="text-xs text-muted-foreground">{m.kilometraje} km</span>
                      </div>
                      <div className="text-sm mt-1">{m.trabajoRealizado}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {m.taller && `Taller: ${m.taller}`}
                        {m.proveedorRef?.nombre && ` · Proveedor: ${m.proveedorRef.nombre}`}
                      </div>
                      {m.repuestos && m.repuestos.length > 0 && (
                        <div className="text-xs mt-1 text-purple-700">
                          Repuestos: {m.repuestos.map((r: any) => r.repuesto?.nombre).join(', ')}
                        </div>
                      )}
                      {(m.proximaRevisionFecha || m.proximaRevisionKm) && (
                        <div className="text-xs text-orange-700 mt-1">
                          Próxima revisión: {m.proximaRevisionFecha ? formatDate(m.proximaRevisionFecha) : ''} {m.proximaRevisionKm ? `· ${m.proximaRevisionKm} km` : ''}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-700">{formatCOP(m.costo)}</div>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* REPUESTOS */}
        <TabsContent value="repuestos" className="space-y-3 mt-4">
          {/* Repuestos activos */}
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Repuestos activos ({data.repuestosActivos.length})
            </h3>
            {data.repuestosActivos.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No hay repuestos instalados actualmente.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {data.repuestosActivos.map((r: any) => {
                  const dias = Math.floor((Date.now() - new Date(r.fechaInstalacion).getTime()) / (1000 * 60 * 60 * 24))
                  const kmRecorridos = r.vehiculo?.kilometraje
                    ? Math.max(0, r.vehiculo.kilometraje - r.kilometrajeInstalacion)
                    : 0
                  return (
                    <Card key={r.id}><CardContent className="p-3">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium">{r.repuesto?.nombre}</div>
                          {r.repuesto?.marca && <div className="text-xs text-muted-foreground">{r.repuesto.marca} · {r.repuesto.referencia}</div>}
                          <div className="text-xs mt-1">
                            Instalado: {formatDate(r.fechaInstalacion)} ({r.kilometrajeInstalacion} km)
                          </div>
                          <div className="text-sm mt-1">
                            En uso: <strong>{dias} días</strong> · <strong>{kmRecorridos} km</strong>
                          </div>
                          {r.proveedorRef?.nombre && (
                            <div className="text-xs text-muted-foreground mt-1">Proveedor: {r.proveedorRef.nombre}</div>
                          )}
                          {r.proximoCambioSugeridoFecha && (
                            <div className="text-xs text-orange-700 mt-1">
                              Próx. cambio sugerido: {formatDate(r.proximoCambioSugeridoFecha)}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div>Costo: <strong>{formatCOP(r.costo)}</strong></div>
                          {r.garantiaVence && (
                            <div className="text-xs text-muted-foreground">Garantía: {formatDate(r.garantiaVence)}</div>
                          )}
                        </div>
                      </div>
                    </CardContent></Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Histórico vida útil */}
          {data.repuestosRetirados.length > 0 && (
            <div>
              <h3 className="font-semibold mt-4">Histórico de vida útil ({data.repuestosRetirados.length})</h3>
              <div className="space-y-2 mt-2">
                {data.repuestosRetirados.map((r: any) => (
                  <Card key={r.id}><CardContent className="p-3 text-sm">
                    <div className="font-medium">{r.repuesto?.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      Instalado: {formatDate(r.fechaInstalacion)} ({r.kilometrajeInstalacion} km) ·
                      Retirado: {formatDate(r.fechaRetiro)} ({r.kilometrajeRetiro} km)
                    </div>
                    <div className="text-xs mt-1">
                      Vida útil: <strong>{r.diasEnUso} días</strong> · <strong>{r.kmRecorridos} km</strong> ·
                      Motivo: {r.motivoRetiro}
                      {r.diasEnUso !== null && r.diasEnUso < 30 && r.kmRecorridos < 5000 && (
                        <span className="ml-2 text-red-700 font-medium">⚠ Vida útil corta</span>
                      )}
                    </div>
                    {r.fallaReportada && <div className="text-xs text-red-700 mt-1">Falla: {r.fallaReportada}</div>}
                  </CardContent></Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* CONTRATOS */}
        <TabsContent value="contratos" className="space-y-3 mt-4">
          <h3 className="font-semibold">Contratos del vehículo ({data.contratos.length})</h3>
          {data.contratos.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No hay contratos registrados para este vehículo.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.contratos.map((c: any) => (
                <Card key={c.id}><CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{c.numeroContrato}</span>
                        <EstadoBadge estado={c.estado} />
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {c.conductor?.nombre} (CC {c.conductor?.cedula})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(c.fechaInicio)} → {c.fechaFin ? formatDate(c.fechaFin) : 'Indefinida'}
                      </div>
                      <div className="text-sm mt-1">
                        {formatCOP(c.tarifa)} / {c.modalidadPago}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => descargarPDF('completo')}>
                      <Download className="w-3 h-3 mr-1" /> PDF entrega
                    </Button>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal agregar item inventario */}
      <Dialog open={itemModal} onOpenChange={setItemModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar item al inventario</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input value={itemForm.nombre} onChange={e => setItemForm({ ...itemForm, nombre: e.target.value })}
                placeholder="ej: Llave de contacto, Gato hidráulico, Llanta de repuesto..." />
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <Input value={itemForm.descripcion} onChange={e => setItemForm({ ...itemForm, descripcion: e.target.value })}
                placeholder="Marca, modelo, características..." />
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" value={itemForm.cantidad} onChange={e => setItemForm({ ...itemForm, cantidad: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={itemForm.estado} onValueChange={v => setItemForm({ ...itemForm, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_INVENTARIO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Foto del item (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Toma una foto del item o sube una imagen desde tu dispositivo.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleItemPhotoUpload}
                  className="hidden"
                  id="file-item-foto"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-item-foto')?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Tomar foto / Subir imagen
                </Button>
                {itemForm.fotoUrl && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              {itemForm.fotoUrl && (
                <img src={itemForm.fotoUrl} alt="Foto del item" className="mt-2 max-h-32 object-contain border rounded" />
              )}
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={itemForm.notas} onChange={e => setItemForm({ ...itemForm, notas: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModal(false)}>Cancelar</Button>
            <Button onClick={guardarItem}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal agregar documento */}
      <Dialog open={docModal} onOpenChange={setDocModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar documento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={docForm.tipo} onValueChange={v => setDocForm({ ...docForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número / Póliza</Label>
              <Input value={docForm.numero} onChange={e => setDocForm({ ...docForm, numero: e.target.value })} />
            </div>
            <div>
              <Label>Fecha emisión</Label>
              <Input type="date" value={docForm.fechaEmision} onChange={e => setDocForm({ ...docForm, fechaEmision: e.target.value })} />
            </div>
            <div>
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={docForm.fechaVencimiento} onChange={e => setDocForm({ ...docForm, fechaVencimiento: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Entidad emisora</Label>
              <Input value={docForm.entidadEmisora} onChange={e => setDocForm({ ...docForm, entidadEmisora: e.target.value })}
                placeholder="Aseguradora, taller autorizado..." />
            </div>
            <div className="col-span-2">
              <Label>Archivo del documento (foto o PDF)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Toma una foto del documento (SOAT, tecnomecánica, etc.) o sube un PDF.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleDocFileUpload}
                  className="hidden"
                  id="file-doc-archivo"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-doc-archivo')?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Tomar foto / Subir archivo
                </Button>
                {docForm.archivoUrl && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              {docForm.archivoUrl && docForm.archivoUrl.startsWith('data:image') && (
                <img src={docForm.archivoUrl} alt="Documento" className="mt-2 max-h-40 object-contain border rounded" />
              )}
              {docForm.archivoUrl && docForm.archivoUrl.startsWith('data:application/pdf') && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800 flex items-center gap-1">
                  <FileCheck className="w-3 h-3" /> PDF cargado correctamente
                </div>
              )}
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={docForm.notas} onChange={e => setDocForm({ ...docForm, notas: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocModal(false)}>Cancelar</Button>
            <Button onClick={guardarDoc}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
