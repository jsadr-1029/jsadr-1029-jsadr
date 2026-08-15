'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Lock, Unlock, Trash2, CalendarDays } from 'lucide-react'
import { apiContador, useContadorAuth } from '../componentes/contador-auth-provider'
import { PageHeader, EmptyState, formatDate } from '../componentes/ui-contador'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Periodo {
  id: string
  anio: number
  mes: number
  estado: string
  fechaCierre?: string | null
  cerradoPor?: string | null
  _count?: { comprobantes: number }
}

const ESTADOS = ['ABIERTO', 'EN_CIERRE', 'CERRADO', 'REABIERTO']
const MESES = [
  { v: 0, label: 'Anual' },
  { v: 1, label: 'Enero' }, { v: 2, label: 'Febrero' }, { v: 3, label: 'Marzo' },
  { v: 4, label: 'Abril' }, { v: 5, label: 'Mayo' }, { v: 6, label: 'Junio' },
  { v: 7, label: 'Julio' }, { v: 8, label: 'Agosto' }, { v: 9, label: 'Septiembre' },
  { v: 10, label: 'Octubre' }, { v: 11, label: 'Noviembre' }, { v: 12, label: 'Diciembre' },
]

function estadoColor(estado: string) {
  switch (estado) {
    case 'ABIERTO': return 'bg-emerald-100 text-emerald-700'
    case 'EN_CIERRE': return 'bg-amber-100 text-amber-700'
    case 'CERRADO': return 'bg-slate-200 text-slate-700'
    case 'REABIERTO': return 'bg-sky-100 text-sky-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export default function PeriodosPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [saving, setSaving] = useState(false)
  const [aCerrar, setACerrar] = useState<Periodo | null>(null)
  const [aReabrir, setAReabrir] = useState<Periodo | null>(null)
  const [motivoReapertura, setMotivoReapertura] = useState('')

  const cargar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const r = await apiContador(`/api/portal-contador/periodos?empresaId=${empresaId}`)
    setLoading(false)
    if (r.ok) setPeriodos(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar períodos.')
  }, [empresaId])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
  }, [authLoading, user, cargar])

  const crear = async () => {
    if (!empresaId) return
    setSaving(true)
    const r = await apiContador('/api/portal-contador/periodos', {
      method: 'POST',
      body: JSON.stringify({ empresaId, anio: Number(anio), mes: Number(mes) }),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo crear el período.')
      return
    }
    toast.success('Período creado.')
    setDialogOpen(false)
    cargar()
  }

  const cerrar = async () => {
    if (!aCerrar || !empresaId) return
    const r = await apiContador(`/api/portal-contador/periodos/${aCerrar.id}/cerrar?empresaId=${empresaId}`, {
      method: 'POST',
      body: JSON.stringify({ accion: 'cerrar' }),
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo cerrar el período.')
      return
    }
    toast.success('Período cerrado.')
    setACerrar(null)
    cargar()
  }

  const reabrir = async () => {
    if (!aReabrir || !empresaId) return
    const r = await apiContador(`/api/portal-contador/periodos/${aReabrir.id}/cerrar?empresaId=${empresaId}`, {
      method: 'POST',
      body: JSON.stringify({ accion: 'reabrir', motivo: motivoReapertura }),
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo reabrir el período.')
      return
    }
    toast.success('Período reabierto.')
    setAReabrir(null)
    setMotivoReapertura('')
    cargar()
  }

  const eliminar = async (p: Periodo) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/periodos/${p.id}?empresaId=${empresaId}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo eliminar.')
      return
    }
    toast.success('Período eliminado.')
    cargar()
  }

  if (authLoading) return null

  if (!empresaId) {
    return (
      <div className="p-6">
        <PageHeader titulo="Períodos" />
        <EmptyState titulo="Seleccione una empresa" descripcion="Elija una empresa para gestionar sus períodos contables." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Períodos contables"
        descripcion="Apertura y cierre de períodos. Un período CERRADO bloquea la creación de comprobantes."
        acciones={
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo período
          </Button>
        }
      />

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && periodos.length === 0 && (
        <EmptyState titulo="No hay períodos" descripcion="Cree el primer período contable para la empresa." />
      )}

      {!loading && periodos.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Año</TableHead>
                    <TableHead>Mes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Comprobantes</TableHead>
                    <TableHead>Fecha cierre</TableHead>
                    <TableHead>Cerrado por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.anio}</TableCell>
                      <TableCell>{MESES.find((m) => m.v === p.mes)?.label || p.mes}</TableCell>
                      <TableCell><Badge className={estadoColor(p.estado)}>{p.estado}</Badge></TableCell>
                      <TableCell className="text-xs">{p._count?.comprobantes ?? 0}</TableCell>
                      <TableCell className="text-xs">{formatDate(p.fechaCierre)}</TableCell>
                      <TableCell className="text-xs">{p.cerradoPor || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(p.estado === 'ABIERTO' || p.estado === 'EN_CIERRE' || p.estado === 'REABIERTO') && (
                            <Button variant="ghost" size="sm" onClick={() => setACerrar(p)} title="Cerrar período">
                              <Lock className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {p.estado === 'CERRADO' && (
                            <Button variant="ghost" size="sm" onClick={() => setAReabrir(p)} title="Reabrir período">
                              <Unlock className="h-4 w-4 text-sky-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => eliminar(p)} title="Eliminar">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-sky-600" /> Nuevo período
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={saving}>{saving ? 'Creando…' : 'Crear período'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aCerrar} onOpenChange={(o) => !o && setACerrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el período {aCerrar?.anio}-{String(aCerrar?.mes).padStart(2, '0')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Una vez cerrado, no se podrán crear ni editar comprobantes en este período. Los
              comprobantes en BORRADOR deberán aprobarse o anularse antes de cerrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={cerrar}>Cerrar período</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!aReabrir} onOpenChange={(o) => { if (!o) { setAReabrir(null); setMotivoReapertura('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir período {aReabrir?.anio}-{String(aReabrir?.mes).padStart(2, '0')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo de reapertura *</Label>
            <Textarea
              rows={3}
              value={motivoReapertura}
              onChange={(e) => setMotivoReapertura(e.target.value)}
              placeholder="Explique la razón por la que se reabre el período (queda registrado en auditoría)."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAReabrir(null); setMotivoReapertura('') }}>Cancelar</Button>
            <Button onClick={reabrir} disabled={!motivoReapertura.trim()}>Reabrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
