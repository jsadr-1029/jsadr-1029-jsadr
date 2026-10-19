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
import { Plus, Wrench } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, TIPOS_MANTENIMIENTO } from './helpers'

export function MantenimientosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [mantenimientos, setMantenimientos] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroVeh, setFiltroVeh] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<any>({
    vehiculoId: '', contratoId: '', fecha: new Date().toISOString().slice(0, 10),
    kilometraje: 0, tipo: 'PREVENTIVO', trabajoRealizado: '',
    taller: '', proveedor: '', costo: 0,
    proximaRevisionKm: '', proximaRevisionFecha: '',
    notas: '',
  })

  const cargar = async () => {
    setLoading(true)
    const [rm, rv, rc] = await Promise.all([
      apiFetch('/api/vehiculos/mantenimientos' + (filtroVeh ? `?vehiculoId=${filtroVeh}` : '')),
      apiFetch('/api/vehiculos/vehiculos'),
      apiFetch('/api/vehiculos/contratos'),
    ])
    if (rm.success) setMantenimientos(rm.data || [])
    if (rv.success) setVehiculos(rv.data || [])
    if (rc.success) setContratos(rc.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroVeh])

  const guardar = async () => {
    if (!form.vehiculoId || !form.trabajoRealizado) {
      toast({ title: 'Faltan campos', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/mantenimientos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({ title: 'Mantenimiento registrado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroVeh || 'TODOS'} onValueChange={v => setFiltroVeh(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filtrar por vehículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los vehículos</SelectItem>
            {vehiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} - {v.marca} {v.modelo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo mantenimiento
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : mantenimientos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay mantenimientos registrados.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {mantenimientos.map(m => (
            <Card key={m.id} className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{m.vehiculo?.placa}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{m.tipo}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(m.fecha)} · {m.kilometraje} km</span>
                    </div>
                    <div className="text-sm mt-1">{m.trabajoRealizado}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.taller && `Taller: ${m.taller}`}
                      {m.proveedor && ` · Proveedor: ${m.proveedor}`}
                      {m.proximaRevisionKm && ` · Próx: ${m.proximaRevisionKm} km`}
                      {m.proximaRevisionFecha && ` · ${formatDate(m.proximaRevisionFecha)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-700">{formatCOP(m.costo)}</div>
                    {m.repuestos && m.repuestos.length > 0 && (
                      <div className="text-xs text-muted-foreground">{m.repuestos.length} repuesto(s)</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar mantenimiento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Vehículo *</Label>
              <Select value={form.vehiculoId} onValueChange={v => setForm({ ...form, vehiculoId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {vehiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} - {v.marca} {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato (opcional)</Label>
              <Select value={form.contratoId || 'NINGUNO'} onValueChange={v => setForm({ ...form, contratoId: v === 'NINGUNO' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin contrato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NINGUNO">Sin contrato</SelectItem>
                  {contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.numeroContrato} - {c.conductor?.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <Label>Kilometraje *</Label>
              <Input type="number" value={form.kilometraje} onChange={e => setForm({ ...form, kilometraje: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MANTENIMIENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Trabajo realizado *</Label>
              <Textarea value={form.trabajoRealizado} onChange={e => setForm({ ...form, trabajoRealizado: e.target.value })} rows={2} />
            </div>
            <div><Label>Taller</Label><Input value={form.taller} onChange={e => setForm({ ...form, taller: e.target.value })} /></div>
            <div><Label>Proveedor</Label><Input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></div>
            <div><Label>Costo</Label><Input type="number" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} /></div>
            <div><Label>Próxima revisión (km)</Label><Input type="number" value={form.proximaRevisionKm} onChange={e => setForm({ ...form, proximaRevisionKm: e.target.value })} /></div>
            <div><Label>Próxima revisión (fecha)</Label><Input type="date" value={form.proximaRevisionFecha} onChange={e => setForm({ ...form, proximaRevisionFecha: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notas</Label><Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
