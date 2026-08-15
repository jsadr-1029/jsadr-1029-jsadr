'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { apiContador, useContadorAuth } from '../componentes/contador-auth-provider'
import { PageHeader, EmptyState, formatCOP, formatDate } from '../componentes/ui-contador'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Declaracion {
  id: string
  tipo: string
  periodoFiscal: string
  anio: number
  estado: string
  valorAPagar: number
  valorPagado: number
  fechaVencimiento?: string | null
  fechaPresentacion?: string | null
  presentadaPor?: string | null
  observaciones?: string | null
}

const TIPOS = ['RENTA', 'IVA', 'RETENCION', 'ICA', 'EXOGENA']
const ESTADOS = ['BORRADOR', 'EN_REVISION', 'APROBADA', 'PRESENTADA', 'ARCHIVADA']

const emptyForm = {
  tipo: 'IVA',
  periodoFiscal: '',
  anio: new Date().getFullYear(),
  estado: 'BORRADOR',
  valorAPagar: 0,
  valorPagado: 0,
  fechaVencimiento: '',
  observaciones: '',
}

function estadoColor(e: string) {
  switch (e) {
    case 'PRESENTADA': return 'bg-emerald-100 text-emerald-700'
    case 'APROBADA': return 'bg-sky-100 text-sky-700'
    case 'EN_REVISION': return 'bg-amber-100 text-amber-700'
    case 'ARCHIVADA': return 'bg-slate-200 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export default function DeclaracionesPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const [declaraciones, setDeclaraciones] = useState<Declaracion[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Declaracion | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const r = await apiContador(`/api/portal-contador/declaraciones?empresaId=${empresaId}`)
    setLoading(false)
    if (r.ok) setDeclaraciones(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar declaraciones.')
  }, [empresaId])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
  }, [authLoading, user, cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...emptyForm, periodoFiscal: String(new Date().getFullYear()) })
    setDialogOpen(true)
  }
  const abrirEditar = (d: Declaracion) => {
    setEditando(d)
    setForm({
      tipo: d.tipo,
      periodoFiscal: d.periodoFiscal,
      anio: d.anio,
      estado: d.estado,
      valorAPagar: d.valorAPagar,
      valorPagado: d.valorPagado,
      fechaVencimiento: d.fechaVencimiento ? d.fechaVencimiento.slice(0, 10) : '',
      observaciones: d.observaciones || '',
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!empresaId) return
    if (!form.tipo || !form.periodoFiscal || !form.anio) {
      toast.error('Tipo, período fiscal y año son obligatorios.')
      return
    }
    setSaving(true)
    const body: any = {
      ...form,
      empresaId,
      anio: Number(form.anio),
      valorAPagar: Number(form.valorAPagar) || 0,
      valorPagado: Number(form.valorPagado) || 0,
      fechaVencimiento: form.fechaVencimiento || null,
    }
    const r = editando
      ? await apiContador(`/api/portal-contador/declaraciones/${editando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiContador('/api/portal-contador/declaraciones', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo guardar la declaración.')
      return
    }
    toast.success(editando ? 'Declaración actualizada.' : 'Declaración creada.')
    setDialogOpen(false)
    cargar()
  }

  const eliminar = async (d: Declaracion) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/declaraciones/${d.id}?empresaId=${empresaId}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo eliminar.')
      return
    }
    toast.success('Declaración eliminada.')
    cargar()
  }

  if (authLoading) return null

  if (!empresaId) {
    return (
      <div className="p-6">
        <PageHeader titulo="Declaraciones" />
        <EmptyState titulo="Seleccione una empresa" descripcion="Elija una empresa para gestionar sus declaraciones tributarias." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Declaraciones tributarias"
        descripcion="Seguimiento de declaraciones de Renta, IVA, Retenciones, ICA y Exógena."
        acciones={
          <Button onClick={abrirNuevo} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva declaración
          </Button>
        }
      />

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && declaraciones.length === 0 && (
        <EmptyState titulo="No hay declaraciones" descripcion="Registre la primera declaración tributaria." />
      )}

      {!loading && declaraciones.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período fiscal</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Valor a pagar</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {declaraciones.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><Badge variant="secondary">{d.tipo}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{d.periodoFiscal}</TableCell>
                      <TableCell className="text-xs">{formatDate(d.fechaVencimiento)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCOP(d.valorAPagar)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCOP(d.valorPagado)}</TableCell>
                      <TableCell><Badge className={estadoColor(d.estado)}>{d.estado}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {d.estado !== 'PRESENTADA' && (
                            <Button variant="ghost" size="sm" onClick={() => eliminar(d)}>
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          )}
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
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              {editando ? 'Editar declaración' : 'Nueva declaración'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período fiscal *</Label>
              <Input
                value={form.periodoFiscal}
                onChange={(e) => setForm({ ...form, periodoFiscal: e.target.value })}
                placeholder="2026 o 2026-01 o 2026-Q1"
              />
            </div>
            <div className="space-y-2">
              <Label>Año *</Label>
              <Input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor a pagar</Label>
              <Input type="number" value={form.valorAPagar} onChange={(e) => setForm({ ...form, valorAPagar: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Valor pagado</Label>
              <Input type="number" value={form.valorPagado} onChange={(e) => setForm({ ...form, valorPagado: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de vencimiento</Label>
              <Input type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Observaciones</Label>
              <Textarea rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
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
