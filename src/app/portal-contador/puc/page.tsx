'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, BookOpen } from 'lucide-react'
import { apiContador, useContadorAuth } from '../componentes/contador-auth-provider'
import { PageHeader, EmptyState, formatCOP } from '../componentes/ui-contador'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Cuenta {
  id: string
  codigo: string
  nombre: string
  naturaleza: string
  tipo: string
  cuentaPadreId?: string | null
  terceroRequerido: boolean
  centroCostoRequerido: boolean
  estadoFinanciero?: string | null
  estado: string
  saldo: number
}

const TIPOS = ['CLASE', 'GRUPO', 'CUENTA', 'SUBCUENTA', 'AUXILIAR']
const NATURALEZA = ['DEBITO', 'CREDITO']
const ESTADOS_FIN = ['BALANCE', 'RESULTADOS', 'ORDEN']

const emptyForm = {
  codigo: '',
  nombre: '',
  naturaleza: 'DEBITO',
  tipo: 'CUENTA',
  cuentaPadreId: '',
  terceroRequerido: false,
  centroCostoRequerido: false,
  estadoFinanciero: '',
  estado: 'ACTIVA',
  saldo: 0,
}

const tipoIndent: Record<string, number> = {
  CLASE: 0,
  GRUPO: 1,
  CUENTA: 2,
  SUBCUENTA: 3,
  AUXILIAR: 4,
}

export default function PucPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Cuenta | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const r = await apiContador(`/api/portal-contador/puc?empresaId=${empresaId}&q=${encodeURIComponent(q)}`)
    setLoading(false)
    if (r.ok) setCuentas(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar el catálogo.')
  }, [empresaId, q])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
  }, [authLoading, user, cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }
  const abrirEditar = (c: Cuenta) => {
    setEditando(c)
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      naturaleza: c.naturaleza,
      tipo: c.tipo,
      cuentaPadreId: c.cuentaPadreId || '',
      terceroRequerido: c.terceroRequerido,
      centroCostoRequerido: c.centroCostoRequerido,
      estadoFinanciero: c.estadoFinanciero || '',
      estado: c.estado,
      saldo: c.saldo,
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!empresaId) return
    if (!form.codigo || !form.nombre || !form.naturaleza || !form.tipo) {
      toast.error('Código, nombre, naturaleza y tipo son obligatorios.')
      return
    }
    setSaving(true)
    const body: any = {
      ...form,
      empresaId,
      cuentaPadreId: form.cuentaPadreId || null,
      estadoFinanciero: form.estadoFinanciero || null,
      saldo: Number(form.saldo) || 0,
    }
    const r = editando
      ? await apiContador(`/api/portal-contador/puc/${editando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiContador('/api/portal-contador/puc', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo guardar la cuenta.')
      return
    }
    toast.success(editando ? 'Cuenta actualizada.' : 'Cuenta creada.')
    setDialogOpen(false)
    cargar()
  }

  const eliminar = async (c: Cuenta) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/puc/${c.id}?empresaId=${empresaId}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo eliminar la cuenta.')
      return
    }
    toast.success(r.data?.message || 'Cuenta eliminada.')
    cargar()
  }

  if (authLoading) return null

  if (!empresaId) {
    return (
      <div className="p-6">
        <PageHeader titulo="PUC / Catálogo Contable" />
        <EmptyState titulo="Seleccione una empresa" descripcion="Elija una empresa para gestionar su catálogo de cuentas." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="PUC / Catálogo Contable"
        descripcion="Plan Único de Cuentas jerárquico: clase, grupo, cuenta, subcuenta y auxiliar."
        acciones={
          <Button onClick={abrirNuevo} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por código o nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && cuentas.length === 0 && (
        <EmptyState
          titulo="No hay cuentas registradas"
          descripcion="Cree las cuentas del PUC para esta empresa. Comience por las clases (1-7)."
          accion={
            <Button onClick={abrirNuevo} className="gap-2">
              <Plus className="h-4 w-4" /> Crear cuenta
            </Button>
          }
        />
      )}

      {!loading && cuentas.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[75vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead className="w-28">Naturaleza</TableHead>
                    <TableHead className="w-32 text-right">Saldo</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((c) => {
                    const indent = tipoIndent[c.tipo] ?? 2
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-800">
                          <span style={{ paddingLeft: `${indent * 12}px` }}>{c.codigo}</span>
                        </TableCell>
                        <TableCell>
                          <span style={{ paddingLeft: `${indent * 12}px` }} className="text-slate-700">
                            {c.nombre}
                          </span>
                          {c.terceroRequerido && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Tercero</Badge>
                          )}
                          {c.estadoFinanciero && (
                            <Badge variant="outline" className="ml-1 text-[10px]">{c.estadoFinanciero}</Badge>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{c.tipo}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={c.naturaleza === 'DEBITO' ? 'default' : 'outline'}>
                            {c.naturaleza === 'DEBITO' ? 'Db' : 'Cr'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCOP(c.saldo)}</TableCell>
                        <TableCell>
                          <Badge className={c.estado === 'ACTIVA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                            {c.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => abrirEditar(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => eliminar(c)}>
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-sky-600" />
              {editando ? 'Editar cuenta' : 'Nueva cuenta'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="1105"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Naturaleza *</Label>
              <Select value={form.naturaleza} onValueChange={(v) => setForm({ ...form, naturaleza: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NATURALEZA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta padre</Label>
              <Select
                value={form.cuentaPadreId || 'NONE'}
                onValueChange={(v) => setForm({ ...form, cuentaPadreId: v === 'NONE' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="(ninguna)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">(ninguna)</SelectItem>
                  {cuentas
                    .filter((c) => c.id !== editando?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} · {c.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado financiero</Label>
              <Select
                value={form.estadoFinanciero || 'NONE'}
                onValueChange={(v) => setForm({ ...form, estadoFinanciero: v === 'NONE' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="(sin asignar)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">(sin asignar)</SelectItem>
                  {ESTADOS_FIN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVA">ACTIVA</SelectItem>
                  <SelectItem value="INACTIVA">INACTIVA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
              <Switch
                id="tercero"
                checked={form.terceroRequerido}
                onCheckedChange={(v) => setForm({ ...form, terceroRequerido: v })}
              />
              <Label htmlFor="tercero" className="cursor-pointer text-sm">Requiere tercero</Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
              <Switch
                id="cc"
                checked={form.centroCostoRequerido}
                onCheckedChange={(v) => setForm({ ...form, centroCostoRequerido: v })}
              />
              <Label htmlFor="cc" className="cursor-pointer text-sm">Requiere centro de costo</Label>
            </div>
            <div className="space-y-2">
              <Label>Saldo inicial</Label>
              <Input
                type="number"
                value={form.saldo}
                onChange={(e) => setForm({ ...form, saldo: Number(e.target.value) })}
              />
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
