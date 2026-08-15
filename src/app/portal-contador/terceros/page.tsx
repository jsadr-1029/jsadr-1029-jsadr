'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { apiContador, useContadorAuth } from '../componentes/contador-auth-provider'
import { PageHeader, EmptyState } from '../componentes/ui-contador'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Tercero {
  id: string
  tipoDocumento: string
  numeroDocumento: string
  tipoTercero: string
  nombres?: string | null
  apellidos?: string | null
  razonSocial?: string | null
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  municipio?: string | null
  departamento?: string | null
  activo: boolean
  createdAt: string
}

const TIPO_DOC = ['CC', 'NIT', 'CE', 'PA']
const TIPO_TERCERO = ['CLIENTE', 'PROVEEDOR', 'EMPLEADO', 'SOCIO', 'ACCIONISTA', 'BANCO', 'ENTIDAD_PUBLICA']

const emptyForm = {
  tipoDocumento: 'NIT',
  numeroDocumento: '',
  tipoTercero: 'PROVEEDOR',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  direccion: '',
  telefono: '',
  email: '',
  municipio: '',
  departamento: '',
}

export default function TercerosPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const [terceros, setTerceros] = useState<Tercero[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Tercero | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const params = new URLSearchParams({ empresaId, q })
    if (filtroTipo !== 'ALL') params.set('tipoTercero', filtroTipo)
    const r = await apiContador(`/api/portal-contador/terceros?${params.toString()}`)
    setLoading(false)
    if (r.ok) setTerceros(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar terceros.')
  }, [empresaId, q, filtroTipo])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
  }, [authLoading, user, cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }
  const abrirEditar = (t: Tercero) => {
    setEditando(t)
    setForm({
      tipoDocumento: t.tipoDocumento,
      numeroDocumento: t.numeroDocumento,
      tipoTercero: t.tipoTercero,
      nombres: t.nombres || '',
      apellidos: t.apellidos || '',
      razonSocial: t.razonSocial || '',
      direccion: t.direccion || '',
      telefono: t.telefono || '',
      email: t.email || '',
      municipio: t.municipio || '',
      departamento: t.departamento || '',
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!empresaId) return
    if (!form.tipoDocumento || !form.numeroDocumento || !form.tipoTercero) {
      toast.error('Tipo de documento, número y tipo de tercero son obligatorios.')
      return
    }
    setSaving(true)
    const body = { ...form, empresaId }
    const r = editando
      ? await apiContador(`/api/portal-contador/terceros/${editando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiContador('/api/portal-contador/terceros', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo guardar el tercero.')
      return
    }
    toast.success(editando ? 'Tercero actualizado.' : 'Tercero creado.')
    setDialogOpen(false)
    cargar()
  }

  const eliminar = async (t: Tercero) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/terceros/${t.id}?empresaId=${empresaId}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo desactivar el tercero.')
      return
    }
    toast.success('Tercero desactivado.')
    cargar()
  }

  if (authLoading) return null

  if (!empresaId) {
    return (
      <div className="p-6">
        <PageHeader titulo="Terceros" />
        <EmptyState
          titulo="Seleccione una empresa"
          descripcion="Elija una empresa en el selector superior para gestionar sus terceros."
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Terceros"
        descripcion="Clientes, proveedores, empleados, socios y demás terceros de la empresa."
        acciones={
          <Button onClick={abrirNuevo} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo tercero
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, razón social o documento…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-56">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {TIPO_TERCERO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && terceros.length === 0 && (
        <EmptyState
          titulo="No hay terceros"
          descripcion="Registre el primer tercero para esta empresa."
          accion={
            <Button onClick={abrirNuevo} className="gap-2">
              <Plus className="h-4 w-4" /> Crear tercero
            </Button>
          }
        />
      )}

      {!loading && terceros.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Nombre / Razón social</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terceros.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">
                        <div>{t.tipoDocumento}</div>
                        <div className="font-semibold text-slate-800">{t.numeroDocumento}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {t.razonSocial || [t.nombres, t.apellidos].filter(Boolean).join(' ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{t.tipoTercero}</Badge></TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {t.telefono && <div>Tel: {t.telefono}</div>}
                        {t.email && <div className="truncate">{t.email}</div>}
                        {!t.telefono && !t.email && '—'}
                      </TableCell>
                      <TableCell>
                        {t.activo ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => eliminar(t)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar tercero' : 'Nuevo tercero'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={form.tipoDocumento} onValueChange={(v) => setForm({ ...form, tipoDocumento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_DOC.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de documento *</Label>
              <Input
                value={form.numeroDocumento}
                onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de tercero *</Label>
              <Select value={form.tipoTercero} onValueChange={(v) => setForm({ ...form, tipoTercero: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_TERCERO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Razón social</Label>
              <Input
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombres</Label>
              <Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Municipio</Label>
              <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
