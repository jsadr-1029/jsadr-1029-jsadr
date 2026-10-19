'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Receipt } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, CATEGORIAS_GASTO } from './helpers'

export function GastosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [gastos, setGastos] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroVeh, setFiltroVeh] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<any>({
    vehiculoId: '', fecha: new Date().toISOString().slice(0, 10),
    concepto: '', monto: '', categoria: 'OTRO', proveedor: '', comprobanteUrl: '',
  })

  const cargar = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroVeh) params.set('vehiculoId', filtroVeh)
    if (filtroCat) params.set('categoria', filtroCat)
    const [rg, rv] = await Promise.all([
      apiFetch('/api/vehiculos/gastos' + (params.toString() ? `?${params}` : '')),
      apiFetch('/api/vehiculos/vehiculos'),
    ])
    if (rg.success) setGastos(rg.data || [])
    if (rv.success) setVehiculos(rv.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroVeh, filtroCat])

  const guardar = async () => {
    if (!form.vehiculoId || !form.concepto || !form.monto) {
      toast({ title: 'Faltan campos', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/gastos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({ title: 'Gasto registrado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const total = gastos.reduce((s, g) => s + (g.monto || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroVeh || 'TODOS'} onValueChange={v => setFiltroVeh(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vehículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            {vehiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCat || 'TODAS'} onValueChange={v => setFiltroCat(v === 'TODAS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            {CATEGORIAS_GASTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo gasto
        </Button>
      </div>

      <Card><CardContent className="p-3 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Total gastos: <strong>{gastos.length}</strong></span>
        <span className="text-lg font-bold text-red-700">{formatCOP(total)}</span>
      </CardContent></Card>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : gastos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay gastos registrados.
        </CardContent></Card>
      ) : (
        <div className="space-y-1">
          {gastos.map(g => (
            <div key={g.id} className="p-2 rounded border text-sm flex justify-between">
              <div>
                <div className="font-medium">{g.concepto} <span className="text-xs bg-blue-100 text-blue-800 px-1.5 rounded ml-1">{g.categoria}</span></div>
                <div className="text-xs text-muted-foreground">
                  {g.vehiculo?.placa} · {formatDate(g.fecha)} {g.proveedor && `· ${g.proveedor}`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-700">{formatCOP(g.monto)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo gasto</DialogTitle></DialogHeader>
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
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_GASTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Concepto *</Label><Input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} /></div>
            <div><Label>Monto *</Label><Input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></div>
            <div><Label>Proveedor</Label><Input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></div>
            <div className="col-span-2"><Label>URL comprobante</Label><Input value={form.comprobanteUrl} onChange={e => setForm({ ...form, comprobanteUrl: e.target.value })} /></div>
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
