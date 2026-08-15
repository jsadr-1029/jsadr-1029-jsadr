'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  Save,
  AlertTriangle,
} from 'lucide-react'
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
import { toast } from 'sonner'

interface Cuenta {
  id: string
  codigo: string
  nombre: string
  naturaleza: string
  tipo: string
  estado: string
}

interface Periodo {
  id: string
  anio: number
  mes: number
  estado: string
}

interface Asiento {
  id: string
  cuentaId: string
  cuenta?: Cuenta
  terceroId?: string | null
  centroCosto?: string | null
  debito: number
  credito: number
  descripcion?: string | null
}

interface Comprobante {
  id: string
  numero: string
  tipo: string
  fechaDocumento: string
  fechaContable: string
  concepto: string
  descripcion?: string | null
  totalDebitos: number
  totalCreditos: number
  estado: string
  createdAt: string
  periodo?: { anio: number; mes: number; estado: string } | null
  asientos?: Asiento[]
}

const TIPOS_CBTE = ['INGRESO', 'EGRESO', 'DIARIO', 'AJUSTE', 'RECLASIFICACION', 'REVERSO', 'CIERRE']

interface FilaAsiento {
  cuentaId: string
  debito: string
  credito: string
  descripcion: string
}

const emptyForm = {
  tipo: 'DIARIO',
  periodoId: '',
  concepto: '',
  descripcion: '',
  fechaContable: '',
  asientos: [] as FilaAsiento[],
}

export default function ContabilidadPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('ALL')
  const [filtroPeriodo, setFiltroPeriodo] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [viendo, setViendo] = useState<Comprobante | null>(null)

  const cargarCatalogos = useCallback(async () => {
    if (!empresaId) return
    const [rc, rp] = await Promise.all([
      apiContador(`/api/portal-contador/puc?empresaId=${empresaId}`),
      apiContador(`/api/portal-contador/periodos?empresaId=${empresaId}`),
    ])
    if (rc.ok) setCuentas(rc.data.data || [])
    if (rp.ok) setPeriodos(rp.data.data || [])
  }, [empresaId])

  const cargar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const params = new URLSearchParams({ empresaId, q })
    if (filtroEstado !== 'ALL') params.set('estado', filtroEstado)
    if (filtroPeriodo !== 'ALL') params.set('periodoId', filtroPeriodo)
    const r = await apiContador(`/api/portal-contador/comprobantes?${params.toString()}`)
    setLoading(false)
    if (r.ok) setComprobantes(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar comprobantes.')
  }, [empresaId, q, filtroEstado, filtroPeriodo])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
    cargarCatalogos()
  }, [authLoading, user, cargar, cargarCatalogos])

  const totales = useMemo(() => {
    const d = form.asientos.reduce((s, a) => s + (Number(a.debito) || 0), 0)
    const c = form.asientos.reduce((s, a) => s + (Number(a.credito) || 0), 0)
    return { debitos: d, creditos: c, diff: Math.abs(d - c) }
  }, [form.asientos])

  const abrirNuevo = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    setForm({
      tipo: 'DIARIO',
      periodoId: periodos.find((p) => p.estado === 'ABIERTO')?.id || '',
      concepto: '',
      descripcion: '',
      fechaContable: hoy,
      asientos: [{ cuentaId: '', debito: '', credito: '', descripcion: '' }],
    })
    setDialogOpen(true)
  }

  const agregarFila = () => {
    setForm({ ...form, asientos: [...form.asientos, { cuentaId: '', debito: '', credito: '', descripcion: '' }] })
  }
  const quitarFila = (i: number) => {
    setForm({ ...form, asientos: form.asientos.filter((_, idx) => idx !== i) })
  }
  const actualizarFila = (i: number, campo: keyof FilaAsiento, valor: string) => {
    const nuevas = [...form.asientos]
    nuevas[i] = { ...nuevas[i], [campo]: valor }
    setForm({ ...form, asientos: nuevas })
  }

  const guardar = async () => {
    if (!empresaId) return
    if (!form.tipo || !form.concepto || !form.periodoId) {
      toast.error('Tipo, concepto y período son obligatorios.')
      return
    }
    if (form.asientos.length === 0) {
      toast.error('Agregue al menos un asiento.')
      return
    }
    const asientosValidos = form.asientos.filter((a) => a.cuentaId && (Number(a.debito) > 0 || Number(a.credito) > 0))
    if (asientosValidos.length === 0) {
      toast.error('Cada asiento debe tener cuenta y un monto.')
      return
    }
    if (totales.diff > 0.01) {
      toast.error(`Comprobante descuadrado. Diferencia: ${formatCOP(totales.diff)}`)
      return
    }
    setSaving(true)
    const body = {
      empresaId,
      tipo: form.tipo,
      concepto: form.concepto,
      descripcion: form.descripcion,
      periodoId: form.periodoId,
      fechaContable: form.fechaContable ? new Date(form.fechaContable).toISOString() : undefined,
      asientos: asientosValidos.map((a) => ({
        cuentaId: a.cuentaId,
        debito: Number(a.debito) || 0,
        credito: Number(a.credito) || 0,
        descripcion: a.descripcion || null,
      })),
    }
    const r = await apiContador('/api/portal-contador/comprobantes', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo guardar el comprobante.')
      return
    }
    toast.success('Comprobante creado correctamente.')
    setDialogOpen(false)
    cargar()
  }

  const cambiarEstado = async (c: Comprobante, estado: string) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/comprobantes/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ empresaId, estado }),
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo cambiar el estado.')
      return
    }
    toast.success(`Comprobante ${estado.toLowerCase()}.`)
    cargar()
  }

  const eliminar = async (c: Comprobante) => {
    if (!empresaId) return
    const r = await apiContador(`/api/portal-contador/comprobantes/${c.id}?empresaId=${empresaId}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo eliminar.')
      return
    }
    toast.success('Comprobante eliminado.')
    cargar()
  }

  const verDetalle = async (c: Comprobante) => {
    const r = await apiContador(`/api/portal-contador/comprobantes/${c.id}?empresaId=${empresaId}`)
    if (r.ok) setViendo(r.data.data)
    else toast.error('No se pudo cargar el detalle.')
  }

  if (authLoading) return null

  if (!empresaId) {
    return (
      <div className="p-6">
        <PageHeader titulo="Contabilidad" />
        <EmptyState titulo="Seleccione una empresa" descripcion="Elija una empresa para gestionar sus comprobantes contables." />
      </div>
    )
  }

  const cuentasOptions = cuentas.filter((c) => c.estado === 'ACTIVA')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Contabilidad · Comprobantes"
        descripcion="Registro de comprobantes contables. Regla: débitos deben ser iguales a créditos."
        acciones={
          <Button onClick={abrirNuevo} className="gap-2" disabled={cuentas.length === 0 || periodos.length === 0}>
            <Plus className="h-4 w-4" /> Nuevo comprobante
          </Button>
        }
      />

      {cuentas.length === 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          No hay cuentas PUC registradas. Cree cuentas antes de registrar comprobantes.
        </div>
      )}

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por número o concepto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="ANULADO">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los períodos</SelectItem>
                {periodos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && comprobantes.length === 0 && (
        <EmptyState
          titulo="No hay comprobantes"
          descripcion="Registre el primer comprobante contable."
          accion={
            <Button onClick={abrirNuevo} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo comprobante
            </Button>
          }
        />
      )}

      {!loading && comprobantes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-semibold">{c.numero}</TableCell>
                      <TableCell className="text-xs">{formatDate(c.fechaContable)}</TableCell>
                      <TableCell><Badge variant="secondary">{c.tipo}</Badge></TableCell>
                      <TableCell className="max-w-[220px] truncate">{c.concepto}</TableCell>
                      <TableCell className="text-xs">
                        {c.periodo ? `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCOP(c.totalDebitos)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            c.estado === 'APROBADO'
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.estado === 'ANULADO'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }
                        >
                          {c.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => verDetalle(c)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {c.estado === 'BORRADOR' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => cambiarEstado(c, 'APROBADO')} title="Aprobar">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => eliminar(c)} title="Eliminar">
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </>
                          )}
                          {c.estado === 'APROBADO' && (
                            <Button variant="ghost" size="sm" onClick={() => cambiarEstado(c, 'ANULADO')} title="Anular">
                              <XCircle className="h-4 w-4 text-rose-600" />
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

      {/* Dialog nuevo comprobante */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Nuevo comprobante contable
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CBTE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período *</Label>
              <Select value={form.periodoId} onValueChange={(v) => setForm({ ...form, periodoId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar período" /></SelectTrigger>
                <SelectContent>
                  {periodos.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.estado === 'CERRADO'}>
                      {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha contable</Label>
              <Input
                type="date"
                value={form.fechaContable}
                onChange={(e) => setForm({ ...form, fechaContable: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3 space-y-2">
              <Label>Concepto *</Label>
              <Input
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Descripción corta del comprobante"
              />
            </div>
            <div className="sm:col-span-3 space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
          </div>

          {/* Asientos */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Asientos</h3>
              <Button variant="outline" size="sm" onClick={agregarFila} className="gap-1">
                <Plus className="h-3 w-3" /> Agregar línea
              </Button>
            </div>
            <div className="rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%]">Cuenta</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.asientos.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={a.cuentaId} onValueChange={(v) => actualizarFila(i, 'cuentaId', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {cuentasOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.codigo} · {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={a.debito}
                          onChange={(e) => actualizarFila(i, 'debito', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-right text-xs"
                          value={a.credito}
                          onChange={(e) => actualizarFila(i, 'credito', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          value={a.descripcion}
                          onChange={(e) => actualizarFila(i, 'descripcion', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => quitarFila(i)}>
                          <Trash2 className="h-3 w-3 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {form.asientos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-4 text-center text-sm text-slate-400">
                        Sin líneas. Agregue al menos una.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totales */}
            <div
              className={`mt-3 flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
                totales.diff > 0.01
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700'
              }`}
            >
              <span className="font-medium">
                {totales.diff > 0.01 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Descuadrado por {formatCOP(totales.diff)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Cuadrado
                  </span>
                )}
              </span>
              <span className="font-mono">
                Débitos: {formatCOP(totales.debitos)} · Créditos: {formatCOP(totales.creditos)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving || totales.diff > 0.01} className="gap-2">
              {saving ? 'Guardando…' : <><Save className="h-4 w-4" /> Guardar comprobante</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ver detalle */}
      <Dialog open={!!viendo} onOpenChange={(o) => !o && setViendo(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              {viendo?.numero}
            </DialogTitle>
          </DialogHeader>
          {viendo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><span className="text-slate-500">Tipo:</span> <Badge variant="secondary">{viendo.tipo}</Badge></div>
                <div><span className="text-slate-500">Fecha:</span> {formatDate(viendo.fechaContable)}</div>
                <div><span className="text-slate-500">Estado:</span> {viendo.estado}</div>
                <div><span className="text-slate-500">Período:</span> {viendo.periodo ? `${viendo.periodo.anio}-${String(viendo.periodo.mes).padStart(2, '0')}` : '—'}</div>
                <div className="col-span-2 sm:col-span-4"><span className="text-slate-500">Concepto:</span> {viendo.concepto}</div>
                {viendo.descripcion && <div className="col-span-2 sm:col-span-4"><span className="text-slate-500">Descripción:</span> {viendo.descripcion}</div>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(viendo.asientos || []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.cuenta?.codigo}</TableCell>
                      <TableCell className="text-xs">{a.cuenta?.nombre}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{a.debito ? formatCOP(a.debito) : ''}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{a.credito ? formatCOP(a.credito) : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-6 text-sm font-medium">
                <span>Total débitos: <span className="font-mono">{formatCOP(viendo.totalDebitos)}</span></span>
                <span>Total créditos: <span className="font-mono">{formatCOP(viendo.totalCreditos)}</span></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
