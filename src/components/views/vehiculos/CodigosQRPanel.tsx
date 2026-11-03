'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, QrCode, Upload, CheckCircle, Loader2, Building, CreditCard, User } from 'lucide-react'
import { apiFetch } from './helpers'

export function CodigosQRPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [codigos, setCodigos] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroContrato, setFiltroContrato] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  // Formulario: banco, numero cuenta, titular, imagen QR, contrato
  const [form, setForm] = useState<any>({
    contratoId: '',
    banco: '',
    numeroCuenta: '',
    titular: '',
    imagenUrl: '',
  })

  const cargar = async () => {
    setLoading(true)
    try {
      const [rq, rct] = await Promise.all([
        apiFetch('/api/vehiculos/codigos-qr' + (filtroContrato ? `?contratoId=${filtroContrato}` : '')),
        apiFetch('/api/vehiculos/contratos'),
      ])
      if (rq.success) setCodigos(rq.data || [])
      if (rct.success) setContratos(rct.data || [])
    } catch (e: any) {
      console.error('Error cargando:', e)
    }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroContrato])

  const abrirCrear = () => {
    setForm({
      contratoId: '',
      banco: '',
      numeroCuenta: '',
      titular: '',
      imagenUrl: '',
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
            try { result = canvas.toDataURL('image/jpeg', quality) }
            catch { try { result = canvas.toDataURL('image/png') } catch { result = e.target?.result as string } }
            if (!result || !result.startsWith('data:image/')) { result = e.target?.result as string }
            resolve(result)
          } catch { resolve(e.target?.result as string) }
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
      setForm((prev: any) => ({ ...prev, imagenUrl: compressed }))
      toast({ title: 'Imagen cargada', description: 'Imagen del QR lista' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo procesar la imagen. Intenta con otra.', variant: 'destructive' })
    }
    setSubiendoImagen(false)
    e.target.value = ''
  }

  const guardar = async () => {
    if (!form.contratoId || !form.banco || !form.numeroCuenta || !form.titular || !form.imagenUrl) {
      toast({ title: 'Faltan campos', description: 'Todos los campos son obligatorios', variant: 'destructive' })
      return
    }
    const titulo = `${form.banco} - ${form.titular}`
    const descripcion = `Banco: ${form.banco} | Cuenta: ${form.numeroCuenta} | Titular: ${form.titular}`
    const tipoPago = form.banco.toUpperCase().includes('NEQUI') ? 'NEQUI'
      : form.banco.toUpperCase().includes('DAVIPLATA') ? 'DAVIPLATA'
      : form.banco.toUpperCase().includes('BANCOLOMBIA') ? 'BANCOLOMBIA_QR'
      : 'OTRO'

    const r = await apiFetch('/api/vehiculos/codigos-qr', {
      method: 'POST',
      body: JSON.stringify({
        contratoId: form.contratoId,
        titulo,
        descripcion,
        imagenUrl: form.imagenUrl,
        tipoPago,
      }),
    })
    if (r.success) {
      toast({ title: 'Código QR creado', description: `${titulo} asignado al contrato` })
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

  return (
    <div className="space-y-4">
      {/* Filtro + botón nuevo */}
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

      {/* Lista de QR */}
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
                  </div>
                  <Button size="sm" variant="outline" onClick={() => eliminar(qr)} className="text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="my-3 bg-gray-50 rounded border p-2 flex items-center justify-center">
                  <img src={qr.imagenUrl} alt={qr.titulo} className="max-h-40 object-contain" />
                </div>
                {qr.descripcion && (
                  <div className="text-xs text-muted-foreground mb-2 whitespace-pre-line">{qr.descripcion}</div>
                )}
                {qr.contrato && (
                  <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    {qr.contrato.numeroContrato} · {qr.contrato.conductor?.nombre}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* === MODAL: Nuevo código QR === */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo código QR de pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Contrato */}
            <div>
              <Label>Contrato *</Label>
              <Select value={form.contratoId} onValueChange={v => setForm({ ...form, contratoId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contrato activo" /></SelectTrigger>
                <SelectContent>
                  {contratos.filter(c => c.estado === 'ACTIVO').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numeroContrato} - {c.conductor?.nombre} ({c.vehiculo?.placa})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona a qué contrato se relacionará este código QR
              </p>
            </div>

            {/* Nombre del banco */}
            <div>
              <Label>Nombre del banco / Nequi / Daviplata *</Label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.banco}
                  onChange={e => setForm({ ...form, banco: e.target.value })}
                  placeholder="ej: Nequi, Daviplata, Bancolombia..."
                />
              </div>
            </div>

            {/* Número de cuenta */}
            <div>
              <Label>Número de cuenta / Celular *</Label>
              <div className="relative">
                <CreditCard className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.numeroCuenta}
                  onChange={e => setForm({ ...form, numeroCuenta: e.target.value })}
                  placeholder="ej: 3235949510 o 42061620839"
                />
              </div>
            </div>

            {/* Titular */}
            <div>
              <Label>Titular de la cuenta *</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.titular}
                  onChange={e => setForm({ ...form, titular: e.target.value })}
                  placeholder="ej: Johan Sebastian Alvarez Del Rio"
                />
              </div>
            </div>

            {/* Imagen del QR */}
            <div>
              <Label>Imagen del código QR *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Sube la imagen o foto del código QR
              </p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} className="bg-green-600 hover:bg-green-700">Crear código QR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
