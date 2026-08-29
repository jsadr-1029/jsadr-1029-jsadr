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
  Users,
  Plus,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  Play,
  Flag,
  XCircle,
  RefreshCw,
  Target,
  DollarSign,
  TrendingUp,
  Calendar,
} from 'lucide-react'

interface PlanCliente {
  id: string
  codigo: string
  clienteId: string
  clienteCedula: string
  clienteNombre: string
  nombre: string
  descripcion: string | null
  tipo: string
  estado: string
  fechaInicio: string
  fechaFin: string
  fechaAceptacion: string | null
  montoObjetivo: number
  tasaPersonalizada: number | null
  plazoMeses: number
  cuotaObjetivo: number
  montoAprobado: number
  cuotaActual: number
  pagosRealizados: number
  saldoPendiente: number
  objetivoComercial: string | null
  metricasExito: string | null
  progreso: number
  prestamoVinculadoId: string | null
  gestorAsignado: string | null
  creadoPor: string | null
  notasSeguimiento: string | null
  createdAt: string
}

interface Cliente {
  id: string
  nombre: string
  cedula: string
  telefono: string
}

interface Resumen {
  total: number
  aceptados: number
  enEjecucion: number
  completados: number
  montoObjetivoTotal: number
  montoAprobadoTotal: number
  progresoPromedio: number
}

const TIPOS = {
  PERSONALIZADO: { label: 'Personalizado', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  REESTRUCTURACION: { label: 'Reestructuración', color: 'bg-amber-500/15 text-amber-300 border-amber-400/40' },
  REFINANCIACION: { label: 'Refinanciación', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40' },
  EXPANSION_CREDITO: { label: 'Expansión Crédito', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  FIDELIZACION: { label: 'Fidelización', color: 'bg-violet-500/15 text-violet-300 border-violet-400/40' },
}

const ESTADOS = {
  BORRADOR: { label: 'Borrador', color: 'bg-slate-500/15 text-slate-300 border-slate-400/40' },
  PROPUESTO: { label: 'Propuesto', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  ACEPTADO: { label: 'Aceptado', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  EN_EJECUCION: { label: 'En Ejecución', color: 'bg-violet-500/15 text-violet-300 border-violet-400/40' },
  COMPLETADO: { label: 'Completado', color: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-500/15 text-red-300 border-red-400/40' },
}

export function PlanClienteView() {
  const { toast } = useToast()
  const [planes, setPlanes] = useState<PlanCliente[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [filtroTipo, setFiltroTipo] = useState('all')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [planEditando, setPlanEditando] = useState<PlanCliente | null>(null)
  const [modalMetricas, setModalMetricas] = useState<PlanCliente | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])

  // Form state
  const [form, setForm] = useState({
    clienteId: '',
    nombre: '',
    descripcion: '',
    tipo: 'PERSONALIZADO',
    fechaInicio: '',
    fechaFin: '',
    montoObjetivo: '0',
    tasaPersonalizada: '',
    plazoMeses: '12',
    cuotaObjetivo: '0',
    objetivoComercial: '',
    metricasExito: '',
    gestorAsignado: '',
  })

  // Form métricas
  const [metricas, setMetricas] = useState({
    montoAprobado: '0',
    cuotaActual: '0',
    pagosRealizados: '0',
    saldoPendiente: '0',
    progreso: '0',
    notasSeguimiento: '',
    prestamoVinculadoId: '',
  })

  // Cargar clientes
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/clientes')
        const json = await res.json()
        if (json.success) {
          setClientes(
            (json.data || [])
              .filter((c: any) => c.activo !== false)
              .map((c: any) => ({
                id: c.id,
                nombre: c.nombre,
                cedula: c.cedula,
                telefono: c.telefono,
              }))
              .sort((a: Cliente, b: Cliente) => a.nombre.localeCompare(b.nombre))
          )
        }
      } catch (e) {
        console.error('Error cargando clientes:', e)
      }
    })()
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado !== 'all') params.set('estado', filtroEstado)
      if (filtroTipo !== 'all') params.set('tipo', filtroTipo)
      const res = await fetch(`/api/planes-clientes?${params.toString()}`, { cache: 'no-store' })
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
    fin.setMonth(fin.getMonth() + 12)
    setForm({
      clienteId: '',
      nombre: '',
      descripcion: '',
      tipo: 'PERSONALIZADO',
      fechaInicio: hoy,
      fechaFin: fin.toISOString().slice(0, 10),
      montoObjetivo: '0',
      tasaPersonalizada: '',
      plazoMeses: '12',
      cuotaObjetivo: '0',
      objetivoComercial: '',
      metricasExito: '',
      gestorAsignado: '',
    })
    setModalAbierto(true)
  }

  const abrirEditar = (plan: PlanCliente) => {
    setPlanEditando(plan)
    setForm({
      clienteId: plan.clienteId,
      nombre: plan.nombre,
      descripcion: plan.descripcion || '',
      tipo: plan.tipo,
      fechaInicio: plan.fechaInicio.slice(0, 10),
      fechaFin: plan.fechaFin.slice(0, 10),
      montoObjetivo: String(plan.montoObjetivo),
      tasaPersonalizada: plan.tasaPersonalizada ? String(plan.tasaPersonalizada) : '',
      plazoMeses: String(plan.plazoMeses),
      cuotaObjetivo: String(plan.cuotaObjetivo),
      objetivoComercial: plan.objetivoComercial || '',
      metricasExito: plan.metricasExito || '',
      gestorAsignado: plan.gestorAsignado || '',
    })
    setModalAbierto(true)
  }

  const abrirMetricas = (plan: PlanCliente) => {
    setModalMetricas(plan)
    setMetricas({
      montoAprobado: String(plan.montoAprobado || 0),
      cuotaActual: String(plan.cuotaActual || 0),
      pagosRealizados: String(plan.pagosRealizados || 0),
      saldoPendiente: String(plan.saldoPendiente || 0),
      progreso: String(plan.progreso || 0),
      notasSeguimiento: plan.notasSeguimiento || '',
      prestamoVinculadoId: plan.prestamoVinculadoId || '',
    })
  }

  const guardar = async () => {
    if (!form.clienteId) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    if (!form.nombre || form.nombre.length < 3) {
      toast({ title: 'Nombre muy corto', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      if (planEditando) {
        const res = await fetch(`/api/planes-clientes/${planEditando.id}`, {
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
        const res = await fetch('/api/planes-clientes', {
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

  const cambiarEstado = async (plan: PlanCliente, accion: string) => {
    try {
      const res = await fetch(`/api/planes-clientes/${plan.id}`, {
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
      const res = await fetch(`/api/planes-clientes/${modalMetricas.id}`, {
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

  const eliminar = async (plan: PlanCliente) => {
    if (!confirm(`¿Eliminar el plan ${plan.codigo}? Solo se pueden eliminar planes en BORRADOR o CANCELADO.`)) return
    try {
      const res = await fetch(`/api/planes-clientes/${plan.id}`, { method: 'DELETE' })
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
        title="Planes para Clientes"
        subtitle="Planificación personalizada de planes y estrategias para clientes"
        icon={<Users className="w-5 h-5" />}
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
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-primary">{resumen.total}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Aceptados</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold text-emerald-400">{resumen.aceptados}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">En Ejec.</span>
                <Play className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-2xl font-bold text-violet-400">{resumen.enEjecucion}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Monto Obj.</span>
                <Target className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-blue-400">{formatearMoneda(resumen.montoObjetivoTotal)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Aprobado</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-emerald-400">{formatearMoneda(resumen.montoAprobadoTotal)}</span>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Progreso</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-2xl font-bold text-amber-400">{resumen.progresoPromedio.toFixed(0)}%</span>
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
          <CardTitle className="text-sm">Planes de Clientes ({planes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {planes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No hay planes registrados. Crea el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Nombre Plan</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Monto Obj.</TableHead>
                    <TableHead>Aprobado</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.clienteNombre}</p>
                          <p className="text-[10px] text-muted-foreground">{p.clienteCedula}</p>
                        </div>
                      </TableCell>
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
                      <TableCell className="text-xs">{formatearMoneda(p.montoObjetivo)}</TableCell>
                      <TableCell className="text-xs">{formatearMoneda(p.montoAprobado)}</TableCell>
                      <TableCell className="text-xs">{formatearMoneda(p.saldoPendiente)}</TableCell>
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
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'proponer')} title="Proponer al cliente">
                              <Send className="w-3.5 h-3.5 text-blue-400" />
                            </Button>
                          )}
                          {(p.estado === 'PROPUESTO' || p.estado === 'BORRADOR') && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'aceptar')} title="Marcar aceptado">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            </Button>
                          )}
                          {p.estado === 'ACEPTADO' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'iniciar_ejecucion')} title="Iniciar ejecución">
                              <Play className="w-3.5 h-3.5 text-violet-400" />
                            </Button>
                          )}
                          {p.estado === 'EN_EJECUCION' && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => abrirMetricas(p)} title="Actualizar métricas">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cambiarEstado(p, 'completar')} title="Completar">
                                <Flag className="w-3.5 h-3.5 text-emerald-400" />
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
            <DialogTitle>{planEditando ? `Editar ${planEditando.codigo}` : 'Nuevo Plan para Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={form.clienteId}
                onValueChange={(v) => setForm({ ...form, clienteId: v })}
                disabled={!!planEditando}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} · {c.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre del plan *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Plan de expansión de crédito Q1 2027"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Objetivos del plan para el cliente..."
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
                <Label>Gestor asignado</Label>
                <Input
                  value={form.gestorAsignado}
                  onChange={(e) => setForm({ ...form, gestorAsignado: e.target.value })}
                  placeholder="Nombre del gestor"
                />
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
                <Label>Monto objetivo (COP)</Label>
                <Input type="number" value={form.montoObjetivo} onChange={(e) => setForm({ ...form, montoObjetivo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cuota objetivo (COP)</Label>
                <Input type="number" value={form.cuotaObjetivo} onChange={(e) => setForm({ ...form, cuotaObjetivo: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tasa personalizada (% mensual, opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.tasaPersonalizada}
                  onChange={(e) => setForm({ ...form, tasaPersonalizada: e.target.value })}
                  placeholder="Ej: 2.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Plazo (meses)</Label>
                <Input type="number" min="1" max="120" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objetivo comercial</Label>
              <Input
                value={form.objetivoComercial}
                onChange={(e) => setForm({ ...form, objetivoComercial: e.target.value })}
                placeholder="Ej: Aumentar línea de crédito 30%"
              />
            </div>
            <div className="space-y-2">
              <Label>Métricas de éxito (KPIs)</Label>
              <Textarea
                value={form.metricasExito}
                onChange={(e) => setForm({ ...form, metricasExito: e.target.value })}
                placeholder='JSON con métricas, ej: {"pagosPuntuales": 90, "moraMaxima": 5}'
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
                  Cliente: {modalMetricas.clienteNombre} ({modalMetricas.clienteCedula})
                </p>
                <p className="text-xs text-muted-foreground">
                  Monto objetivo: {formatearMoneda(modalMetricas.montoObjetivo)} · Cuota objetivo: {formatearMoneda(modalMetricas.cuotaObjetivo)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto aprobado (COP)</Label>
                  <Input type="number" value={metricas.montoAprobado} onChange={(e) => setMetricas({ ...metricas, montoAprobado: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cuota actual (COP)</Label>
                  <Input type="number" value={metricas.cuotaActual} onChange={(e) => setMetricas({ ...metricas, cuotaActual: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Pagos realizados</Label>
                  <Input type="number" min="0" value={metricas.pagosRealizados} onChange={(e) => setMetricas({ ...metricas, pagosRealizados: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Saldo pendiente</Label>
                  <Input type="number" value={metricas.saldoPendiente} onChange={(e) => setMetricas({ ...metricas, saldoPendiente: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Progreso (%)</Label>
                  <Input type="number" min="0" max="100" value={metricas.progreso} onChange={(e) => setMetricas({ ...metricas, progreso: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ID solicitud vinculado (opcional)</Label>
                <Input
                  value={metricas.prestamoVinculadoId}
                  onChange={(e) => setMetricas({ ...metricas, prestamoVinculadoId: e.target.value })}
                  placeholder="cmr... (ID del solicitud en BD)"
                />
              </div>
              <div className="space-y-2">
                <Label>Notas de seguimiento</Label>
                <Textarea
                  value={metricas.notasSeguimiento}
                  onChange={(e) => setMetricas({ ...metricas, notasSeguimiento: e.target.value })}
                  placeholder="Observaciones, acuerdos con el cliente, próximos pasos..."
                  rows={3}
                />
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
