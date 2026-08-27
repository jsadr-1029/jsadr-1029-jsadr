'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatCOP, formatDate, formatRelativeTime, estadoPrestamoColor, estadoPagoColor, formatPercent } from '@/lib/format'
import { FileText, ArrowLeft, CreditCard, Bell, Scale, History, FileCheck, Wallet, Plus, Send, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

type View = { name: string; id?: string }

export function PrestamoDetalle({ id, navigate }: { id: string; navigate: (v: any) => void }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: p, loading } = useFetch<any>(`/api/prestamos/${id}`, { refreshKey })
  const [pagoOpen, setPagoOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  if (loading) return <LoadingState />
  if (!p) return <EmptyState icon={FileText} title="Préstamo no encontrado" />

  const progreso = p.numeroCuotas > 0 ? (p.cuotasPagadas / p.numeroCuotas) * 100 : 0

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'prestamos' })} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver a préstamos
      </Button>

      <PageHeader
        title={p.codigo}
        subtitle={`${p.cliente?.nombre} · CC ${p.cliente?.cedula}`}
        icon={FileText}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={estadoPrestamoColor(p.estado)}>{p.estado}</Badge>
            <Button variant="outline" size="sm" onClick={() => navigate({ name: 'cliente-detalle', id: p.clienteId })}>
              Ver cliente
            </Button>
          </div>
        }
      />

      {/* KPIs del préstamo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-slate-500">Monto Principal</p>
          <p className="text-lg font-bold text-slate-900">{formatCOP(p.montoPrincipal)}</p>
          <p className="text-xs text-slate-400">{formatPercent(p.tasaInteresMensual)} mensual</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Total a Pagar</p>
          <p className="text-lg font-bold text-emerald-700">{formatCOP(p.totalPagar)}</p>
          <p className="text-xs text-slate-400">Interés: {formatCOP(p.totalInteres)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Saldo Pendiente</p>
          <p className="text-lg font-bold text-purple-700">{formatCOP(p.saldoTotal)}</p>
          <p className="text-xs text-slate-400">Pagado: {formatCOP(p.montoPagado)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Cuota</p>
          <p className="text-lg font-bold text-slate-900">{formatCOP(p.montoCuota)}</p>
          <p className="text-xs text-slate-400">{p.frecuencia} · {p.plazoMeses}m</p>
        </Card>
      </div>

      {/* Barra de progreso */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Progreso del préstamo</p>
          <p className="text-sm text-slate-500">{p.cuotasPagadas}/{p.numeroCuotas} cuotas pagadas</p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
          <div>
            <p className="text-slate-500">Solicitud</p>
            <p className="font-medium text-slate-900">{formatDate(p.fechaSolicitud, { withTime: true })}</p>
          </div>
          {p.fechaAprobacion && (
            <div>
              <p className="text-slate-500">Aprobación</p>
              <p className="font-medium text-slate-900">{formatDate(p.fechaAprobacion, { withTime: true })}</p>
            </div>
          )}
          {p.fechaVencimiento && (
            <div>
              <p className="text-slate-500">Vencimiento</p>
              <p className="font-medium text-slate-900">{formatDate(p.fechaVencimiento)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPagoOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Registrar Pago
        </Button>
        <Button onClick={() => setNotifOpen(true)} variant="outline" size="sm">
          <Bell className="w-4 h-4 mr-1" /> Enviar WhatsApp
        </Button>
        {p.casoJuridico && (
          <Button onClick={() => navigate({ name: 'juridicos' })} variant="outline" size="sm">
            <Scale className="w-4 h-4 mr-1" /> Ver Caso Jurídico
          </Button>
        )}
      </div>

      <Tabs defaultValue="pagos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="pagos"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Pagos</TabsTrigger>
          <TabsTrigger value="notificaciones"><Bell className="w-3.5 h-3.5 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="firmas"><FileCheck className="w-3.5 h-3.5 mr-1.5" />Firmas</TabsTrigger>
          <TabsTrigger value="bitacora"><History className="w-3.5 h-3.5 mr-1.5" />Bitácora</TabsTrigger>
          <TabsTrigger value="documentos"><FileText className="w-3.5 h-3.5 mr-1.5" />Docs</TabsTrigger>
        </TabsList>

        {/* Tab Pagos */}
        <TabsContent value="pagos">
          <Card title="Pagos Registrados" subtitle={`${p.pagos?.length || 0} pagos`}>
            {!p.pagos?.length ? (
              <EmptyState icon={CreditCard} title="Sin pagos registrados" />
            ) : (
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Fecha</th>
                      <th className="text-center px-4 py-2 font-semibold text-slate-600">Cuota</th>
                      <th className="text-right px-4 py-2 font-semibold text-slate-600">Capital</th>
                      <th className="text-right px-4 py-2 font-semibold text-slate-600 hidden sm:table-cell">Interés</th>
                      <th className="text-right px-4 py-2 font-semibold text-slate-600 hidden sm:table-cell">Mora</th>
                      <th className="text-right px-4 py-2 font-semibold text-slate-600">Total</th>
                      <th className="text-center px-4 py-2 font-semibold text-slate-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {p.pagos.map((pa: any) => (
                      <tr key={pa.id}>
                        <td className="px-4 py-2 text-xs">
                          <p className="font-medium text-slate-900">{formatDate(pa.fechaPago)}</p>
                          <p className="text-slate-500">{pa.metodoPago}</p>
                        </td>
                        <td className="px-4 py-2 text-center">{pa.numeroCuota}</td>
                        <td className="px-4 py-2 text-right">{formatCOP(pa.montoCapital)}</td>
                        <td className="px-4 py-2 text-right hidden sm:table-cell">{formatCOP(pa.montoInteres)}</td>
                        <td className="px-4 py-2 text-right hidden sm:table-cell">{formatCOP(pa.montoMora)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCOP(pa.montoTotal)}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge className={estadoPagoColor(pa.estado)}>{pa.estado}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab Notificaciones */}
        <TabsContent value="notificaciones">
          <Card title="Notificaciones WhatsApp" subtitle={`${p.notificaciones?.length || 0} enviadas`}>
            {!p.notificaciones?.length ? (
              <EmptyState icon={Bell} title="Sin notificaciones" description="Crea la primera notificación." />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {p.notificaciones.map((n: any) => (
                  <div key={n.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="info">{n.tipo}</Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant={n.estado === 'ENVIADO' ? 'success' : n.estado === 'PENDIENTE_MANUAL' ? 'warning' : 'neutral'}>
                          {n.estado}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatRelativeTime(n.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3 mb-2">{n.mensaje}</p>
                    {n.linkWaMe && (
                      <a
                        href={n.linkWaMe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                      >
                        <Send className="w-3 h-3" /> Abrir en WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab Firmas */}
        <TabsContent value="firmas">
          <Card title="Firmas Digitales" subtitle={`${p.firmas?.length || 0} firmas`}>
            {!p.firmas?.length ? (
              <EmptyState icon={FileCheck} title="Sin firmas" description="No se han iniciado firmas para este préstamo." />
            ) : (
              <div className="space-y-2">
                {p.firmas.map((f: any) => (
                  <div key={f.id} className="p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900">{f.tipo}</p>
                        <p className="text-xs text-slate-500">Canal: {f.otpCanal || 'Sin especificar'}</p>
                      </div>
                      <Badge variant={f.estadoFirma === 'FIRMADO' ? 'success' : f.estadoFirma === 'OTP_ENVIADO' ? 'info' : 'warning'}>
                        {f.estadoFirma}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">OTP Enviado</p>
                        <p className="font-medium text-slate-900">{f.otpEnviado ? 'Sí' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">OTP Validado</p>
                        <p className="font-medium text-slate-900">{f.otpValidado ? 'Sí' : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Intentos</p>
                        <p className="font-medium text-slate-900">{f.intentosOTP}/{f.maxIntentos}</p>
                      </div>
                      {f.fechaFirmaCompleta && (
                        <div>
                          <p className="text-slate-500">Firmado</p>
                          <p className="font-medium text-slate-900">{formatDate(f.fechaFirmaCompleta, { withTime: true })}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab Bitácora */}
        <TabsContent value="bitacora">
          <Card title="Bitácora de Eventos" subtitle={`${p.bitacoras?.length || 0} eventos`}>
            {!p.bitacoras?.length ? (
              <EmptyState icon={History} title="Sin eventos" />
            ) : (
              <div className="space-y-3">
                {p.bitacoras.map((b: any) => (
                  <div key={b.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{b.titulo}</p>
                        <span className="text-xs text-slate-400 flex-shrink-0">{formatRelativeTime(b.fechaEvento)}</span>
                      </div>
                      {b.descripcion && <p className="text-xs text-slate-600 mt-0.5">{b.descripcion}</p>}
                      {b.resultado && <p className="text-xs text-emerald-700 mt-0.5 font-medium">→ {b.resultado}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">por {b.usuarioNombre || 'Sistema'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab Documentos */}
        <TabsContent value="documentos">
          <Card title="Documentos" subtitle={`${p.documentos?.length || 0} documentos`}>
            {!p.documentos?.length ? (
              <EmptyState icon={FileText} title="Sin documentos" />
            ) : (
              <div className="space-y-2">
                {p.documentos.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{d.titulo}</p>
                        <p className="text-xs text-slate-500">{d.tipo} · {d.archivoNombre} · {formatDate(d.fechaSubida)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Pago */}
      <RegistrarPagoModal
        open={pagoOpen}
        onClose={() => setPagoOpen(false)}
        prestamoId={id}
        saldoTotal={p.saldoTotal}
        saldoCapital={p.saldoCapital}
        saldoInteres={p.saldoInteres}
        montoMora={p.montoMora}
        cuotaActual={p.cuotasPagadas + 1}
        onSaved={() => {
          setPagoOpen(false)
          setRefreshKey((k) => k + 1)
          toast.success('Pago registrado correctamente')
        }}
      />

      {/* Modal Notificación */}
      <EnviarNotifModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        prestamoId={id}
        onSent={() => {
          setNotifOpen(false)
          setRefreshKey((k) => k + 1)
          toast.success('Notificación creada')
        }}
      />
    </div>
  )
}

function RegistrarPagoModal({
  open, onClose, prestamoId, saldoTotal, saldoCapital, saldoInteres, montoMora, cuotaActual, onSaved,
}: any) {
  const [form, setForm] = useState({
    montoTotal: '',
    metodoPago: 'TRANSFERENCIA',
    referencia: '',
    cuentaRecaudoId: '',
    numeroCuota: '',
    notas: '',
  })
  const [cuentas, setCuentas] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/cuentas').then(r => r.json()).then(d => setCuentas(d.cuentas || []))
      setForm({ ...form, numeroCuota: String(cuotaActual) })
    }
  }, [open, cuotaActual])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost('/api/pagos', {
        ...form,
        prestamoId,
        montoTotal: Number(form.montoTotal),
        cuentaRecaudoId: form.cuentaRecaudoId || null,
        numeroCuota: Number(form.numeroCuota) || cuotaActual,
      })
      onSaved()
      setForm({ montoTotal: '', metodoPago: 'TRANSFERENCIA', referencia: '', cuentaRecaudoId: '', numeroCuota: '', notas: '' })
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-lg">
            <div><p className="text-slate-500">Saldo capital</p><p className="font-semibold">{formatCOP(saldoCapital)}</p></div>
            <div><p className="text-slate-500">Saldo interés</p><p className="font-semibold">{formatCOP(saldoInteres)}</p></div>
            <div><p className="text-slate-500">Mora</p><p className="font-semibold text-red-600">{formatCOP(montoMora)}</p></div>
          </div>
          <div>
            <Label>Monto del pago *</Label>
            <Input type="number" value={form.montoTotal} onChange={(e) => setForm({ ...form, montoTotal: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Método</Label>
              <Select value={form.metodoPago} onValueChange={(v) => setForm({ ...form, metodoPago: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="CONSIGNACION">Consignación</SelectItem>
                  <SelectItem value="DATAFONO">Datáfono</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número cuota</Label>
              <Input type="number" value={form.numeroCuota} onChange={(e) => setForm({ ...form, numeroCuota: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Cuenta de recaudo</Label>
            <Select value={form.cuentaRecaudoId} onValueChange={(v) => setForm({ ...form, cuentaRecaudoId: v })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar..." /></SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numeroCuenta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Referencia</Label>
            <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Comprobante..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar Pago'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EnviarNotifModal({ open, onClose, prestamoId, onSent }: any) {
  const [tipo, setTipo] = useState('RECORDATORIO_PAGO')
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiPost('/api/notificaciones', { tipo, prestamoId })
      setResultado(res)
      toast.success('Notificación generada')
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setResultado(null)
    onClose()
    if (resultado) onSent()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Notificación WhatsApp</DialogTitle>
        </DialogHeader>
        {resultado ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-900 mb-2">Notificación generada ✓</p>
              <div className="bg-white rounded p-3 text-xs whitespace-pre-wrap border border-emerald-200 max-h-60 overflow-y-auto">
                {resultado.notif.mensaje}
              </div>
            </div>
            <a
              href={resultado.linkWaMe}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
            >
              <Send className="w-4 h-4 mr-2" /> Abrir en WhatsApp
            </a>
            <Button variant="outline" className="w-full" onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Tipo de notificación</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOLICITUD">Solicitud registrada</SelectItem>
                  <SelectItem value="APROBACION">Aprobación</SelectItem>
                  <SelectItem value="DESEMBOLSO">Desembolso</SelectItem>
                  <SelectItem value="RECORDATORIO_PAGO">Recordatorio de pago</SelectItem>
                  <SelectItem value="MORA">Aviso de mora</SelectItem>
                  <SelectItem value="PAGO_CONFIRMADO">Pago confirmado</SelectItem>
                  <SelectItem value="JURIDICO">Cobro jurídico</SelectItem>
                  <SelectItem value="ESTADO_CUENTA">Estado de cuenta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Generando...' : 'Generar'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
