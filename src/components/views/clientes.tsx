'use client'

import { useState, useMemo } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { formatCOP, formatDate, getInitials, maskPhone } from '@/lib/format'
import { Users, Plus, Search, Eye, Phone, Mail, MapPin, Building, X, Landmark, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

type View = { name: string; id?: string }

type Cliente = {
  id: string
  nombre: string
  cedula: string
  telefono: string
  email: string | null
  departamento: string | null
  municipio: string | null
  salario: number | null
  activo: boolean
  bancoCliente: string | null
  categoriaId: string | null
  categoria: { id: string; nombre: string; codigo: string } | null
  saldoPendiente: number
  prestamosActivos: number
  _count: { prestamos: number }
  createdAt: string
}

export function ClientesView({ navigate }: { navigate: (v: any) => void }) {
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

  const { data, loading } = useFetch<{ clientes: Cliente[]; total: number; totalPages: number }>(
    `/api/clientes?${query}`,
    { refreshKey }
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle={`${data?.total || 0} clientes registrados`}
        icon={Users}
        actions={
          <Button onClick={() => setNuevoOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Cliente
          </Button>
        }
      />

      {/* Filtros */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, cédula, teléfono o email..."
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
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="inactivos">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de clientes */}
      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.clientes.length ? (
          <EmptyState
            icon={Users}
            title="No se encontraron clientes"
            description="Prueba cambiar los filtros o crea un nuevo cliente."
          />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden md:table-cell">Contacto</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 hidden lg:table-cell">Categoría</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Saldo</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-600">Estado</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate({ name: 'cliente-detalle', id: c.id })}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {getInitials(c.nombre)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{c.nombre}</p>
                          <p className="text-xs text-slate-500">CC {c.cedula}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs space-y-0.5">
                        <p className="text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</p>
                        <p className="text-slate-500 flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="w-3 h-3" />{c.email || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.categoria ? (
                        <Badge variant="info">{c.categoria.nombre}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.saldoPendiente > 0 ? (
                        <div>
                          <p className="font-semibold text-slate-900">{formatCOP(c.saldoPendiente)}</p>
                          <p className="text-xs text-slate-500">{c.prestamosActivos} préstamo(s)</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin saldo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.activo ? 'success' : 'neutral'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({ name: 'cliente-detalle', id: c.id })
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
            <p className="text-xs text-slate-500">
              Página {page} de {data.totalPages} · {data.total} clientes
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal nuevo cliente */}
      <NuevoClienteModal
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreated={() => {
          setNuevoOpen(false)
          setRefreshKey((k) => k + 1)
          toast.success('Cliente creado exitosamente')
        }}
      />
    </div>
  )
}

type Categoria = {
  id: string
  codigo: string
  nombre: string
  montoMinimo: number
  montoMaximo: number
  tasaInteresAnual: number
  tasaMoraAnual: number
  descripcion: string | null
  cuentaRecaudoId: string | null
  cuentaRecaudo: {
    id: string
    codigo: string
    banco: string
    tipoCuenta: string
    numeroCuenta: string
    titular: string
  } | null
}

function NuevoClienteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    departamento: '',
    municipio: '',
    salario: '',
    direccion: '',
    bancoCliente: '',
    tipoCuentaCliente: 'AHORROS',
    numeroCuentaCliente: '',
    categoriaId: '',
  })
  const [saving, setSaving] = useState(false)

  // Cargar categorías disponibles (con su cuenta de recaudo asignada)
  const { data: categoriasData } = useFetch<{ success: boolean; data: Categoria[] }>('/api/categorias')
  const categorias = useMemo(() => categoriasData?.data ?? [], [categoriasData])

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === form.categoriaId) || null,
    [categorias, form.categoriaId]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.categoriaId) {
      toast.error('Debe seleccionar una categoría para el cliente')
      return
    }
    setSaving(true)
    try {
      await apiPost('/api/clientes', {
        ...form,
        salario: form.salario ? Number(form.salario) : null,
        categoriaId: form.categoriaId,
        cuentaRecaudoId: categoriaSeleccionada?.cuentaRecaudoId || null,
        activo: true,
      })
      onCreated()
      setForm({
        nombre: '', cedula: '', telefono: '', email: '', departamento: '',
        municipio: '', salario: '', direccion: '', bancoCliente: '',
        tipoCuentaCliente: 'AHORROS', numeroCuentaCliente: '', categoriaId: '',
      })
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {/* === CATEGORÍA DEL CLIENTE (obligatoria) === */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-indigo-600" />
              Categoría del cliente *
            </Label>
            <p className="text-xs text-slate-500">
              La categoría define el monto máximo que puede solicitar, la tasa de interés
              aplicable y la cuenta bancaria donde debe realizar los pagos.
            </p>
            <Select value={form.categoriaId} onValueChange={(v) => setForm({ ...form, categoriaId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => {
                  const maxStr = c.montoMaximo > 0 ? formatCOP(c.montoMaximo) : 'Sin límite'
                  return (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.nombre} ({c.codigo})</span>
                      <span className="text-xs text-slate-500">
                        {formatCOP(c.montoMinimo)} – {maxStr} · {c.tasaInteresAnual}% anual
                      </span>
                    </div>
                  </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* === Resumen de la categoría seleccionada === */}
          {categoriaSeleccionada && (
            <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="info">{categoriaSeleccionada.codigo}</Badge>
                <span className="font-semibold text-slate-900">{categoriaSeleccionada.nombre}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Monto mínimo</p>
                  <p className="font-semibold text-slate-900">{formatCOP(categoriaSeleccionada.montoMinimo)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Monto máximo</p>
                  <p className="font-semibold text-slate-900">{categoriaSeleccionada.montoMaximo > 0 ? formatCOP(categoriaSeleccionada.montoMaximo) : 'Sin límite'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Tasa anual</p>
                  <p className="font-semibold text-slate-900">{categoriaSeleccionada.tasaInteresAnual}%</p>
                </div>
              </div>
              {categoriaSeleccionada.cuentaRecaudo ? (
                <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                  <Landmark className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-amber-900">Cuenta de recaudo asignada</p>
                    <p className="text-amber-800">
                      {categoriaSeleccionada.cuentaRecaudo.banco} · {categoriaSeleccionada.cuentaRecaudo.tipoCuenta} ·{' '}
                      <span className="font-mono font-semibold">{categoriaSeleccionada.cuentaRecaudo.numeroCuenta}</span>
                    </p>
                    <p className="text-amber-700">Titular: {categoriaSeleccionada.cuentaRecaudo.titular}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-800">
                    Esta categoría <strong>no tiene cuenta de recaudo asignada</strong>. Configure la categoría antes de crear clientes en ella.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-3">
            <div>
              <Label>Nombre completo *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <Label>Cédula *</Label>
              <Input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} required />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="3001234567" required />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
            </div>
            <div>
              <Label>Municipio</Label>
              <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </div>
            <div>
              <Label>Salario</Label>
              <Input type="number" value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={form.bancoCliente} onChange={(e) => setForm({ ...form, bancoCliente: e.target.value })} placeholder="Bancolombia" />
            </div>
            <div>
              <Label>Tipo cuenta</Label>
              <Select value={form.tipoCuentaCliente} onValueChange={(v) => setForm({ ...form, tipoCuentaCliente: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AHORROS">Ahorros</SelectItem>
                  <SelectItem value="CORRIENTE">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Número de cuenta</Label>
              <Input value={form.numeroCuentaCliente} onChange={(e) => setForm({ ...form, numeroCuentaCliente: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.categoriaId}>
              {saving ? 'Guardando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
