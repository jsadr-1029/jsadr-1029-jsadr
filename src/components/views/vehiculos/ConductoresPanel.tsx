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
import { Plus, Edit, Search, Users } from 'lucide-react'
import { apiFetch, formatDate, EstadoBadge } from './helpers'

const CAT_LICENCIA = ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']

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
            <Card key={c.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{c.nombre}</div>
                    <div className="text-xs text-muted-foreground">CC {c.cedula}</div>
                  </div>
                  {c.contratoActivo && <EstadoBadge estado="ACTIVO" />}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Teléfono:</span><span>{c.telefono}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Licencia:</span><span>{c.licenciaCategoria || '—'} · {c.licenciaNumero}</span></div>
                  {c.licenciaVence && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Lic. vence:</span><span>{formatDate(c.licenciaVence)}</span></div>
                  )}
                  {c.contratoActivo && (
                    <div className="mt-2 p-1.5 rounded bg-green-50 text-green-800 text-xs">
                      Vehículo: {c.contratoActivo.vehiculo?.placa}
                    </div>
                  )}
                </div>
                <div className="mt-3">
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
              <Label>URL foto</Label>
              <Input value={form.fotoUrl} onChange={e => setForm({ ...form, fotoUrl: e.target.value })} placeholder="https://..." />
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
