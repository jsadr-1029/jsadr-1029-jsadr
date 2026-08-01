'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  BarChart3,
  Target,
  DollarSign,
  Calendar,
  Activity,
  RefreshCw,
} from 'lucide-react'

interface PlanFinanciero {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  tipo: string
  estado: string
  prioridad: string
  fechaInicio: string
  fechaFin: string
  fechaAprobacion: string | null
  presupuestoInversion: number
  metaIngresos: number
  metaAhorroCostos: number
  roiEsperado: number
  ingresoReal: number
  costoReal: number
  roiReal: number
  responsableNombre: string | null
  creadoPor: string | null
  aprobadoPor: string | null
  progreso: number
  indicadores: string | null
  notasSeguimiento: string | null
  createdAt: string
}

interface Resumen {
  total: number
  activos: number
  borradores: number
  completados: number
  inversionTotal: number
  ingresosMeta: number
  ingresosReales: number
  roiPromedio: number
}

const TIPOS = {
  CRECIMIENTO: { label: 'Crecimiento', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  OPTIMIZACION: { label: 'Optimización', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  REDUCCION_RIESGO: { label: 'Reducción de Riesgo', color: 'bg-amber-500/15 text-amber-300 border-amber-400/40' },
  LIQUIDEZ: { label: 'Liquidez', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40' },
  EXPANSION: { label: 'Expansión', color: 'bg-violet-500/15 text-violet-300 border-violet-400/40' },
}

const ESTADOS = {
  BORRADOR: { label: 'Borrador', color: 'bg-slate-500/15 text-slate-300 border-slate-400/40' },
  ACTIVO: { label: 'Activo', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  EN_REVISION: { label: 'En Revisión', color: 'bg-amber-500/15 text-amber-300 border-amber-400/40' },
  COMPLETADO: { label: 'Completado', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-500/15 text-red-300 border-red-400/40' },
}

const PRIORIDADES = {
  BAJA: { label: 'Baja', color: 'bg-slate-500/15 text-slate-300' },
  MEDIA: { label: 'Media', color: 'bg-blue-500/15 text-blue-300' },
  ALTA: { label: 'Alta', color: 'bg-amber-500/15 text-amber-300' },
  CRITICA: { label: 'Crítica', color: 'bg-red-500/15 text-red-300' },
}

export function PlanFinancieroView() {
  const { toast } = useToast()
  const [planes, setPlanes] = useState<PlanFinanciero[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [filtroTipo, setFiltroTipo] = useState('all')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [planEditando, setPlanEditando] = useState<PlanFinanciero | null>(null)
  const [modalMetricas, setModalMetricas] = useState<PlanFinanciero | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Form state
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'CRECIMIENTO',
    prioridad: 'MEDIA',
    fechaInicio: '',
    fechaFin: '',
    presupuestoInversion: '0',
    metaIngresos: '0',
    metaAhorroCostos: '0',
    roiEsperado: '0',
    responsableNombre: '',
    indicadores: '',
  })

  // Form métricas
  const [metricas, setMetricas] = useState({
    ingresoReal: '0',
    costoReal: '0',
    progreso: '0',
    notasSeguimiento: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado !== 'all') params.set('estado', filtroEstado)
      if (filtroTipo !== 'all') params.set('tipo', filtroTipo)
      const res = await fetch(`/api/planes-financieros?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setPlanes(json.data || [])
        setResumen(json.resumen || null)
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroTipo, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  const abrirNuevo = () => {
    setPlanEditando(null)
    const hoy = new Date().toISOString().slice(0, 10)
    const fin = new Date()
    fin.setMonth(fin.getMonth() + 6)
    setForm({
      nombre: '',
      descripcion: '',
      tipo: 'CRECIMIENTO',
      prioridad: 'MEDIA',
      fechaInicio: hoy,
      fechaFin: fin.toISOString().slice(0, 10),
      presupuestoInversion: '0',
      metaIngresos: '0',
      metaAhorroCostos: '0',
      roiEsperado: '0',
      responsableNombre: '',
      indicadores: '',
    })
    setModalAbierto(true)
  }

  const abrirEditar = (plan: PlanFinanciero) => {
    setPlanEditando(plan)
    setForm({
      nombre: plan.nombre,
      descripcion: plan.descripcion || '',
      tipo: plan.tipo,
      prioridad: plan.prioridad,
      fechaInicio: plan.fechaInicio.slice(0, 10),
      fechaFin: plan.fechaFin.slice(0, 10),
      presupuestoInversion: String(plan.presupuestoInversion),
      metaIngresos: String(plan.metaIngresos),
      metaAhorroCostos: String(plan.metaAhorroCostos),
      roiEsperado: String(plan.roiEsperado),
      responsableNombre: plan.responsableNombre || '',
      indicadores: plan.indicadores || '',
    })
    setModalAbierto(true)
  }

  const abrirMetricas = (plan: PlanFinanciero) => {
    setModalMetricas(plan)
    setMetricas({
      ingresoReal: String(plan.ingresoReal || 0),
      costoReal: String(plan.costoReal || 0),
      progreso: String(plan.progreso || 0),
      notasSeguimiento: plan.notasSeguimiento || '',
    })
  }

  const guardar = async () => {
    if (!form.nombre || form.nombre.length < 3) {
      toast({ title: 'Nombre muy corto', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      if (planEditando) {
        // Actualizar
        const res = await fetch(`/api/planes-financieros/${planEditando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'actualizar', ...form }),
        })
        const json = await res.json()
        if (json.success) {
          toast({ title: 'Plan actualizado', description: json.mensaje })
          setModalAbierto(false)
          cargar()
        } else {
          toast({ title: 'Error', description: json.error, variant: 'destructive' })
        }
      } else {
        // Crear
        const res = await fetch('/api/planes-financieros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        if (json.success) {
          toast({ title: 'Plan creado', description: json.mensaje })
          setModalAbierto(false)
          cargar()
        } else {
          toast({ title: 'Error', description: json.error, variant: 'destructive' })
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const cambiarEstado = async (plan: PlanFinanciero, accion: string) => {
    try {
      const res = await fetch(`/api/planes-financieros/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Estado actualizado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const guardarMetricas = async () => {
    if (!modalMetricas) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/planes-financieros/${modalMetricas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'actualizar_metricas', ...metricas }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Métricas actualizadas', description: json.mensaje })
        setModalMetricas(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = async (plan: PlanFinanciero) => {
    if (!confirm(`¿Eliminar el plan ${plan.codigo}? Solo se pueden eliminar planes en BORRADOR o CANCELADO.`)) return
    try {
      const res = await fetch(`/api/planes-financieros/${plan.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Plan eliminado', description: json.mensaje })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan Estratégico Financiero"
        subtitle="Planificación de estrategias con propósito financiero"
        icon={<TrendingUp className="w-5 h-5" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
            <Button size="sm" onClick={abrirNuevo}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Plan
            </Button>
          </>
        }
      />

      {/* KPIs de resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-primary">{resumen.total}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Activos</span>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold text-emerald-400">{resumen.activos}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Inversión</span>
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-sm font-bold text-amber-400">{formatearMoneda(resumen.inversionTotal)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Meta Ing.</span>
                <Target className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-blue-400">{formatearMoneda(resumen.ingresosMeta)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ing. Reales</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-emerald-400">{formatearMoneda(resumen.ingresosReales)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">ROI Prom.</span>
                <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-2xl font-bold text-violet-400">{resumen.roiPromedio.toFixed(1)}%</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Estado:</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Tipo:</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(TIPOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de planes */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">Planes Estratégicos ({planes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {planes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No hay planes registrados. Crea el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Inversión</TableHead>
                    <TableHead>Meta Ingresos</TableHead>
                    <TableHead>ROI Real</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="font-medium text-sm">{p.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${TIPOS[p.tipo as keyof typeof TIPOS]?.color}`}>
                          {TIPOS[p.tipo as keyof typeof TIPOS]?.label || p.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${ESTADOS[p.estado as keyof typeof ESTADOS]?.color}`}>
                          {ESTADOS[p.estado as keyof typeof ESTADOS]?.label || p.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${PRIORIDADES[p.prioridad as keyof typeof PRIORIDADES]?.color}`}>
                          {PRIORIDADES[p.prioridad as keyof typeof PRIORIDADES]?.label || p.prioridad}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatearMoneda(p.presupuestoInversion)}</TableCell>
                      <TableCell className="text-xs">{formatearMoneda(p.metaIngresos)}</TableCell>
                      <TableCell className="text-xs">
                        <span className={p.roiReal >= p.roiEsperado ? 'text-emerald-400' : 'text-amber-400'}>
                          {p.roiReal.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, p.progreso)}%` }}
                            />
                          </div>
                          <span className="text-[10px]">{p.progreso.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {formatearFecha(p.fechaInicio)} → {formatearFecha(p.fechaFin)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.estado === 'BORRADOR' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'activar')} title="Activar">
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                            </Button>
                          )}
                          {p.estado === 'ACTIVO' && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => abrirMetricas(p)} title="Actualizar métricas">
                                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'completar')} title="Completar">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => abrirEditar(p)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {(p.estado === 'BORRADOR' || p.estado === 'CANCELADO') && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => eliminar(p)} title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          )}
                          {p.estado !== 'CANCELADO' && p.estado !== 'COMPLETADO' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'cancelar')} title="Cancelar">
                              <XCircle className="w-3.5 h-3.5 text-amber-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal crear/editar */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{planEditando ? `Editar ${planEditando.codigo}` : 'Nuevo Plan Estratégico'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del plan *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Expansión de cartera Q4 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Objetivos, alcance, justificación..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha inicio *</Label>
                <Input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin *</Label>
                <Input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Presupuesto inversión (COP)</Label>
                <Input type="number" value={form.presupuestoInversion} onChange={(e) => setForm({ ...form, presupuestoInversion: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Meta ingresos (COP)</Label>
                <Input type="number" value={form.metaIngresos} onChange={(e) => setForm({ ...form, metaIngresos: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta ahorro costos (COP)</Label>
                <Input type="number" value={form.metaAhorroCostos} onChange={(e) => setForm({ ...form, metaAhorroCostos: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ROI esperado (%)</Label>
                <Input type="number" step="0.1" value={form.roiEsperado} onChange={(e) => setForm({ ...form, roiEsperado: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input value={form.responsableNombre} onChange={(e) => setForm({ ...form, responsableNombre: e.target.value })} placeholder="Nombre del responsable" />
            </div>
            <div className="space-y-2">
              <Label>Indicadores (KPIs)</Label>
              <Textarea
                value={form.indicadores}
                onChange={(e) => setForm({ ...form, indicadores: e.target.value })}
                placeholder='JSON con KPIs personalizados, ej: {"nuevosClientes": 50, "moraMaxima": 5}'
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={enviando}>
              {enviando ? 'Guardando...' : planEditando ? 'Actualizar' : 'Crear plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal métricas */}
      <Dialog open={!!modalMetricas} onOpenChange={(o) => !o && setModalMetricas(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Actualizar métricas — {modalMetricas?.codigo}</DialogTitle>
          </DialogHeader>
          {modalMetricas && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-md text-sm">
                <p className="font-medium">{modalMetricas.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ROI esperado: {modalMetricas.roiEsperado}% · Meta ingresos: {formatearMoneda(modalMetricas.metaIngresos)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ingreso real (COP)</Label>
                  <Input type="number" value={metricas.ingresoReal} onChange={(e) => setMetricas({ ...metricas, ingresoReal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Costo real (COP)</Label>
                  <Input type="number" value={metricas.costoReal} onChange={(e) => setMetricas({ ...metricas, costoReal: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Progreso (%)</Label>
                <Input type="number" min="0" max="100" value={metricas.progreso} onChange={(e) => setMetricas({ ...metricas, progreso: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notas de seguimiento</Label>
                <Textarea
                  value={metricas.notasSeguimiento}
                  onChange={(e) => setMetricas({ ...metricas, notasSeguimiento: e.target.value })}
                  placeholder="Observaciones, decisiones, próximos pasos..."
                  rows={3}
                />
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs text-blue-700 dark:text-blue-300">
                💡 El ROI real se calculará automáticamente como: ((ingreso - costo) / costo) × 100
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMetricas(null)}>Cancelar</Button>
            <Button onClick={guardarMetricas} disabled={enviando}>
              {enviando ? 'Guardando...' : 'Actualizar métricas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
