'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, QrCode, Download, Upload, CheckCircle, Loader2 } from 'lucide-react'
import { apiFetch, formatCOP } from './helpers'

const TIPOS_PAGO_QR = ['NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_QR', 'PSE', 'OTRO']

const COLORES_TIPO_QR: Record<string, string> = {
  NEQUI: 'bg-pink-100 text-pink-800 border-pink-300',
  DAVIPLATA: 'bg-orange-100 text-orange-800 border-orange-300',
  BANCOLOMBIA_QR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PSE: 'bg-green-100 text-green-800 border-green-300',
  OTRO: 'bg-gray-100 text-gray-800 border-gray-300',
}

export function CodigosQRPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [codigos, setCodigos] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroContrato, setFiltroContrato] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [form, setForm] = useState<any>({
    contratoId: '', cuentaPagoId: '', titulo: '', descripcion: '',
    imagenUrl: '', montoFijo: '', tipoPago: 'NEQUI',
  })

  const cargar = async () => {
    setLoading(true)
    const [rq, rct, rc] = await Promise.all([
      apiFetch('/api/vehiculos/codigos-qr' + (filtroContrato ? `?contratoId=${filtroContrato}` : '')),
      apiFetch('/api/vehiculos/contratos'),
      apiFetch('/api/vehiculos/cuentas-pago'),
    ])
    if (rq.success) setCodigos(rq.data || [])
    if (rct.success) setContratos(rct.data || [])
    if (rc.success) setCuentas(rc.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroContrato])

  const abrirCrear = () => {
    setForm({
      contratoId: '', cuentaPagoId: '', titulo: '', descripcion: '',
      imagenUrl: '', montoFijo: '', tipoPago: 'NEQUI',
    })
    setModalOpen(true)
  }

  // === Comprimir imagen ===
  const comprimirImagen = (file: File, maxDim: number = 1024, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          try {
            let w = img.width, h = img.height
            if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
            else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim }
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('Canvas error')); return }
            ctx.drawImage(img, 0, 0, w, h)
            let result: string
            try {
              result = canvas.toDataURL('image/jpeg', quality)
            } catch {
              try { result = canvas.toDataURL('image/png') }
              catch { result = e.target?.result as string }
            }
            if (!result || !result.startsWith('data:image/')) {
              result = e.target?.result as string
            }
            resolve(result)
          } catch (err) {
            resolve(e.target?.result as string)
          }
        }
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })
  }

  // === Subir imagen del QR ===
  const handleSubirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'El archivo debe ser una imagen', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no puede superar 10MB', variant: 'destructive' })
      return
    }
    setSubiendoImagen(true)
    try {
      const compressed = await comprimirImagen(file, 1024, 0.8)
      if (!compressed || !compressed.startsWith('data:image/')) {
        throw new Error('La imagen procesada no es válida')
      }
      setForm(prev => ({ ...prev, imagenUrl: compressed }))
      toast({ title: 'Imagen cargada', description: 'Imagen del QR lista' })
    } catch (err: any) {
      console.error('Error procesando imagen:', err)
      toast({ title: 'Error', description: 'No se pudo procesar la imagen. Intenta con otra.', variant: 'destructive' })
    }
    setSubiendoImagen(false)
    e.target.value = ''
  }

  const guardar = async () => {
    if (!form.contratoId || !form.titulo || !form.imagenUrl) {
      toast({ title: 'Faltan campos', description: 'Contrato, título e imagen del QR son obligatorios', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/codigos-qr', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({ title: 'Código QR agregado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const eliminar = async (qr: any) => {
    if (!confirm(`¿Eliminar el código QR "${qr.titulo}"?`)) return
    const r = await apiFetch(`/api/vehiculos/codigos-qr/${qr.id}`, { method: 'DELETE' })
    if (r.success) {
      toast({ title: 'Código QR eliminado' })
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const cuentasPorContrato = (contratoId: string) => cuentas.filter(c => c.contratoId === contratoId)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroContrato || 'TODOS'} onValueChange={v => setFiltroContrato(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Filtrar por contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los contratos</SelectItem>
            {contratos.filter(c => c.estado === 'ACTIVO').map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.numeroContrato} - {c.conductor?.nombre} ({c.vehiculo?.placa})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo código QR
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : codigos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay códigos QR registrados.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {codigos.map(qr => (
            <Card key={qr.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-bold">{qr.titulo}</div>
                    <Badge className={`text-xs mt-1 ${COLORES_TIPO_QR[qr.tipoPago] || COLORES_TIPO_QR.OTRO}`}>
                      {qr.tipoPago}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => eliminar(qr)} className="text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="my-3 bg-gray-50 rounded border p-2 flex items-center justify-center">
                  <img src={qr.imagenUrl} alt={qr.titulo} className="max-h-40 object-contain" />
                </div>
                {qr.descripcion && (
                  <div className="text-sm text-muted-foreground mb-2">{qr.descripcion}</div>
                )}
                {qr.montoFijo && (
                  <div className="text-sm font-medium text-blue-700">Monto fijo: {formatCOP(qr.montoFijo)}</div>
                )}
                {qr.contrato && (
                  <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    {qr.contrato.numeroContrato} · {qr.contrato.conductor?.nombre}
                  </div>
                )}
                {qr.cuentaPago && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cuenta: {qr.cuentaPago.banco} - {qr.cuentaPago.titularCuenta}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo código QR de pago</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Contrato *</Label>
              <Select value={form.contratoId} onValueChange={v => {
                setForm({ ...form, contratoId: v, cuentaPagoId: '' })
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contrato" /></SelectTrigger>
                <SelectContent>
                  {contratos.filter(c => c.estado === 'ACTIVO').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numeroContrato} - {c.conductor?.nombre} ({c.vehiculo?.placa})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Cuenta de pago (opcional)</Label>
              <Select value={form.cuentaPagoId || 'NINGUNA'} onValueChange={v => setForm({ ...form, cuentaPagoId: v === 'NINGUNA' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin cuenta vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NINGUNA">— Sin cuenta vinculada —</SelectItem>
                  {cuentasPorContrato(form.contratoId).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.banco} - {c.titularCuenta} ({c.numeroCuenta})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="ej: Pago Nequi, Pago Bancolombia QR" />
            </div>
            <div>
              <Label>Tipo de pago</Label>
              <Select value={form.tipoPago} onValueChange={v => setForm({ ...form, tipoPago: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PAGO_QR.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto fijo (opcional)</Label>
              <Input type="number" value={form.montoFijo} onChange={e => setForm({ ...form, montoFijo: e.target.value })}
                placeholder="Si el QR tiene un monto predefinido" />
            </div>

            {/* === SECCIÓN DE SUBIDA DE IMAGEN QR === */}
            <div className="col-span-2">
              <Label>Imagen del código QR *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Sube la imagen del código QR (Nequi, Daviplata, Bancolombia, etc.)
              </p>

              {/* Área de subida de imagen */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-colors"
                onClick={() => !subiendoImagen && document.getElementById('file-qr-imagen')?.click()}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleSubirImagen}
                  className="hidden"
                  id="file-qr-imagen"
                />
                {subiendoImagen ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Procesando imagen...</p>
                  </div>
                ) : form.imagenUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Imagen cargada</span>
                    </div>
                    <img
                      src={form.imagenUrl}
                      alt="Preview QR"
                      className="max-h-48 mx-auto object-contain rounded border"
                    />
                    <p className="text-xs text-blue-600 hover:underline">
                      Click para cambiar la imagen
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Upload className="w-10 h-10 text-gray-400" />
                    <p className="text-sm font-medium">Click para subir la imagen del QR</p>
                    <p className="text-xs text-muted-foreground">o toma una foto del código QR</p>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <Label>Descripción / Instrucciones</Label>
              <Textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                rows={2} placeholder="ej: Escanea este QR con Nequi para pagar la cuota mensual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Crear QR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
