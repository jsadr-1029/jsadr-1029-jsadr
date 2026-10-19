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
import { Plus, CreditCard, CheckCircle, XCircle, AlertTriangle, Search, Zap } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, EstadoBadge, ESTADOS_PAGO } from './helpers'

export function PagosPanel({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [pagos, setPagos] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [modalOpen, setModalOpen] = useState(false)
  const [detallePago, setDetallePago] = useState<any | null>(null)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [form, setForm] = useState<any>({
    contratoId: '', obligacionId: '', conductorId: '',
    monto: '', fechaPago: new Date().toISOString().slice(0, 10),
    metodo: 'CONSIGNACION', banco: '', referencia: '', destinatario: '',
    comprobanteUrl: '', comprobanteTipo: 'IMAGEN', ocrTexto: '',
  })

  const cargar = async () => {
    setLoading(true)
    const [rp, rc, rco] = await Promise.all([
      apiFetch('/api/vehiculos/pagos' + (filtroEstado ? `?estado=${filtroEstado}` : '')),
      apiFetch('/api/vehiculos/contratos'),
      apiFetch('/api/vehiculos/conductores'),
    ])
    if (rp.success) setPagos(rp.data || [])
    if (rc.success) setContratos(rc.data || [])
    if (rco.success) setConductores(rco.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const guardar = async () => {
    if (!form.contratoId || !form.conductorId || !form.monto) {
      toast({ title: 'Faltan campos', variant: 'destructive' })
      return
    }
    const r = await apiFetch('/api/vehiculos/pagos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (r.success) {
      toast({
        title: 'Pago registrado',
        description: r.warning || 'Estado: PENDIENTE — verificar antes de aprobar',
      })
      setModalOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const verDetalle = async (p: any) => {
    // Si tiene contratoId, cargar el contrato completo para ver obligaciones y comprobante
    const r = await apiFetch(`/api/vehiculos/contratos/${p.contratoId}`)
    if (r.success) {
      const contrato = r.data
      const pagoCompleto = contrato.pagos.find((pp: any) => pp.id === p.id)
      setDetallePago({ ...p, contratoCompleto: contrato, ...pagoCompleto })
      setDetalleOpen(true)
    } else {
      setDetallePago(p)
      setDetalleOpen(true)
    }
  }

  const aprobar = async (p: any) => {
    const r = await apiFetch(`/api/vehiculos/pagos/${p.id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (r.success) {
      toast({ title: 'Pago aprobado', description: 'Saldo actualizado' })
      setDetalleOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const rechazar = async (p: any) => {
    const motivo = prompt('Motivo de rechazo:')
    if (!motivo) return
    const r = await apiFetch(`/api/vehiculos/pagos/${p.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    })
    if (r.success) {
      toast({ title: 'Pago rechazado' })
      setDetalleOpen(false)
      cargar()
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const recalcularMora = async () => {
    setRecalcLoading(true)
    const r = await apiFetch('/api/vehiculos/obligaciones/recalcular-mora', { method: 'POST' })
    setRecalcLoading(false)
    if (r.success) {
      toast({
        title: 'Mora recalculada',
        description: `${r.data?.actualizadas} obligaciones · ${r.data?.alertasGeneradas} alertas`,
      })
      cargar()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filtroEstado || 'TODOS'} onValueChange={v => setFiltroEstado(v === 'TODOS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            {ESTADOS_PAGO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={recalcularMora} disabled={recalcLoading}>
          <Zap className="w-4 h-4 mr-1" />
          {recalcLoading ? 'Recalculando...' : 'Recalcular mora'}
        </Button>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Registrar pago
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : pagos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
          No hay pagos {filtroEstado ? `con estado "${filtroEstado}"` : ''}.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {pagos.map(p => (
            <Card key={p.id} className="border shadow-sm cursor-pointer hover:border-primary" onClick={() => verDetalle(p)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{formatCOP(p.monto)}</span>
                      <EstadoBadge estado={p.estado} />
                      {p.ocrCoincide === false && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <AlertTriangle className="w-3 h-3 mr-1" /> OCR inconsistente
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {p.conductor?.nombre} · {p.contrato?.vehiculo?.placa}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(p.fechaPago)} · {p.metodo} · {p.banco || '—'} {p.referencia ? `· ref: ${p.referencia}` : ''}
                    </div>
                  </div>
                  {(p.estado === 'PENDIENTE' || p.estado === 'EN_REVISION') && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="text-green-600" onClick={() => aprobar(p)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => rechazar(p)}>
                        <XCircle className="w-3 h-3 mr-1" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal registrar pago */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar pago / comprobante</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Contrato *</Label>
              <Select value={form.contratoId} onValueChange={v => {
                const c = contratos.find(x => x.id === v)
                setForm({ ...form, contratoId: v, conductorId: c?.conductorId || '' })
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
            <div>
              <Label>Conductor</Label>
              <Input value={conductores.find(c => c.id === form.conductorId)?.nombre || ''} disabled />
            </div>
            <div>
              <Label>Monto *</Label>
              <Input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            </div>
            <div>
              <Label>Fecha pago</Label>
              <Input type="date" value={form.fechaPago} onChange={e => setForm({ ...form, fechaPago: e.target.value })} />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={form.metodo} onValueChange={v => setForm({ ...form, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSIGNACION">Consignación</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="ej: Bancolombia" />
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} />
            </div>
            <div>
              <Label>Destinatario</Label>
              <Input value={form.destinatario} onChange={e => setForm({ ...form, destinatario: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>URL comprobante (foto/PDF)</Label>
              <Input value={form.comprobanteUrl} onChange={e => setForm({ ...form, comprobanteUrl: e.target.value })} placeholder="https://..." />
              <p className="text-xs text-muted-foreground mt-1">
                Sube la imagen a un servicio externo (Imgur, Cloudinary, S3) y pega la URL aquí.
              </p>
            </div>
            <div className="col-span-2">
              <Label>Texto extraído por OCR (opcional)</Label>
              <Textarea value={form.ocrTexto} onChange={e => setForm({ ...form, ocrTexto: e.target.value })} rows={3}
                placeholder="Pega aquí el texto del comprobante si lo procesaste con OCR externo. El sistema detectará valor, fecha, banco y referencia automáticamente." />
            </div>
          </div>
          <div className="p-3 bg-yellow-50 rounded text-xs text-yellow-800">
            ⚠️ El comprobante NO confirma que el dinero llegó. Solo se confirma al aprobar manualmente
            o mediante integración bancaria autorizada.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar}>Registrar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalle pago */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detallePago && (
            <>
              <DialogHeader>
                <DialogTitle>Detalle de pago - {formatCOP(detallePago.monto)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {detallePago.comprobanteUrl && (
                  <div>
                    <Label>Comprobante</Label>
                    <img src={detallePago.comprobanteUrl} alt="Comprobante" className="w-full max-h-80 object-contain border rounded" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 border rounded"><div className="text-xs text-muted-foreground">Conductor</div>{detallePago.conductor?.nombre}</div>
                  <div className="p-2 border rounded"><div className="text-xs text-muted-foreground">Fecha</div>{formatDate(detallePago.fechaPago)}</div>
                  <div className="p-2 border rounded"><div className="text-xs text-muted-foreground">Banco</div>{detallePago.banco || '—'}</div>
                  <div className="p-2 border rounded"><div className="text-xs text-muted-foreground">Referencia</div>{detallePago.referencia || '—'}</div>
                </div>
                {detallePago.ocrValor !== null && (
                  <Card className="border-blue-300">
                    <div className="p-3 text-sm">
                      <div className="font-semibold mb-1">Datos OCR</div>
                      <div>Valor: {detallePago.ocrValor ? formatCOP(detallePago.ocrValor) : '—'}</div>
                      <div>Banco: {detallePago.ocrBanco || '—'}</div>
                      <div>Referencia: {detallePago.ocrReferencia || '—'}</div>
                      {detallePago.ocrCoincide === false && (
                        <div className="mt-1 p-2 bg-yellow-50 rounded text-yellow-800 text-xs">
                          ⚠️ {detallePago.ocrInconsistencias}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
                {(detallePago.estado === 'PENDIENTE' || detallePago.estado === 'EN_REVISION') && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => rechazar(detallePago)} className="text-red-600">
                      <XCircle className="w-4 h-4 mr-1" /> Rechazar
                    </Button>
                    <Button onClick={() => aprobar(detallePago)} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
