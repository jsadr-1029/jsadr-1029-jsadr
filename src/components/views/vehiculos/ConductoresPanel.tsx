'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, Search, Users, Upload, CheckCircle } from 'lucide-react'
import { apiFetch, formatDate, EstadoBadge } from './helpers'

const CAT_LICENCIA = ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']

// Helper: comprimir imagen a base64
function comprimirImagen(file: File, maxWidth = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth }
        canvas.width = w; canvas.height = h
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

export function ConductoresPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [conductores, setConductores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    cedula: '', nombre: '', telefono: '', email: '', direccion: '', ciudad: '',
    licenciaNumero: '', licenciaCategoria: '', licenciaVence: '',
    fotoUrl: '', notas: '',
  })

  const cargar = async () => {
    setLoading(true)
    const r = await apiFetch('/api/vehiculos/conductores' + (filtro ? `?cedula=${encodeURIComponent(filtro)}` : ''))
    if (r.success && r.data) setConductores(r.data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtro])

  const abrirCrear = () => {
    setEditando(null)
    setForm({
      cedula: '', nombre: '', telefono: '', email: '', direccion: '', ciudad: '',
      licenciaNumero: '', licenciaCategoria: '', licenciaVence: '',
      fotoUrl: '', notas: '',
    })
    setModalOpen(true)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirImagen(file)
      setForm(prev => ({ ...prev, fotoUrl: base64 }))
      toast({ title: 'Foto cargada', description: 'Foto del conductor lista' })
    } catch (err: any) {
      toast({ title: 'Error al cargar imagen', description: err.message, variant: 'destructive' })
    }
  }

  const abrirEditar = (c: any) => {
    setEditando(c)
    setForm({
      ...c,
      licenciaVence: c.licenciaVence ? c.licenciaVence.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.cedula || !form.nombre || !form.telefono || !form.licenciaNumero) {
      toast({ title: 'Faltan campos', description: 'Cédula, nombre, teléfono y licencia son obligatorios', variant: 'destructive' })
      return
    }
    const url = editando ? `/api/vehiculos/conductores/${editando.id}` : '/api/vehiculos/conductores'
    const method = editando ? 'PUT' : 'POST'
    const r = await apiFetch(url, { method, body: JSON.stringify(form) })
    if (r.success) {
      toast({ title: editando ? 'Conductor actualizado' : 'Conductor creado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cédula..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo conductor
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : conductores.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay conductores registrados.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {conductores.map(c => (
            <Card key={c.id} className="border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {/* Header con foto + datos básicos */}
                <div className="flex gap-3 p-4">
                  {/* Foto del conductor */}
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-200 flex-shrink-0 bg-gray-100">
                    {c.fotoUrl ? (
                      <img src={c.fotoUrl} alt={c.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {/* Datos del conductor */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{c.nombre}</div>
                    <div className="text-xs text-muted-foreground">CC {c.cedula}</div>
                    {c.contratoActivo && (
                      <div className="mt-1"><EstadoBadge estado="ACTIVO" /></div>
                    )}
                  </div>
                </div>
                {/* Datos adicionales */}
                <div className="px-4 pb-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Teléfono:</span><span>{c.telefono}</span></div>
                  {c.email && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="truncate ml-2">{c.email}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Licencia:</span><span>{c.licenciaCategoria || '—'} · {c.licenciaNumero}</span></div>
                  {c.licenciaVence && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Lic. vence:</span><span>{formatDate(c.licenciaVence)}</span></div>
                  )}
                  {c.ciudad && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ciudad:</span><span>{c.ciudad}</span></div>
                  )}
                  {c.contratoActivo && (
                    <div className="mt-2 p-1.5 rounded bg-green-50 text-green-800 text-xs">
                      Vehículo: {c.contratoActivo.vehiculo?.placa}
                    </div>
                  )}
                </div>
                {/* Acciones */}
                <div className="p-4 pt-2">
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar conductor' : 'Nuevo conductor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cédula *</Label>
              <Input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} disabled={!!editando} />
            </div>
            <div>
              <Label>Nombre completo *</Label>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} />
            </div>
            <div>
              <Label>N° Licencia *</Label>
              <Input value={form.licenciaNumero} onChange={e => setForm({ ...form, licenciaNumero: e.target.value })} />
            </div>
            <div>
              <Label>Categoría licencia</Label>
              <Select value={form.licenciaCategoria || ''} onValueChange={v => setForm({ ...form, licenciaCategoria: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {CAT_LICENCIA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Licencia vence</Label>
              <Input type="date" value={form.licenciaVence} onChange={e => setForm({ ...form, licenciaVence: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Foto del conductor</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Toma una foto del conductor o sube una imagen.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="file-conductor-foto"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-conductor-foto')?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Tomar foto / Subir imagen
                </Button>
                {form.fotoUrl && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              {form.fotoUrl && (
                <img src={form.fotoUrl} alt="Foto del conductor" className="mt-2 w-24 h-24 rounded-full object-cover border-2 border-blue-200" />
              )}
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>{editando ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
