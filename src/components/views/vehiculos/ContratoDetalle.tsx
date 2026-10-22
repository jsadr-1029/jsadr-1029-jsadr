'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, CheckCircle, XCircle, AlertTriangle, FileText, Zap, Download, PenTool } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, formatDateTime, EstadoBadge, ESTADOS_PAGO } from './helpers'
import { useState } from 'react'

export function ContratoDetalle({ contrato, onChanged }: { contrato: any; onChanged?: () => void }) {
  const { toast } = useToast()
  const [pagoModal, setPagoModal] = useState<any | null>(null)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [notasAdmin, setNotasAdmin] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [recalcMoraLoading, setRecalcMoraLoading] = useState(false)
  const [fotoComprobante, setFotoComprobante] = useState<string | null>(null)
  const [generandoContrato, setGenerandoContrato] = useState(false)

  // === Generar contrato legal con firma electrónica ===
  const generarContratoLegal = async () => {
    setGenerandoContrato(true)
    try {
      const r = await apiFetch(`/api/vehiculos/contratos/${contrato.id}/documento-legal/generar`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (r.success) {
        toast({
          title: 'Contrato legal generado',
          description: r.message || `Contrato ${r.data?.numeroContrato} creado. Link enviado al conductor.`,
        })
        onChanged?.()
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setGenerandoContrato(false)
  }

  // === Descargar PDF de entrega del vehículo ===
  const descargarPDFEntrega = async (tipo: string) => {
    try {
      let token: string | null = null
      const userStr = localStorage.getItem('user')
      if (userStr) {
        try { token = JSON.parse(userStr).token || JSON.parse(userStr).accessToken } catch {}
      }
      const res = await fetch(`/api/vehiculos/vehiculos/${contrato.vehiculoId}/pdf-entrega?tipo=${tipo}&contratoId=${contrato.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        toast({ title: 'Error al generar PDF', description: err.error, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo === 'completo' ? 'Ficha_Completa' : 'Inventario'}_${contrato.vehiculo?.placa || 'vehiculo'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'PDF descargado' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (!contrato) return null

  const totales = contrato.totales || {}
  const vehiculo = contrato.vehiculo
  const conductor = contrato.conductor

  const abrirPago = (p: any) => {
    setPagoModal(p)
    setMontoAprobado(p.monto.toString())
    setNotasAdmin('')
    setMotivoRechazo('')
    setFotoComprobante(null)
    // Cargar comprobante si existe
    if (p.comprobanteUrl) {
      setFotoComprobante(p.comprobanteUrl)
    } else if (p.comprobantes && p.comprobantes.length > 0) {
      setFotoComprobante(p.comprobantes[0].url)
    }
  }

  const aprobarPago = async () => {
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/aprobar`, {
      method: 'POST',
      body: JSON.stringify({ montoAprobado: parseFloat(montoAprobado), notasAdmin }),
    })
    if (r.success) {
      toast({ title: 'Pago aprobado', description: 'Se actualizó el saldo de la obligación' })
      setPagoModal(null)
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const rechazarPago = async () => {
    if (!motivoRechazo) {
      toast({ title: 'Motivo requerido', variant: 'destructive' })
      return
    }
    const r = await apiFetch(`/api/vehiculos/pagos/${pagoModal.id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivoRechazo }),
    })
    if (r.success) {
      toast({ title: 'Pago rechazado' })
      setPagoModal(null)
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  const recalcularMora = async () => {
    setRecalcMoraLoading(true)
    const r = await apiFetch('/api/vehiculos/obligaciones/recalcular-mora', { method: 'POST' })
    setRecalcMoraLoading(false)
    if (r.success) {
      toast({
        title: 'Mora recalculada',
        description: `${r.data?.actualizadas || 0} obligaciones actualizadas, ${r.data?.alertasGeneradas || 0} alertas`,
      })
      onChanged?.()
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <SheetHeader>
        <SheetTitle>Contrato {contrato.numeroContrato}</SheetTitle>
      </SheetHeader>
      <div className="text-xs text-muted-foreground">{formatDateTime(contrato.createdAt)}</div>

      {/* Resumen del contrato */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Conductor</div>
          <div className="font-medium">{conductor?.nombre}</div>
          <div className="text-xs">CC {conductor?.cedula} · {conductor?.telefono}</div>
        </div>
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Vehículo</div>
          <div className="font-medium">{vehiculo?.marca} {vehiculo?.modelo}</div>
          <div className="text-xs">Placa: {vehiculo?.placa}</div>
        </div>
        <div className="p-2 rounded border">
          <div className="text-xs text-muted-foreground">Tarifa / Modalidad</div>
          <div className="font-medium">{formatCOP(contrato.tarifa)} / {contrato.modalidadPago}</div>
          <div className="text-xs">Gracia: {contrato.diasGracia} días · Multa: {formatCOP(contrato.multaDiaria)}/día</div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Facturado</div>
          <div className="text-lg font-bold text-emerald-700">{formatCOP(totales.montoFacturado)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Recibido</div>
          <div className="text-lg font-bold text-green-700">{formatCOP(totales.montoPagado)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Pendiente</div>
          <div className="text-lg font-bold text-orange-700">{formatCOP(totales.montoPendiente)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Multas</div>
          <div className="text-lg font-bold text-red-700">{formatCOP(totales.multas)}</div>
        </CardContent></Card>
      </div>

      {/* Botón recalcular mora */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={recalcularMora} disabled={recalcMoraLoading} variant="outline" size="sm">
          <Zap className="w-4 h-4 mr-1" />
          {recalcMoraLoading ? 'Recalculando...' : 'Recalcular mora'}
        </Button>
        <Button onClick={() => descargarPDFEntrega('completo')} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> PDF ficha completa
        </Button>
        <Button onClick={() => descargarPDFEntrega('inventario')} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" /> PDF inventario
        </Button>
        <Button onClick={generarContratoLegal} disabled={generandoContrato} size="sm" className="bg-gradient-to-r from-purple-500 to-indigo-600">
          <PenTool className="w-4 h-4 mr-1" />
          {generandoContrato ? 'Generando...' : 'Firma electrónica contrato'}
        </Button>
      </div>

      {/* Obligaciones */}
      <div>
        <h3 className="font-semibold mb-2">Obligaciones ({contrato.obligaciones?.length || 0})</h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {contrato.obligaciones?.map(o => (
            <div key={o.id} className="grid grid-cols-6 gap-2 p-2 rounded border text-xs items-center">
              <div className="font-medium">#{o.numeroCuota}</div>
              <div>Vence: {formatDate(o.fechaVencimiento)}</div>
              <div>{formatCOP(o.monto)}{o.multa > 0 && <span className="text-red-600"> +{formatCOP(o.multa)}</span>}</div>
              <div className="text-green-700">{formatCOP(o.montoPagado)}</div>
              <div className="text-orange-700">{formatCOP(o.montoPendiente)}</div>
              <div><EstadoBadge estado={o.estado} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagos */}
      <div>
        <h3 className="font-semibold mb-2">Pagos reportados ({contrato.pagos?.length || 0})</h3>
        {contrato.pagos?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pagos reportados.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {contrato.pagos?.map(p => (
              <div key={p.id} className="p-2 rounded border text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{formatCOP(p.monto)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(p.fechaPago)} · {p.metodo}</span>
                    {p.banco && <span className="ml-2 text-xs">{p.banco} · ref: {p.referencia || '—'}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={p.estado} />
                    {(p.estado === 'PENDIENTE' || p.estado === 'EN_REVISION') && (
                      <Button size="sm" variant="outline" onClick={() => abrirPago(p)}>
                        <CreditCard className="w-3 h-3 mr-1" /> Revisar
                      </Button>
                    )}
                  </div>
                </div>
                {p.ocrCoincide === false && (
                  <div className="mt-1 p-1.5 bg-yellow-50 rounded text-xs text-yellow-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Inconsistencias: {p.ocrInconsistencias}
                  </div>
                )}
                {p.comprobantes && p.comprobantes.length > 0 && p.comprobantes.some((c: any) => c.esDuplicado) && (
                  <div className="mt-1 p-1.5 bg-red-50 rounded text-xs text-red-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Comprobante duplicado detectado
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mantenimientos del vehículo (si tiene) */}
      {contrato.mantenimientos && contrato.mantenimientos.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Mantenimientos ({contrato.mantenimientos.length})</h3>
          <div className="space-y-1">
            {contrato.mantenimientos.slice(0, 5).map(m => (
              <div key={m.id} className="p-2 rounded border text-sm">
                <div className="flex justify-between">
                  <span>{formatDate(m.fecha)} · {m.tipo}</span>
                  <span className="text-red-700">{formatCOP(m.costo)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{m.trabajoRealizado} · {m.kilometraje} km</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de revisión de pago */}
      <Dialog open={!!pagoModal} onOpenChange={() => setPagoModal(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisión de pago</DialogTitle>
            <DialogDescription>
              {pagoModal?.conductor?.nombre} reportó un pago de {pagoModal && formatCOP(pagoModal.monto)} el{' '}
              {pagoModal && formatDate(pagoModal.fechaPago)}
            </DialogDescription>
          </DialogHeader>

          {pagoModal && (
            <div className="space-y-3">
              {/* Comprobante */}
              {fotoComprobante && (
                <div>
                  <Label>Comprobante cargado</Label>
                  <div className="mt-1 border rounded overflow-hidden">
                    <img src={fotoComprobante} alt="Comprobante" className="w-full max-h-80 object-contain bg-gray-100" />
                  </div>
                </div>
              )}

              {/* Datos reportados */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Monto reportado</div>
                  <div className="font-bold">{formatCOP(pagoModal.monto)}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Banco / Ref</div>
                  <div>{pagoModal.banco || '—'} · {pagoModal.referencia || '—'}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Fecha pago</div>
                  <div>{formatDate(pagoModal.fechaPago)}</div>
                </div>
                <div className="p-2 rounded border">
                  <div className="text-xs text-muted-foreground">Método</div>
                  <div>{pagoModal.metodo}</div>
                </div>
              </div>

              {/* OCR resultado */}
              {(pagoModal.ocrValor !== null || pagoModal.ocrBanco) && (
                <Card className="border-blue-300">
                  <CardHeader><CardTitle className="text-sm">Datos extraídos por OCR</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>Valor detectado: <strong>{pagoModal.ocrValor ? formatCOP(pagoModal.ocrValor) : '—'}</strong></div>
                    <div>Banco detectado: <strong>{pagoModal.ocrBanco || '—'}</strong></div>
                    <div>Referencia: <strong>{pagoModal.ocrReferencia || '—'}</strong></div>
                    <div>Destinatario: <strong>{pagoModal.ocrDestinatario || '—'}</strong></div>
                    {pagoModal.ocrCoincide === false && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Inconsistencias: {pagoModal.ocrInconsistencias}</span>
                      </div>
                    )}
                    {pagoModal.ocrCoincide === true && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-green-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Datos OCR coinciden con la obligación</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Obligación aplicada */}
              {pagoModal.obligacion && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Obligación aplicada</CardTitle></CardHeader>
                  <CardContent className="text-sm">
                    <div>Cuota #{pagoModal.obligacion.numeroCuota}</div>
                    <div>Vencimiento: {formatDate(pagoModal.obligacion.fechaVencimiento)}</div>
                    <div>Monto: {formatCOP(pagoModal.obligacion.monto)}</div>
                    <div>Pendiente: {formatCOP(pagoModal.obligacion.montoPendiente)}</div>
                  </CardContent>
                </Card>
              )}

              {/* Acciones admin */}
              <div className="space-y-2">
                <Label>Monto a aprobar (editable)</Label>
                <Input type="number" value={montoAprobado} onChange={e => setMontoAprobado(e.target.value)} />
                <Label>Notas administrativas</Label>
                <Textarea value={notasAdmin} onChange={e => setNotasAdmin(e.target.value)} rows={2} placeholder="Notas internas..." />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800">
                ⚠️ <strong>Recuerda:</strong> Un comprobante cargado NO demuestra que el dinero llegó.
                Verifica en tu cuenta bancaria antes de aprobar.
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPagoModal(null)}>Cerrar</Button>
                <Button variant="destructive" onClick={rechazarPago}>
                  <XCircle className="w-4 h-4 mr-1" /> Rechazar
                </Button>
                <Button onClick={aprobarPago} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-1" /> Aprobar pago
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Importación diferida para evitar dependencia circular
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
