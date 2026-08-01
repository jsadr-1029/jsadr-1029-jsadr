'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { formatCOP, formatDate, formatRelativeTime } from '@/lib/format'
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function CajasView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedCaja, setSelectedCaja] = useState<string | null>(null)
  const [movOpen, setMovOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, loading } = useFetch<{ cajas: any[] }>(`/api/cajas`, { refreshKey })

  const totalSaldo = data?.cajas?.reduce((s, c) => s + c.saldoActual, 0) || 0
  const totalIngresos = data?.cajas?.reduce((s, c) => s + c.totalIngresos, 0) || 0
  const totalEgresos = data?.cajas?.reduce((s, c) => s + c.totalEgresos, 0) || 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cajas y Movimientos"
        subtitle="Gestión de tesorería"
        icon={Wallet}
        actions={selectedCaja && <Button onClick={() => setMovOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo Movimiento</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs text-slate-500">Saldo total</p><p className="text-lg font-bold text-purple-700">{formatCOP(totalSaldo)}</p></Card>
        <Card><p className="text-xs text-slate-500">Total ingresos</p><p className="text-lg font-bold text-emerald-700">{formatCOP(totalIngresos)}</p></Card>
        <Card><p className="text-xs text-slate-500">Total egresos</p><p className="text-lg font-bold text-red-700">{formatCOP(totalEgresos)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista cajas */}
        <Card title="Cajas" className="lg:col-span-1">
          {loading ? (
            <LoadingState />
          ) : !data?.cajas?.length ? (
            <EmptyState icon={Wallet} title="Sin cajas" />
          ) : (
            <div className="space-y-2">
              {data.cajas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCaja(c.id); setPage(1) }}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedCaja === c.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900 text-sm">{c.nombre}</span>
                    {c.activa ? <Badge variant="success">Activa</Badge> : <Badge variant="neutral">Inactiva</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{c.descripcion || c.codigo}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 text-xs">Saldo:</span>
                    <span className="font-bold text-slate-900">{formatCOP(c.saldoActual)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="flex items-center gap-1 text-emerald-700">
                      <TrendingUp className="w-3 h-3" /> {formatCOP(c.totalIngresos)}
                    </div>
                    <div className="flex items-center gap-1 text-red-700">
                      <TrendingDown className="w-3 h-3" /> {formatCOP(c.totalEgresos)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Movimientos de la caja seleccionada */}
        <Card title="Movimientos" className="lg:col-span-2" subtitle={selectedCaja ? 'Caja seleccionada' : 'Selecciona una caja'}>
          {!selectedCaja ? (
            <EmptyState icon={Wallet} title="Selecciona una caja" description="Elige una caja de la lista para ver sus movimientos." />
          ) : (
            <MovimientosList cajaId={selectedCaja} page={page} setPage={setPage} />
          )}
        </Card>
      </div>

      {selectedCaja && (
        <MovimientoModal
          open={movOpen}
          onClose={() => setMovOpen(false)}
          cajaId={selectedCaja}
          onSaved={() => {
            setMovOpen(false)
            setRefreshKey(k => k + 1)
            toast.success('Movimiento registrado')
          }}
        />
      )}
    </div>
  )
}

function MovimientosList({ cajaId, page, setPage }: { cajaId: string; page: number; setPage: (n: number) => void }) {
  const { data, loading } = useFetch<any>(`/api/cajas/${cajaId}/movimientos?page=${page}&pageSize=30`)
  if (loading) return <LoadingState />
  if (!data?.movimientos?.length) return <EmptyState icon={Wallet} title="Sin movimientos" />

  return (
    <>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {data.movimientos.map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {m.tipo === 'INGRESO' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{m.concepto}</p>
              <p className="text-xs text-slate-500">
                {formatDate(m.fechaMovimiento, { withTime: true })}
                {m.referencia && ` · ${m.referencia}`}
                {m.prestamo?.cliente && ` · ${m.prestamo.cliente.nombre}`}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-bold ${m.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-700'}`}>
                {m.tipo === 'INGRESO' ? '+' : '-'}{formatCOP(m.monto)}
              </p>
            </div>
          </div>
        ))}
      </div>
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">Página {page} de {data.totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </>
  )
}

function MovimientoModal({ open, onClose, cajaId, onSaved }: any) {
  const [form, setForm] = useState({ tipo: 'INGRESO', monto: '', concepto: '', referencia: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiPost(`/api/cajas/${cajaId}/movimientos`, { ...form, monto: Number(form.monto) })
      onSaved()
      setForm({ tipo: 'INGRESO', monto: '', concepto: '', referencia: '' })
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo Movimiento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INGRESO">Ingreso</SelectItem>
                <SelectItem value="EGRESO">Egreso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto *</Label>
            <Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
          </div>
          <div>
            <Label>Concepto *</Label>
            <Textarea value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} required rows={2} />
          </div>
          <div>
            <Label>Referencia</Label>
            <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
