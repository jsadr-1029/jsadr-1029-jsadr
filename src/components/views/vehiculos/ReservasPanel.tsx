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
import { Plus, CheckCircle, XCircle, Calendar, MapPin, Route, TrendingUp, Wrench } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, EstadoBadge } from './helpers'

const COLORES_ESTADO: Record<string, string> = {
  PENDIENTE_APROBACION: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  APROBADA: 'bg-blue-100 text-blue-800 border-blue-300',
  EN_CURSO: 'bg-purple-100 text-purple-800 border-purple-300',
  COMPLETADA: 'bg-green-100 text-green-800 border-green-300',
  RECHAZADA: 'bg-red-100 text-red-800 border-red-300',
  CANCELADA: 'bg-gray-100 text-gray-600 border-gray-300',
}

export function ReservasPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [reservas, setReservas] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [reservaSel, setReservaSel] = useState<any | null>(null)
  const [finalizarModal, setFinalizarModal] = useState<any | null>(null)
  const [finalizarForm, setFinalizarForm] = useState<any>({
    peajesReportados: 0, valorPeajesReportado: 0, observacionesConductor: '',
  })

  const [form, setForm] = useState<any>({
    contratoId: '', origen: '', destino: '',
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaFin: '',
    descripcion: '',
    valorTotal: '',
    porcentajeConductor: 60,
    porcentajeAdministrador: 25,
    porcentajeMantenimiento: 15,
    cantidadPeajes: 0,
    valorTotalPeajes: 0,
    peajesDescontadosDelTotal: true,
    clienteNombre: '', clienteTelefono: '', clienteDocumento: '',
  })

  const cargar = async () => {
    setLoading(true)
    const [rr, rc] = await Promise.all([
      apiFetch('/api/vehiculos/reservas' + (filtroEstado ? `?estado=${filtroEstado}` : '')),
      apiFetch('/api/vehiculos/contratos'),
    ])
    if (rr.success) setReservas(rr.data || [])
    if (rc.success) setContratos(rc.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEstado])

  // Cálculo en vivo de la distribución
  const distCalculada = (() => {
    const vTotal = parseFloat(form.valorTotal) || 0
    const vPeajes = parseFloat(form.valorTotalPeajes) || 0
    const base = form.peajesDescontadosDelTotal ? Math.max(0, vTotal - vPeajes) : vTotal
    return {
      montoConductor: Math.round((base * form.porcentajeConductor) / 100),
      montoAdministrador: Math.round((base * form.porcentajeAdministrador) / 100),
      montoMantenimiento: Math.round((base * form.porcentajeMantenimiento) / 100),
      montoPeajes: vPeajes,
      base,
    }
  })()

  const guardar = async () => {
    if (!form.contratoId || !form.origen || !form.destino || !form.valorTotal) {
      toast({ title: 'Faltan campos', variant: 'destructive' })
      return
    }
    const suma = form.porcentajeConductor + form.porcentajeAdministrador + form.porcentajeMantenimiento
    if (Math.abs(suma - 100) > 0.1) {
      toast({ title: 'Porcentajes', description: `Deben sumar 100%. Actual: ${suma}%`, variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/reservas', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({ title: 'Reserva creada', description: `Número: ${r.data.numeroReserva}` })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const aprobar = async (reserva: any) => {
    const r = await apiFetch(`/api/vehiculos/reservas/${reserva.id}/aprobar`, { method: 'POST' })
    if (r.success) {
      toast({ title: 'Reserva aprobada' })
      cargar()
      onChanged?.()
      setDetalleOpen(false)
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const rechazar = async (reserva: any) => {
    const motivo = prompt('Motivo de rechazo:')
    if (!motivo) return
    const r = await apiFetch(`/api/vehiculos/reservas/${reserva.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivoRechazo: motivo }),
    })
    if (r.success) {
      toast({ title: 'Reserva rechazada' })
      cargar()
      onChanged?.()
      setDetalleOpen(false)
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const verDetalle = (r: any) => {
    setReservaSel(r)
    setDetalleOpen(true)
  }

  const abrirFinalizar = (r: any) => {
    setFinalizarForm({
      peajesReportados: r.cantidadPeajes || 0,
      valorPeajesReportado: r.valorTotalPeajes || 0,
      observacionesConductor: r.observacionesConductor || '',
    })
    setFinalizarModal(r)
  }

  const finalizar = async () => {
    if (!finalizarModal) return
    const r = await apiFetch(`/api/vehiculos/reservas/${finalizarModal.id}/finalizar`, {
      method: 'POST',
      body: JSON.stringify(finalizarForm),
    })
    if (r.success) {
      toast({ title: 'Reserva finalizada', description: r.message })
      setFinalizarModal(null)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const getContrato = (id: string) => contratos.find(c => c.id === id)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroEstado || 'TODOS'} onValueChange={v => setFiltroEstado(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos los estados</SelectItem>
            {Object.keys(COLORES_ESTADO).map(e => <SelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nueva reserva
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : reservas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay reservas registradas.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reservas.map(r => {
            const contrato = getContrato(r.contratoId)
            return (
              <Card key={r.id} className="border shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => verDetalle(r)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{r.numeroReserva}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${COLORES_ESTADO[r.estado] || ''}`}>{r.estado.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-sm mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {r.origen} → {r.destino}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(r.fechaInicio)}{r.fechaFin && ` - ${formatDate(r.fechaFin)}`}
                        {contrato && ` · ${contrato.conductor?.nombre} (${contrato.vehiculo?.placa})`}
                      </div>
                      <div className="text-xs mt-1 grid grid-cols-4 gap-2">
                        <span className="text-blue-700">Cond: {formatCOP(r.montoConductor)}</span>
                        <span className="text-purple-700">Admin: {formatCOP(r.montoAdministrador)}</span>
                        <span className="text-orange-700">Mant: {formatCOP(r.montoMantenimiento)}</span>
                        <span className="text-red-700">Peajes: {formatCOP(r.montoPeajes)} ({r.cantidadPeajes})</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatCOP(r.valorTotal)}</div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal crear reserva */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva reserva de viaje</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
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
            </div>
            <div><Label>Origen *</Label><Input value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} placeholder="Medellín" /></div>
            <div><Label>Destino *</Label><Input value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} placeholder="Bogotá" /></div>
            <div><Label>Fecha inicio *</Label><Input type="datetime-local" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} /></div>
            <div><Label>Fecha fin</Label><Input type="datetime-local" value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} /></div>
            <div className="col-span-2"><Label>Descripción del viaje</Label><Textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} /></div>
            <div><Label>Valor total contratado *</Label><Input type="number" value={form.valorTotal} onChange={e => setForm({ ...form, valorTotal: e.target.value })} /></div>
            <div><Label>Cantidad de peajes</Label><Input type="number" value={form.cantidadPeajes} onChange={e => setForm({ ...form, cantidadPeajes: e.target.value })} /></div>
            <div><Label>Valor total peajes</Label><Input type="number" value={form.valorTotalPeajes} onChange={e => setForm({ ...form, valorTotalPeajes: e.target.value })} /></div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="peajesDesc" checked={form.peajesDescontadosDelTotal} onChange={e => setForm({ ...form, peajesDescontadosDelTotal: e.target.checked })} />
              <Label htmlFor="peajesDesc">Peajes se descuentan del total antes de distribuir</Label>
            </div>

            <div className="col-span-2 border-t pt-3 mt-1">
              <h3 className="font-semibold text-sm mb-2">Distribución del cobro (debe sumar 100%)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>% Conductor</Label>
                  <Input type="number" value={form.porcentajeConductor} onChange={e => setForm({ ...form, porcentajeConductor: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>% Administrador</Label>
                  <Input type="number" value={form.porcentajeAdministrador} onChange={e => setForm({ ...form, porcentajeAdministrador: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>% Mantenimiento</Label>
                  <Input type="number" value={form.porcentajeMantenimiento} onChange={e => setForm({ ...form, porcentajeMantenimiento: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className={`text-xs mt-1 ${(form.porcentajeConductor + form.porcentajeAdministrador + form.porcentajeMantenimiento) === 100 ? 'text-green-700' : 'text-red-700 font-bold'}`}>
                Suma: {form.porcentajeConductor + form.porcentajeAdministrador + form.porcentajeMantenimiento}% {form.porcentajeConductor + form.porcentajeAdministrador + form.porcentajeMantenimiento === 100 ? '✓' : '(debe ser 100%)'}
              </div>
            </div>

            {/* Vista previa distribución */}
            <div className="col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Vista previa de la distribución
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Base de cálculo</div>
                  <div className="font-bold">{formatCOP(distCalculada.base)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Conductor ({form.porcentajeConductor}%)</div>
                  <div className="font-bold text-blue-700">{formatCOP(distCalculada.montoConductor)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Admin ({form.porcentajeAdministrador}%)</div>
                  <div className="font-bold text-purple-700">{formatCOP(distCalculada.montoAdministrador)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Mantenimiento ({form.porcentajeMantenimiento}%)</div>
                  <div className="font-bold text-orange-700">{formatCOP(distCalculada.montoMantenimiento)}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Peajes ({form.cantidadPeajes} peajes): <strong className="text-red-700">{formatCOP(distCalculada.montoPeajes)}</strong>
              </div>
            </div>

            <div className="col-span-2 border-t pt-3">
              <h3 className="font-semibold text-sm mb-2">Datos del cliente (opcional)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Nombre</Label><Input value={form.clienteNombre} onChange={e => setForm({ ...form, clienteNombre: e.target.value })} /></div>
                <div><Label>Teléfono</Label><Input value={form.clienteTelefono} onChange={e => setForm({ ...form, clienteTelefono: e.target.value })} /></div>
                <div><Label>Documento</Label><Input value={form.clienteDocumento} onChange={e => setForm({ ...form, clienteDocumento: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Crear reserva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {reservaSel && (
            <>
              <DialogHeader>
                <DialogTitle>Reserva {reservaSel.numeroReserva}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full border ${COLORES_ESTADO[reservaSel.estado]}`}>
                    {reservaSel.estado.replace(/_/g, ' ')}
                  </span>
                  {reservaSel.creadoPor === 'CONDUCTOR' && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Solicitada por conductor</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Origen:</span> <strong>{reservaSel.origen}</strong></div>
                  <div><span className="text-muted-foreground">Destino:</span> <strong>{reservaSel.destino}</strong></div>
                  <div><span className="text-muted-foreground">Fecha inicio:</span> {formatDate(reservaSel.fechaInicio)}</div>
                  <div><span className="text-muted-foreground">Fecha fin:</span> {reservaSel.fechaFin ? formatDate(reservaSel.fechaFin) : '—'}</div>
                </div>
                {reservaSel.descripcion && (
                  <div className="text-sm"><span className="text-muted-foreground">Descripción:</span> {reservaSel.descripcion}</div>
                )}

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="font-semibold text-blue-900">Distribución del cobro</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Valor total:</span> <strong className="text-base">{formatCOP(reservaSel.valorTotal)}</strong></div>
                      <div><span className="text-muted-foreground">Peajes:</span> {formatCOP(reservaSel.montoPeajes)} ({reservaSel.cantidadPeajes} peajes)</div>
                      <div><span className="text-muted-foreground">Conductor ({reservaSel.porcentajeConductor}%):</span> <strong className="text-blue-700">{formatCOP(reservaSel.montoConductor)}</strong></div>
                      <div><span className="text-muted-foreground">Administrador ({reservaSel.porcentajeAdministrador}%):</span> <strong className="text-purple-700">{formatCOP(reservaSel.montoAdministrador)}</strong></div>
                      <div><span className="text-muted-foreground">Mantenimiento ({reservaSel.porcentajeMantenimiento}%):</span> <strong className="text-orange-700">{formatCOP(reservaSel.montoMantenimiento)}</strong></div>
                    </div>
                    {reservaSel.observacionesConductor && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        Observaciones: {reservaSel.observacionesConductor}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {reservaSel.clienteNombre && (
                  <div className="text-sm border-t pt-2">
                    <div className="font-semibold mb-1">Cliente</div>
                    {reservaSel.clienteNombre} · {reservaSel.clienteTelefono} {reservaSel.clienteDocumento && `· CC ${reservaSel.clienteDocumento}`}
                  </div>
                )}

                {reservaSel.motivoRechazo && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Motivo de rechazo:</strong> {reservaSel.motivoRechazo}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  {reservaSel.estado === 'PENDIENTE_APROBACION' && (
                    <>
                      <Button variant="outline" onClick={() => rechazar(reservaSel)} className="text-red-600">
                        <XCircle className="w-4 h-4 mr-1" /> Rechazar
                      </Button>
                      <Button onClick={() => aprobar(reservaSel)} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
                      </Button>
                    </>
                  )}
                  {reservaSel.estado === 'APROBADA' && (
                    <Button onClick={() => abrirFinalizar(reservaSel)} variant="outline">
                      <Wrench className="w-4 h-4 mr-1" /> Finalizar viaje y reportar peajes
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal finalizar */}
      <Dialog open={!!finalizarModal} onOpenChange={() => setFinalizarModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Finalizar reserva</DialogTitle></DialogHeader>
          {finalizarModal && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Reporta los peajes reales del viaje. Los montos se recalcularán automáticamente.
              </p>
              <div>
                <Label>Cantidad de peajes reales</Label>
                <Input type="number" value={finalizarForm.peajesReportados} onChange={e => setFinalizarForm({ ...finalizarForm, peajesReportados: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Valor total de peajes</Label>
                <Input type="number" value={finalizarForm.valorPeajesReportado} onChange={e => setFinalizarForm({ ...finalizarForm, valorPeajesReportado: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Observaciones del conductor</Label>
                <Textarea value={finalizarForm.observacionesConductor} onChange={e => setFinalizarForm({ ...finalizarForm, observacionesConductor: e.target.value })} rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFinalizarModal(null)}>Cancelar</Button>
                <Button onClick={finalizar} className="bg-green-600 hover:bg-green-700">Finalizar y recalcular</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { ChevronRight } from 'lucide-react'
