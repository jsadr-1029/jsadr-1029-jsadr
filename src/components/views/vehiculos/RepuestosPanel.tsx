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
import { Plus, Package, Wrench, AlertTriangle } from 'lucide-react'
import { apiFetch, formatDate, CATEGORIAS_REPUESTO } from './helpers'

export function RepuestosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [repuestos, setRepuestos] = useState<any[]>([])
  const [instalados, setInstalados] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [mantenimientos, setMantenimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [retiroModal, setRetiroModal] = useState<any | null>(null)
  const [filtroVeh, setFiltroVeh] = useState('')
  const [form, setForm] = useState<any>({
    nombre: '', marca: '', referencia: '', categoria: 'OTRO', descripcion: '',
  })
  const [retiroForm, setRetiroForm] = useState<any>({
    motivoRetiro: 'DESGASTE', fallaReportada: '', kilometrajeRetiro: 0, mantenimientoRetiroId: '',
  })

  const cargar = async () => {
    setLoading(true)
    const [rr, ri, rv, rm] = await Promise.all([
      apiFetch('/api/vehiculos/repuestos'),
      apiFetch('/api/vehiculos/repuestos/instalados' + (filtroVeh ? `?vehiculoId=${filtroVeh}` : '')),
      apiFetch('/api/vehiculos/vehiculos'),
      apiFetch('/api/vehiculos/mantenimientos'),
    ])
    if (rr.success) setRepuestos(rr.data || [])
    if (ri.success) setInstalados(ri.data || [])
    if (rv.success) setVehiculos(rv.data || [])
    if (rm.success) setMantenimientos(rm.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroVeh])

  const guardar = async () => {
    if (!form.nombre) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/repuestos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({ title: 'Repuesto creado' })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const abrirRetirar = (inst: any) => {
    setRetiroForm({
      motivoRetiro: 'DESGASTE', fallaReportada: '',
      kilometrajeRetiro: inst.vehiculo?.kilometraje || 0,
      mantenimientoRetiroId: '',
    })
    setRetiroModal(inst)
  }

  const retirar = async () => {
    if (!retiroModal) return
    const r = await apiFetch(`/api/vehiculos/repuestos/${retiroModal.id}/retirar`, {
      method: 'POST',
      body: JSON.stringify(retiroForm),
    })
    if (r.success) {
      toast({
        title: 'Repuesto retirado',
        description: `Vida útil: ${r.data?.vidaUtil?.dias} días, ${r.data?.vidaUtil?.km} km`,
      })
      setRetiroModal(null)
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
          <Plus className="w-4 h-4 mr-2" /> Nuevo repuesto (catálogo)
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <>
          {/* Instalaciones activas (con vida útil en curso) */}
          <Card>
            <CardContent className="p-3">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Repuestos instalados (activos)
              </h3>
              {instalados.filter(i => !i.fechaRetiro).length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay repuestos activos.</p>
              ) : (
                <div className="space-y-2">
                  {instalados.filter(i => !i.fechaRetiro).map(inst => (
                    <div key={inst.id} className="p-2 rounded border text-sm flex justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{inst.repuesto?.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {inst.vehiculo?.placa} · Instalado: {formatDate(inst.fechaInstalacion)} ({inst.kilometrajeInstalacion} km)
                        </div>
                        <div className="text-xs">
                          En uso: <strong>{inst.diasEnUso} días</strong> · <strong>{inst.kmRecorridos} km</strong>
                          {inst.proximoCambioSugeridoFecha && (
                            <span className="text-orange-600 ml-2">Próx. cambio: {formatDate(inst.proximoCambioSugeridoFecha)}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => abrirRetirar(inst)}>
                        Retirar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de repuestos retirados (con vida útil) */}
          <Card>
            <CardContent className="p-3">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" /> Historial de vida útil
              </h3>
              {instalados.filter(i => i.fechaRetiro).length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay repuestos retirados aún.</p>
              ) : (
                <div className="space-y-2">
                  {instalados.filter(i => i.fechaRetiro).map(inst => (
                    <div key={inst.id} className="p-2 rounded border text-sm">
                      <div className="font-medium">{inst.repuesto?.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {inst.vehiculo?.placa} · Instalado: {formatDate(inst.fechaInstalacion)} ({inst.kilometrajeInstalacion} km)
                      </div>
                      <div className="text-xs">
                        Retirado: {formatDate(inst.fechaRetiro)} ({inst.kilometrajeRetiro} km) ·
                        Vida útil: <strong>{inst.diasEnUso} días</strong> · <strong>{inst.kmRecorridos} km</strong> ·
                        Motivo: {inst.motivoRetiro}
                        {inst.fallaReportada && <span className="text-red-600"> · Falla: {inst.fallaReportada}</span>}
                        {inst.diasEnUso !== null && inst.diasEnUso < 30 && inst.kmRecorridos < 5000 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3" /> Vida útil corta
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Catálogo */}
          <Card>
            <CardContent className="p-3">
              <h3 className="font-semibold mb-2">Catálogo de repuestos</h3>
              {repuestos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay repuestos en catálogo.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {repuestos.map(r => (
                    <div key={r.id} className="p-2 rounded border text-sm">
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.marca && `${r.marca} · `}
                        {r.referencia && `Ref: ${r.referencia}`}
                      </div>
                      <div className="text-xs">{r.categoria}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal crear repuesto */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo repuesto (catálogo)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div><Label>Marca</Label><Input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} /></div>
            <div><Label>Referencia</Label><Input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} /></div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_REPUESTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal retirar repuesto */}
      <Dialog open={!!retiroModal} onOpenChange={() => setRetiroModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Retirar repuesto</DialogTitle></DialogHeader>
          {retiroModal && (
            <div className="space-y-3">
              <div className="text-sm">
                <strong>{retiroModal.repuesto?.nombre}</strong> en {retiroModal.vehiculo?.placa}
              </div>
              <div className="text-xs text-muted-foreground">
                Instalado: {formatDate(retiroModal.fechaInstalacion)} · {retiroModal.kilometrajeInstalacion} km
              </div>
              <div>
                <Label>Motivo de retiro</Label>
                <Select value={retiroForm.motivoRetiro} onValueChange={v => setRetiroForm({ ...retiroForm, motivoRetiro: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESGASTE">Desgaste natural</SelectItem>
                    <SelectItem value="FALLA">Falla prematura</SelectItem>
                    <SelectItem value="MANTENIMIENTO_PREVENTIVO">Mantenimiento preventivo</SelectItem>
                    <SelectItem value="ACCIDENTE">Accidente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kilometraje al retirar</Label>
                <Input type="number" value={retiroForm.kilometrajeRetiro} onChange={e => setRetiroForm({ ...retiroForm, kilometrajeRetiro: parseInt(e.target.value) })} />
              </div>
              <div>
                <Label>Falla reportada (si aplica)</Label>
                <Textarea value={retiroForm.fallaReportada} onChange={e => setRetiroForm({ ...retiroForm, fallaReportada: e.target.value })} rows={2} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRetiroModal(null)}>Cancelar</Button>
                <Button onClick={retirar}>Retirar y calcular vida útil</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
