'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { formatCOP, formatDate, estadoPrestamoColor, getInitials } from '@/lib/format'
import { calcularPrestamo } from '@/lib/finance'
import { FileText, Plus, Search, Eye, ArrowLeft, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

type View = { name: string; id?: string }

export function PrestamosView({ navigate }: { navigate: (v: any) => void }) {
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [page, setPage] = useState(1)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleEstadoChange = (v: string) => { setEstado(v); setPage(1) }

  const query = new URLSearchParams({
    q: search,
    estado,
    page: String(page),
    pageSize: '50',
  }).toString()

  const { data, loading } = useFetch<{ prestamos: any[]; total: number; totalPages: number }>(
    `/api/prestamos?${query}`,
    { refreshKey }
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Solicitudes"
        subtitle={`${data?.total || 0} solicitudes registrados`}
        icon={FileText}
        actions={
          <Button onClick={() => setNuevoOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Solicitud
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por código..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={estado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="SOLICITADO">Solicitado</SelectItem>
              <SelectItem value="APROBADO">Aprobado</SelectItem>
              <SelectItem value="ACTIVO">Activo</SelectItem>
              <SelectItem value="PAGADO">Pagado</SelectItem>
              <SelectItem value="REVERSADO">Reversado</SelectItem>
              <SelectItem value="CASTIGADO">Castigado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.prestamos.length ? (
          <EmptyState icon={FileText} title="Sin solicitudes" />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Solicitud</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden md:table-cell">Cliente</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Monto</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600 hidden sm:table-cell">Saldo</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600">Cuotas</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600">Estado</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.prestamos.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate({ name: 'prestamo-detalle', id: p.id })}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-900">{p.codigo}</p>
                      <p className="text-xs text-slate-500">{p.frecuencia} · {p.plazoMeses}m</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                          {getInitials(p.cliente?.nombre || '?')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.cliente?.nombre}</p>
                          <p className="text-xs text-slate-500">CC {p.cliente?.cedula}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-slate-900">{formatCOP(p.montoPrincipal)}</p>
                      <p className="text-xs text-slate-500">Cuota: {formatCOP(p.montoCuota)}</p>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <p className="font-semibold text-slate-900">{formatCOP(p.saldoTotal)}</p>
                      <p className="text-xs text-slate-500">Pagado: {formatCOP(p.montoPagado)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm font-medium text-slate-900">
                        {p.cuotasPagadas}/{p.numeroCuotas}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={estadoPrestamoColor(p.estado)}>{p.estado}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({ name: 'prestamo-detalle', id: p.id })
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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

      <NuevoPrestamoModal
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreated={(p) => {
          setNuevoOpen(false)
          setRefreshKey((k) => k + 1)
          toast.success('Solicitud creado')
          navigate({ name: 'prestamo-detalle', id: p.prestamo.id })
        }}
      />
    </div>
  )
}

function NuevoPrestamoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: any) => void }) {
  const [clientes, setClientes] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [form, setForm] = useState({
    clienteId: '',
    categoriaId: '',
    montoPrincipal: '',
    tasaInteresAnual: '',
    plazoMeses: '',
    frecuencia: 'MENSUAL',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/clientes?pageSize=200').then(r => r.json()).then(d => setClientes(d.clientes || []))
      fetch('/api/categorias').then(r => r.json()).then(d => setCategorias(d.categorias || []))
    }
  }, [open])

  // Cálculo en tiempo real
  const monto = Number(form.montoPrincipal) || 0
  const plazo = Number(form.plazoMeses) || 0
  const tasaAnual = Number(form.tasaInteresAnual) || 0
  const tasaMensual = tasaAnual / 12
  const calc = monto && plazo && tasaMensual
    ? calcularPrestamo({ monto, tasaMensual, plazoMeses: plazo, frecuencia: form.frecuencia as any })
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!calc) return toast.error('Completa los datos')
    setSaving(true)
    try {
      const res = await apiPost('/api/prestamos', {
        clienteId: form.clienteId,
        categoriaId: form.categoriaId || null,
        montoPrincipal: monto,
        tasaInteresAnual: tasaAnual,
        tasaInteresMensual: tasaMensual,
        tasaMoraDiaria: 1,
        plazoMeses: plazo,
        frecuencia: form.frecuencia,
        numeroCuotas: calc.numeroCuotas,
        montoCuota: calc.montoCuota,
        totalInteres: calc.totalInteres,
        totalPagar: calc.totalPagar,
        tasaAplicada: calc.tasaAplicada,
      })
      onCreated(res)
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onCategoriaChange = (catId: string) => {
    const cat = categorias.find(c => c.id === catId)
    setForm({
      ...form,
      categoriaId: catId,
      tasaInteresAnual: cat ? String(cat.tasaInteresAnual) : form.tasaInteresAnual,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo Solicitud</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
          <div>
            <Label>Cliente *</Label>
            <Select value={form.clienteId} onValueChange={(v) => setForm({ ...form, clienteId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona cliente..." /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} - CC {c.cedula}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoría (opcional - autocompleta tasa)</Label>
            <Select value={form.categoriaId} onValueChange={onCategoriaChange}>
              <SelectTrigger><SelectValue placeholder="Sin categoría..." /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} - {formatCOP(c.montoMinimo)} a {formatCOP(c.montoMaximo)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto principal *</Label>
              <Input type="number" value={form.montoPrincipal} onChange={(e) => setForm({ ...form, montoPrincipal: e.target.value })} required />
            </div>
            <div>
              <Label>Tasa anual (%) *</Label>
              <Input type="number" value={form.tasaInteresAnual} onChange={(e) => setForm({ ...form, tasaInteresAnual: e.target.value })} required />
            </div>
            <div>
              <Label>Plazo (meses) *</Label>
              <Input type="number" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} required />
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Select value={form.frecuencia} onValueChange={(v) => setForm({ ...form, frecuencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSUAL">Mensual</SelectItem>
                  <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {calc && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-900">Simulación</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-emerald-700">Cuotas</p>
                  <p className="font-bold text-emerald-900">{calc.numeroCuotas}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Valor cuota</p>
                  <p className="font-bold text-emerald-900">{formatCOP(calc.montoCuota)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Interés total</p>
                  <p className="font-bold text-emerald-900">{formatCOP(calc.totalInteres)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-700">Total a pagar</p>
                  <p className="font-bold text-emerald-900">{formatCOP(calc.totalPagar)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !calc}>{saving ? 'Guardando...' : 'Crear Solicitud'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
