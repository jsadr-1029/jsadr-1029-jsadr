'use client'

import { useState } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch } from '@/hooks/use-fetch'
import { formatCOP, formatDate, estadoPagoColor, getInitials, formatRelativeTime } from '@/lib/format'
import { CreditCard, Search, RotateCcw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/hooks/use-fetch'
import { toast } from 'sonner'

export function PagosView({ navigate }: { navigate: (v: any) => void }) {
  const [estado, setEstado] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reversar, setReversar] = useState<any>(null)

  const handleEstadoChange = (v: string) => { setEstado(v); setPage(1) }

  const query = new URLSearchParams({ estado, page: String(page), pageSize: '50' }).toString()
  const { data, loading } = useFetch<{ pagos: any[]; total: number; totalPages: number }>(
    `/api/pagos?${query}`,
    { refreshKey }
  )

  const totalConfirmado = data?.pagos?.filter(p => p.estado === 'CONFIRMADO').reduce((s, p) => s + p.montoTotal, 0) || 0
  const totalReversado = data?.pagos?.filter(p => p.estado === 'REVERSADO').reduce((s, p) => s + p.montoTotal, 0) || 0

  return (
    <div className="space-y-4">
      <PageHeader title="Pagos" subtitle={`${data?.total || 0} pagos registrados`} icon={CreditCard} />

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-slate-500">Confirmados</p><p className="text-lg font-bold text-emerald-700">{formatCOP(totalConfirmado)}</p></Card>
        <Card><p className="text-xs text-slate-500">Reversados</p><p className="text-lg font-bold text-red-700">{formatCOP(totalReversado)}</p></Card>
        <Card><p className="text-xs text-slate-500">Total registros</p><p className="text-lg font-bold text-slate-900">{data?.total || 0}</p></Card>
      </div>

      <Card>
        <Select value={estado} onValueChange={handleEstadoChange}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="CONFIRMADO">Confirmados</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
            <SelectItem value="REVERSADO">Reversados</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.pagos.length ? (
          <EmptyState icon={CreditCard} title="Sin pagos" />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Solicitud</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden md:table-cell">Cliente</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600 hidden sm:table-cell">Cuota</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden lg:table-cell">Método</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Total</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600">Estado</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pagos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-slate-900">{formatDate(p.fechaPago)}</p>
                      <p className="text-xs text-slate-400">{formatRelativeTime(p.fechaPago)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate({ name: 'prestamo-detalle', id: p.prestamoId })}
                        className="font-mono text-xs text-emerald-600 hover:underline"
                      >
                        {p.prestamo?.codigo}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                          {getInitials(p.prestamo?.cliente?.nombre || '?')}
                        </div>
                        <span className="text-xs text-slate-700 truncate">{p.prestamo?.cliente?.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">{p.numeroCuota}</td>
                    <td className="px-4 py-3 hidden lg:table-cell"><Badge variant="neutral">{p.metodoPago}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCOP(p.montoTotal)}</td>
                    <td className="px-4 py-3 text-center"><Badge className={estadoPagoColor(p.estado)}>{p.estado}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {p.estado === 'CONFIRMADO' && (
                        <Button variant="ghost" size="sm" onClick={() => setReversar(p)}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">Página {page} de {data.totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </Card>

      {reversar && <ReversarPagoModal pago={reversar} onClose={() => setReversar(null)} onSaved={() => { setReversar(null); setRefreshKey(k => k + 1); toast.success('Pago reversado') }} />}
    </div>
  )
}

function ReversarPagoModal({ pago, onClose, onSaved }: { pago: any; onClose: () => void; onSaved: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost(`/api/pagos/${pago.id}/reversar`, { motivo })
      onSaved()
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reversar Pago</DialogTitle>
        </DialogHeader>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-amber-800">
            Vas a reversar el pago de <strong>{formatCOP(pago.montoTotal)}</strong> del solicitud <strong>{pago.prestamo?.codigo}</strong>.
            Esta acción reabrirá el saldo del solicitud.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Motivo de la reversión *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ej: Pago duplicado, error en monto..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={saving}>{saving ? 'Revirtiendo...' : 'Reversar Pago'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
