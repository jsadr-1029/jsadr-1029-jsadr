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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { Plus, FileText, ChevronRight, Pencil } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, EstadoBadge, MODALIDADES_PAGO, ESTADOS_CONTRATO } from './helpers'
import { ContratoDetalle } from './ContratoDetalle'

export function ContratosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [contratos, setContratos] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [contratoSeleccionado, setContratoSeleccionado] = useState<any>(null)
  // === Modal de edición de contrato ===
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editandoContrato, setEditandoContrato] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({
    vehiculoId: '', conductorId: '', fechaInicio: '', fechaFin: '',
    estado: 'ACTIVO', modalidadPago: 'MENSUAL', tarifa: '',
    diasGracia: 0, multaDiaria: 0, deposito: 0,
    renovacionAnticipada: false, valorRenovacionAnticipada: 9900,
    contratoPdfUrl: '', motivoCancelacion: '', motivoEdicion: '',
  })
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [confirmarVehiculoConductor, setConfirmarVehiculoConductor] = useState(false)
  const [form, setForm] = useState<any>({
    vehiculoId: '', conductorId: '', fechaInicio: new Date().toISOString().slice(0, 10),
    fechaFin: '', estado: 'ACTIVO', modalidadPago: 'MENSUAL', tarifa: '',
    diasGracia: 0, multaDiaria: 0, deposito: 0,
    cantidadCuotas: 4, renovacionAnticipada: false, valorRenovacionAnticipada: 9900,
    contratoPdfUrl: '',
  })

  const cargar = async () => {
    setLoading(true)
    const [rc, rv, rco] = await Promise.all([
      apiFetch('/api/vehiculos/contratos' + (filtroEstado ? `?estado=${filtroEstado}` : '')),
      apiFetch('/api/vehiculos/vehiculos'),
      apiFetch('/api/vehiculos/conductores'),
    ])
    if (rc.success) setContratos(rc.data || [])
    if (rv.success) setVehiculos(rv.data || [])
    if (rco.success) setConductores(rco.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const abrirCrear = () => {
    setForm({
      vehiculoId: '', conductorId: '', fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: '', estado: 'ACTIVO', modalidadPago: 'MENSUAL', tarifa: '',
      diasGracia: 0, multaDiaria: 20000, deposito: 0,
      cantidadCuotas: 4, renovacionAnticipada: false, valorRenovacionAnticipada: 9900,
      contratoPdfUrl: '',
    })
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!form.vehiculoId || !form.conductorId || !form.tarifa) {
      toast({ title: 'Faltan campos', description: 'Vehículo, conductor y tarifa son obligatorios', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/contratos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({
        title: 'Contrato creado',
        description: `Se generaron ${r.data?.obligacionesGeneradas || 0} obligaciones automáticamente`,
      })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const verDetalle = async (c: any) => {
    const r = await apiFetch(`/api/vehiculos/contratos/${c.id}`)
    if (r.success) {
      setContratoSeleccionado(r.data)
      setDetalleOpen(true)
    }
  }

  const cancelarContrato = async (c: any) => {
    const motivo = prompt('Motivo de cancelación:')
    if (!motivo) return
    const r = await apiFetch(`/api/vehiculos/contratos/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'CANCELADO', motivoCancelacion: motivo, fechaCancelacion: new Date().toISOString() }),
    })
    if (r.success) {
      toast({ title: 'Contrato cancelado', description: 'El vehículo vuelve a estar disponible' })
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  // === Abrir modal de edición de contrato existente ===
  const abrirEditar = (c: any) => {
    // Precargar todos los campos del contrato en el form de edición
    const toYMD = (d: any) => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
      } catch { return '' }
    }
    setEditandoContrato(c)
    setEditForm({
      vehiculoId: c.vehiculoId || c.vehiculo?.id || '',
      conductorId: c.conductorId || c.conductor?.id || '',
      fechaInicio: toYMD(c.fechaInicio),
      fechaFin: toYMD(c.fechaFin),
      estado: c.estado || 'ACTIVO',
      modalidadPago: c.modalidadPago || 'MENSUAL',
      tarifa: c.tarifa ?? '',
      diasGracia: c.diasGracia ?? 0,
      multaDiaria: c.multaDiaria ?? 0,
      deposito: c.deposito ?? 0,
      renovacionAnticipada: c.renovacionAnticipada ?? false,
      valorRenovacionAnticipada: c.valorRenovacionAnticipada ?? 9900,
      contratoPdfUrl: c.contratoPdfUrl || '',
      motivoCancelacion: c.motivoCancelacion || '',
      motivoEdicion: '', // siempre empieza vacío
    })
    setConfirmarVehiculoConductor(false)
    setEditModalOpen(true)
  }

  // === Guardar cambios del contrato editado ===
  const guardarEdicion = async () => {
    if (!editandoContrato) return
    if (!editForm.tarifa) {
      toast({ title: 'Falta tarifa', description: 'La tarifa es obligatoria', variant: 'destructive' })
      return
    }
    if (!editForm.vehiculoId || !editForm.conductorId) {
      toast({ title: 'Faltan campos', description: 'Vehículo y conductor son obligatorios', variant: 'destructive' })
      return
    }
    // Si cambia vehículo o conductor, requerir confirmación previa
    const cambioVeh = editForm.vehiculoId !== editandoContrato.vehiculoId && editandoContrato.vehiculoId
    const cambioCon = editForm.conductorId !== editandoContrato.conductorId && editandoContrato.conductorId
    if ((cambioVeh || cambioCon) && !confirmarVehiculoConductor) {
      toast({
        title: 'Confirma el cambio de vehículo/conductor',
        description: 'Marca el checkbox "Entiendo que cambiar el vehículo/conductor puede afectar las obligaciones existentes" antes de guardar.',
        variant: 'destructive',
      })
      return
    }
    setGuardandoEdicion(true)
    const r = await apiFetch(`/api/vehiculos/contratos/${editandoContrato.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        vehiculoId: editForm.vehiculoId,
        conductorId: editForm.conductorId,
        estado: editForm.estado,
        modalidadPago: editForm.modalidadPago,
        tarifa: editForm.tarifa,
        diasGracia: editForm.diasGracia,
        multaDiaria: editForm.multaDiaria,
        deposito: editForm.deposito,
        fechaInicio: editForm.fechaInicio,
        fechaFin: editForm.fechaFin || null,
        renovacionAnticipada: editForm.renovacionAnticipada,
        valorRenovacionAnticipada: editForm.valorRenovacionAnticipada,
        contratoPdfUrl: editForm.contratoPdfUrl,
        motivoEdicion: editForm.motivoEdicion || '',
      }),
    })
    if (r.success) {
      toast({
        title: 'Contrato actualizado ✓',
        description: `Contrato ${editandoContrato.numeroContrato} guardado correctamente`,
      })
      setEditModalOpen(false)
      setEditandoContrato(null)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error al guardar', description: r.error, variant: 'destructive' })
    }
    setGuardandoEdicion(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={filtroEstado || 'TODOS'} onValueChange={v => setFiltroEstado(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los estados</SelectItem>
            {ESTADOS_CONTRATO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={abrirCrear}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo contrato
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : contratos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay contratos registrados.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {contratos.map(c => (
            <Card key={c.id} className="border shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => verDetalle(c)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{c.numeroContrato}</span>
                      <EstadoBadge estado={c.estado} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {c.conductor?.nombre} · {c.vehiculo?.placa} ({c.vehiculo?.marca} {c.vehiculo?.modelo})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCOP(c.tarifa)} / {c.modalidadPago} · Desde {formatDate(c.fechaInicio)}
                      {c._count && ` · ${c._count.obligaciones} cuotas · ${c._count.pagos} pagos`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {c.estado === 'ACTIVO' && (
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelarContrato(c)}>
                        Cancelar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => abrirEditar(c)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo contrato de arrendamiento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Vehículo *</Label>
              <Select value={form.vehiculoId} onValueChange={v => setForm({ ...form, vehiculoId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                <SelectContent>
                  {vehiculos.map(v => (
                    <SelectItem key={v.id} value={v.id} disabled={v.estado === 'ASIGNADO'}>
                      {v.placa} - {v.marca} {v.modelo} {v.estado === 'ASIGNADO' ? '(asignado)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Conductor *</Label>
              <Select value={form.conductorId} onValueChange={v => setForm({ ...form, conductorId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar conductor" /></SelectTrigger>
                <SelectContent>
                  {conductores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre} - CC {c.cedula}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} />
            </div>
            <div>
              <Label>Modalidad de pago *</Label>
              <Select value={form.modalidadPago} onValueChange={v => setForm({ ...form, modalidadPago: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tarifa *</Label>
              <Input type="number" value={form.tarifa} onChange={e => setForm({ ...form, tarifa: e.target.value })}
                placeholder="ej: 80000 para $80.000 por periodo" />
            </div>
            <div>
              <Label>Cantidad de cuotas</Label>
              <Input type="number" value={form.cantidadCuotas} onChange={e => setForm({ ...form, cantidadCuotas: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>Días de gracia</Label>
              <Input type="number" value={form.diasGracia} onChange={e => setForm({ ...form, diasGracia: e.target.value })} />
            </div>
            <div>
              <Label>Multa diaria (mora)</Label>
              <Input type="number" value={form.multaDiaria} onChange={e => setForm({ ...form, multaDiaria: e.target.value })}
                placeholder="ej: 20000" />
            </div>
            <div>
              <Label>Depósito</Label>
              <Input type="number" value={form.deposito} onChange={e => setForm({ ...form, deposito: e.target.value })} />
            </div>
            <div>
              <Label>Estado inicial</Label>
              <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BORRADOR">Borrador (no genera obligaciones)</SelectItem>
                  <SelectItem value="ACTIVO">Activo (genera obligaciones automáticamente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 p-3 bg-blue-50 rounded text-sm text-blue-800">
              <strong>💡 Importante:</strong> Al crear un contrato ACTIVO, el sistema generará automáticamente
              las obligaciones de pago según la modalidad seleccionada. Cada obligación tendrá su fecha de
              vencimiento y se aplicará la multa diaria configurada cuando venza.
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="renov" checked={form.renovacionAnticipada} onChange={e => setForm({ ...form, renovacionAnticipada: e.target.checked })} />
              <Label htmlFor="renov">Activar renovación anticipada (${form.valorRenovacionAnticipada})</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Crear contrato</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detalleOpen} onOpenChange={setDetalleOpen}>
        <SheetContent className="max-w-none w-full md:max-w-3xl overflow-y-auto">
          {contratoSeleccionado && <ContratoDetalle contrato={contratoSeleccionado} onChanged={cargar} />}
        </SheetContent>
      </Sheet>

      {/* === MODAL: Editar contrato existente === */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Editar contrato {editandoContrato?.numeroContrato}
            </DialogTitle>
          </DialogHeader>
          {editandoContrato && (
            <div className="space-y-4">
              {/* Resumen del contrato */}
              <div className="bg-gray-50 border rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Contrato:</span> <strong>{editandoContrato.numeroContrato}</strong></div>
                <div><span className="text-muted-foreground">Obligaciones:</span> <strong>{editandoContrato._count?.obligaciones || 0}</strong></div>
                <div><span className="text-muted-foreground">Vehículo actual:</span> <strong>{editandoContrato.vehiculo?.placa}</strong> ({editandoContrato.vehiculo?.marca} {editandoContrato.vehiculo?.modelo})</div>
                <div><span className="text-muted-foreground">Conductor actual:</span> <strong>{editandoContrato.conductor?.nombre}</strong></div>
              </div>

              {/* Campos editables */}
              <div className="grid grid-cols-2 gap-3">
                {/* === Vehículo y conductor === */}
                <div className="col-span-2">
                  <Label>Vehículo *</Label>
                  <Select value={editForm.vehiculoId} onValueChange={v => setEditForm({ ...editForm, vehiculoId: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                    <SelectContent>
                      {vehiculos.map(v => {
                        // Mostrar siempre el vehículo actual del contrato aunque esté asignado
                        const esActual = v.id === editandoContrato.vehiculoId
                        return (
                          <SelectItem key={v.id} value={v.id} disabled={v.estado === 'ASIGNADO' && !esActual}>
                            {v.placa} - {v.marca} {v.modelo}
                            {v.estado === 'ASIGNADO' && !esActual ? ' (asignado)' : ''}
                            {esActual ? ' (actual)' : ''}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Conductor *</Label>
                  <Select value={editForm.conductorId} onValueChange={v => setEditForm({ ...editForm, conductorId: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar conductor" /></SelectTrigger>
                    <SelectContent>
                      {conductores.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} - CC {c.cedula}
                          {c.id === editandoContrato.conductorId ? ' (actual)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* === Confirmación si cambia vehículo o conductor === */}
                {((editForm.vehiculoId && editForm.vehiculoId !== editandoContrato.vehiculoId) ||
                  (editForm.conductorId && editForm.conductorId !== editandoContrato.conductorId)) && (
                  <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="confirm-veh-con"
                        checked={confirmarVehiculoConductor}
                        onChange={e => setConfirmarVehiculoConductor(e.target.checked)}
                        className="mt-1"
                      />
                      <label htmlFor="confirm-veh-con" className="text-sm text-red-800">
                        <strong>Entiendo que cambiar el vehículo/conductor puede afectar las obligaciones existentes.</strong>
                        <p className="text-xs text-red-700 mt-1">
                          Las obligaciones ya creadas seguirán asociadas al vehículo/conductor anterior.
                          Las nuevas obligaciones que se generen usarán el nuevo vehículo/conductor.
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* === Fechas y modalidad === */}
                <div>
                  <Label>Fecha inicio *</Label>
                  <Input type="date" value={editForm.fechaInicio} onChange={e => setEditForm({ ...editForm, fechaInicio: e.target.value })} />
                </div>
                <div>
                  <Label>Fecha fin</Label>
                  <Input type="date" value={editForm.fechaFin} onChange={e => setEditForm({ ...editForm, fechaFin: e.target.value })} placeholder="Vacío = indefinido" />
                </div>
                <div>
                  <Label>Estado del contrato</Label>
                  <Select value={editForm.estado} onValueChange={v => setEditForm({ ...editForm, estado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_CONTRATO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modalidad de pago</Label>
                  <Select value={editForm.modalidadPago} onValueChange={v => setEditForm({ ...editForm, modalidadPago: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tarifa *</Label>
                  <Input type="number" value={editForm.tarifa} onChange={e => setEditForm({ ...editForm, tarifa: e.target.value })} />
                </div>
                <div>
                  <Label>Días de gracia</Label>
                  <Input type="number" value={editForm.diasGracia} onChange={e => setEditForm({ ...editForm, diasGracia: e.target.value })} />
                </div>
                <div>
                  <Label>Multa diaria (mora)</Label>
                  <Input type="number" value={editForm.multaDiaria} onChange={e => setEditForm({ ...editForm, multaDiaria: e.target.value })} />
                </div>
                <div>
                  <Label>Depósito</Label>
                  <Input type="number" value={editForm.deposito} onChange={e => setEditForm({ ...editForm, deposito: e.target.value })} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-renov"
                    checked={editForm.renovacionAnticipada}
                    onChange={e => setEditForm({ ...editForm, renovacionAnticipada: e.target.checked })}
                  />
                  <Label htmlFor="edit-renov">Activar renovación anticipada (${editForm.valorRenovacionAnticipada})</Label>
                </div>
                <div className="col-span-2">
                  <Label>URL del PDF del contrato (opcional)</Label>
                  <Input type="text" value={editForm.contratoPdfUrl} onChange={e => setEditForm({ ...editForm, contratoPdfUrl: e.target.value })} placeholder="https://..." />
                </div>

                {/* === Motivo/Notas de la edición === */}
                <div className="col-span-2">
                  <Label>Motivo de la edición (notas internas) *</Label>
                  <Textarea
                    value={editForm.motivoEdicion}
                    onChange={e => setEditForm({ ...editForm, motivoEdicion: e.target.value })}
                    rows={3}
                    placeholder="Describe por qué se está editando el contrato. Ej: Corrección de fechas pactadas, cambio de tarifa acordada, etc. Este motivo queda registrado en la auditoría."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Queda registrado en la auditoría del sistema con usuario, fecha y cambios realizados.
                  </p>
                </div>
              </div>

              {/* Aviso importante */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
                <strong>⚠️ Importante:</strong> Los cambios en fechas y tarifa aquí actualizan el contrato pero <strong>no regeneran</strong>
                las obligaciones ya creadas. Si necesitas regenerar las obligaciones PENDIENTES con las
                nuevas fechas, usa el botón <strong>"Editar fechas"</strong> dentro del detalle del contrato
                (con la opción "Regenerar obligaciones" activada).
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={guardandoEdicion}>Cancelar</Button>
            <Button onClick={guardarEdicion} disabled={guardandoEdicion} className="bg-blue-600 hover:bg-blue-700 text-white">
              {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
