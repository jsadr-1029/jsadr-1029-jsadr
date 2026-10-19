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
import { Plus, Edit, Search, Car } from 'lucide-react'
import { apiFetch, formatCOP, EstadoBadge, ESTADOS_VEHICULO } from './helpers'

export function VehiculosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<any>({
    placa: '', marca: '', modelo: '', anio: '', color: '', kilometraje: 0,
    vin: '', motor: '', soatVence: '', tecnomecanicaVence: '',
    fechaCompra: '', valorCompra: '', fotoUrl: '', estado: 'DISPONIBLE', notas: '',
  })

  const cargar = async () => {
    setLoading(true)
    const r = await apiFetch('/api/vehiculos/vehiculos' + (filtroPlaca ? `?placa=${encodeURIComponent(filtroPlaca)}` : ''))
    if (r.success && r.data) setVehiculos(r.data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroPlaca])

  const abrirCrear = () => {
    setEditando(null)
    setForm({
      placa: '', marca: '', modelo: '', anio: '', color: '', kilometraje: 0,
      vin: '', motor: '', soatVence: '', tecnomecanicaVence: '',
      fechaCompra: '', valorCompra: '', fotoUrl: '', estado: 'DISPONIBLE', notas: '',
    })
    setModalOpen(true)
  }

  const abrirEditar = (v: any) => {
    setEditando(v)
    setForm({
      ...v,
      soatVence: v.soatVence ? v.soatVence.slice(0, 10) : '',
      tecnomecanicaVence: v.tecnomecanicaVence ? v.tecnomecanicaVence.slice(0, 10) : '',
      fechaCompra: v.fechaCompra ? v.fechaCompra.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.placa || !form.marca || !form.modelo) {
      toast({ title: 'Faltan campos', description: 'Placa, marca y modelo son obligatorios', variant: 'destructive' })
      return
    }
    const url = editando ? `/api/vehiculos/vehiculos/${editando.id}` : '/api/vehiculos/vehiculos'
    const method = editando ? 'PUT' : 'POST'
    const r = await apiFetch(url, { method, body: JSON.stringify(form) })
    if (r.success) {
      toast({ title: editando ? 'Vehículo actualizado' : 'Vehículo creado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const eliminar = async (v: any) => {
    if (!confirm(`¿Desactivar el vehículo ${v.placa}?`)) return
    const r = await apiFetch(`/api/vehiculos/vehiculos/${v.id}`, { method: 'DELETE' })
    if (r.success) {
      toast({ title: 'Vehículo desactivado' })
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
            placeholder="Buscar por placa..."
            value={filtroPlaca}
            onChange={e => setFiltroPlaca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo vehículo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : vehiculos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay vehículos registrados. Crea el primero.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehiculos.map(v => (
            <Card key={v.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg">{v.placa}</div>
                    <div className="text-sm text-muted-foreground">{v.marca} {v.modelo} {v.anio || ''}</div>
                  </div>
                  <EstadoBadge estado={v.estado} />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Color:</span><span>{v.color || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kilometraje:</span><span>{(v.kilometraje || 0).toLocaleString('es-CO')} km</span></div>
                  {v.soatVence && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SOAT vence:</span>
                      <span>{new Date(v.soatVence).toLocaleDateString('es-CO')}</span>
                    </div>
                  )}
                  {v.contratoActivo && (
                    <div className="mt-2 p-1.5 rounded bg-green-50 text-green-800 text-xs">
                      Asignado a: {v.contratoActivo.conductor.nombre}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 mt-3">
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(v)}>
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => eliminar(v)} className="text-red-600">
                    Eliminar
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
            <DialogTitle>{editando ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Placa *</Label>
              <Input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} disabled={!!editando} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_VEHICULO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca *</Label>
              <Input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
            </div>
            <div>
              <Label>Modelo *</Label>
              <Input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
            </div>
            <div>
              <Label>Año</Label>
              <Input type="number" value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} />
            </div>
            <div>
              <Label>Color</Label>
              <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <Label>Kilometraje</Label>
              <Input type="number" value={form.kilometraje} onChange={e => setForm({ ...form, kilometraje: e.target.value })} />
            </div>
            <div>
              <Label>VIN / Chasis</Label>
              <Input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} />
            </div>
            <div>
              <Label>N° Motor</Label>
              <Input value={form.motor} onChange={e => setForm({ ...form, motor: e.target.value })} />
            </div>
            <div>
              <Label>SOAT vence</Label>
              <Input type="date" value={form.soatVence} onChange={e => setForm({ ...form, soatVence: e.target.value })} />
            </div>
            <div>
              <Label>Tecnomécánica vence</Label>
              <Input type="date" value={form.tecnomecanicaVence} onChange={e => setForm({ ...form, tecnomecanicaVence: e.target.value })} />
            </div>
            <div>
              <Label>Fecha compra</Label>
              <Input type="date" value={form.fechaCompra} onChange={e => setForm({ ...form, fechaCompra: e.target.value })} />
            </div>
            <div>
              <Label>Valor compra</Label>
              <Input type="number" value={form.valorCompra} onChange={e => setForm({ ...form, valorCompra: e.target.value })} />
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
