'use client'

// =====================================================
// ContabilidadUnificadaView — Contabilidad + Plan Financiero (Módulo 6)
// Incluye:
//   1. Movimientos financieros (gastos personales + ingresos + CRUD)
//   2. Resumen de flujo de caja (mes actual vs mes anterior)
//   3. Recomendaciones automáticas basadas en los datos
//   4. Proyectos futuros vinculados al plan financiero
//   5. Plan financiero completo (heredado de PlanFinancieroView)
//   6. Contabilidad bancaria (heredado de ContabilidadBancariaView)
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha, formatearFechaHora } from '@/lib/finanzas'
import {
  Plus,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Lightbulb,
  Target,
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Circle,
  Bell,
  FileBarChart,
  Tag,
  Clock,
  Activity,
  DollarSign,
} from 'lucide-react'
import { ContabilidadBancariaView } from '@/components/views/ContabilidadBancariaView'
import { PlanFinancieroView } from '@/components/views/PlanFinancieroView'

interface Movimiento {
  id: string
  tipo: string
  categoria: string
  descripcion: string
  monto: number
  fecha: string
  metodoPago: string | null
  responsable: string | null
  notas: string | null
  planFinancieroId: string | null
}

interface Resumen {
  totalIngresos: number
  totalGastos: number
  balance: number
  mesActual: { ingresos: number; gastos: number; balance: number }
  mesAnterior: { ingresos: number; gastos: number; balance: number }
}

interface Recomendacion {
  tipo: string
  titulo: string
  detalle: string
  severidad: 'INFO' | 'WARN' | 'ALERT'
}

interface ProyectoFuturo {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  tipo: string
  estado: string
  prioridad: string
  fechaInicio: string
  fechaFin: string
  presupuestoInversion: number
  metaIngresos: number
  progreso: number
}

interface EventoFinanciero {
  id: string
  titulo: string
  descripcion: string | null
  fecha: string
  tipo: string // PAGO | RECORDATORIO | REPORTE | OTRO
  completado: boolean
  monto: number | null
  categoria: string | null
  origen: string | null
  createdAt: string
}

interface ResumenCalendario {
  total: number
  pendientes: number
  completados: number
  eventosMes: number
  proximos: EventoFinanciero[]
}

const TIPOS_EVENTO = [
  { value: 'PAGO', label: 'Pago', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-500/15 border-emerald-400/30' },
  { value: 'RECORDATORIO', label: 'Recordatorio', icon: Bell, color: 'text-amber-600', bg: 'bg-amber-500/15 border-amber-400/30' },
  { value: 'REPORTE', label: 'Reporte', icon: FileBarChart, color: 'text-cyan-600', bg: 'bg-cyan-500/15 border-cyan-400/30' },
  { value: 'OTRO', label: 'Otro', icon: Tag, color: 'text-violet-600', bg: 'bg-violet-500/15 border-violet-400/30' },
] as const

function getTipoEvento(tipo: string) {
  return TIPOS_EVENTO.find((t) => t.value === tipo) || TIPOS_EVENTO[3]
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const CATEGORIAS_INGRESO = [
  'INTERES_PRESTAMOS',
  'VENTA',
  'COMISION',
  'HONORARIOS',
  'OTRO_INGRESO',
]
const CATEGORIAS_GASTO = [
  'SUELDOS',
  'ARRIENDO',
  'SERVICIOS',
  'PUBLICIDAD',
  'HONORARIOS_LEGALES',
  'SOFTWARE',
  'TRANSPORTE',
  'OTRO_GASTO',
]

const SEVERIDAD_STYLE: Record<string, string> = {
  INFO: 'bg-blue-50 border-blue-200 text-blue-900',
  WARN: 'bg-amber-50 border-amber-200 text-amber-900',
  ALERT: 'bg-red-50 border-red-200 text-red-900',
}

export function ContabilidadUnificadaView() {
  const [tab, setTab] = useState('movimientos')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [proyectosFuturos, setProyectosFuturos] = useState<ProyectoFuturo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<Movimiento | null>(null)
  const { toast } = useToast()

  // Calendario / Agenda
  const [eventos, setEventos] = useState<EventoFinanciero[]>([])
  const [resumenCal, setResumenCal] = useState<ResumenCalendario | null>(null)
  const [loadingCal, setLoadingCal] = useState(true)
  const [modalEvento, setModalEvento] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<EventoFinanciero | null>(null)
  const [mesVista, setMesVista] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const [formEvento, setFormEvento] = useState({
    titulo: '',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 16),
    tipo: 'PAGO',
    monto: '',
    categoria: '',
    origen: 'MANUAL',
  })

  const [form, setForm] = useState({
    tipo: 'INGRESO',
    categoria: 'INTERES_PRESTAMOS',
    descripcion: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    metodoPago: 'EFECTIVO',
    notas: '',
    planFinancieroId: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finanzas?resumen=true')
      const json = await res.json()
      if (json.success) {
        setMovimientos(json.data || [])
        setResumen(json.resumen || null)
        setRecomendaciones(json.recomendaciones || [])
        setProyectosFuturos(json.proyectosFuturos || [])
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const cargarCalendario = useCallback(async () => {
    setLoadingCal(true)
    try {
      const res = await fetch('/api/admin/finanzas/calendario')
      const json = await res.json()
      if (json.success) {
        setEventos(json.data || [])
        setResumenCal(json.resumen || null)
      }
    } catch (e: any) {
      toast({ title: 'Error calendario', description: e.message, variant: 'destructive' })
    } finally {
      setLoadingCal(false)
    }
  }, [toast])

  useEffect(() => {
    cargar()
    cargarCalendario()
  }, [cargar, cargarCalendario])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      tipo: 'INGRESO',
      categoria: 'INTERES_PRESTAMOS',
      descripcion: '',
      monto: '',
      fecha: new Date().toISOString().slice(0, 10),
      metodoPago: 'EFECTIVO',
      notas: '',
      planFinancieroId: '',
    })
    setModalNuevo(true)
  }

  const abrirEditar = (m: Movimiento) => {
    setEditando(m)
    setForm({
      tipo: m.tipo,
      categoria: m.categoria,
      descripcion: m.descripcion,
      monto: String(m.monto),
      fecha: new Date(m.fecha).toISOString().slice(0, 10),
      metodoPago: m.metodoPago || 'EFECTIVO',
      notas: m.notas || '',
      planFinancieroId: m.planFinancieroId || '',
    })
    setModalNuevo(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editando ? 'PATCH' : 'POST'
      const body: any = { ...form }
      if (editando) body.id = editando.id
      const res = await fetch('/api/admin/finanzas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: editando ? 'Movimiento actualizado' : 'Movimiento creado' })
        setModalNuevo(false)
        cargar()
        // Actualizar el calendario también (control de gastos en tiempo real)
        cargarCalendario()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (m: Movimiento) => {
    if (!confirm(`¿Eliminar el movimiento "${m.descripcion}"?`)) return
    try {
      const res = await fetch(`/api/admin/finanzas?id=${m.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Movimiento eliminado' })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Cuando cambia el tipo, ajustar la categoría disponible
  useEffect(() => {
    if (form.tipo === 'INGRESO' && !CATEGORIAS_INGRESO.includes(form.categoria)) {
      setForm((f) => ({ ...f, categoria: CATEGORIAS_INGRESO[0] }))
    } else if (form.tipo === 'GASTO' && !CATEGORIAS_GASTO.includes(form.categoria)) {
      setForm((f) => ({ ...f, categoria: CATEGORIAS_GASTO[0] }))
    }
  }, [form.tipo])

  // === Funciones del Calendario ===
  const abrirNuevoEvento = (fechaPre?: string) => {
    setEventoEditando(null)
    const ahora = new Date()
    // fecha local sin timezone shift
    const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setFormEvento({
      titulo: '',
      descripcion: '',
      fecha: fechaPre ? fechaPre.slice(0, 16) : local,
      tipo: 'PAGO',
      monto: '',
      categoria: '',
      origen: 'MANUAL',
    })
    setModalEvento(true)
  }

  const abrirEditarEvento = (ev: EventoFinanciero) => {
    setEventoEditando(ev)
    const d = new Date(ev.fecha)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setFormEvento({
      titulo: ev.titulo,
      descripcion: ev.descripcion || '',
      fecha: local,
      tipo: ev.tipo,
      monto: ev.monto !== null ? String(ev.monto) : '',
      categoria: ev.categoria || '',
      origen: ev.origen || 'MANUAL',
    })
    setModalEvento(true)
  }

  const guardarEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = eventoEditando ? 'PATCH' : 'POST'
      const body: any = {
        titulo: formEvento.titulo,
        descripcion: formEvento.descripcion || undefined,
        fecha: formEvento.fecha,
        tipo: formEvento.tipo,
        categoria: formEvento.categoria || undefined,
        origen: formEvento.origen,
      }
      if (formEvento.monto) body.monto = formEvento.monto
      if (eventoEditando) body.id = eventoEditando.id

      const res = await fetch('/api/admin/finanzas/calendario', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: eventoEditando ? 'Evento actualizado' : 'Evento creado',
          description: formEvento.titulo,
        })
        setModalEvento(false)
        cargarCalendario()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const toggleCompletado = async (ev: EventoFinanciero) => {
    try {
      const res = await fetch('/api/admin/finanzas/calendario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ev.id, completado: !ev.completado }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: !ev.completado ? 'Evento completado' : 'Evento reabierto',
          description: ev.titulo,
        })
        cargarCalendario()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminarEvento = async (ev: EventoFinanciero) => {
    if (!confirm(`¿Eliminar el evento "${ev.titulo}"?`)) return
    try {
      const res = await fetch(`/api/admin/finanzas/calendario?id=${ev.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Evento eliminado' })
        cargarCalendario()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Helper: agrupar eventos por día del mes en vista
  const eventosDelMes = () => {
    const y = mesVista.getFullYear()
    const m = mesVista.getMonth()
    return eventos.filter((ev) => {
      const d = new Date(ev.fecha)
      return d.getFullYear() === y && d.getMonth() === m
    })
  }

  // Construir matriz del mes (con días en blanco al inicio)
  const construirMatrizMes = () => {
    const y = mesVista.getFullYear()
    const m = mesVista.getMonth()
    const primerDia = new Date(y, m, 1)
    const ultimoDia = new Date(y, m + 1, 0)
    const diaSemanaInicio = primerDia.getDay()
    const totalDias = ultimoDia.getDate()
    const celdas: (number | null)[] = []
    for (let i = 0; i < diaSemanaInicio; i++) celdas.push(null)
    for (let d = 1; d <= totalDias; d++) celdas.push(d)
    while (celdas.length % 7 !== 0) celdas.push(null)
    return celdas
  }

  const eventosPorDia = (dia: number) => {
    const y = mesVista.getFullYear()
    const m = mesVista.getMonth()
    return eventosDelMes().filter((ev) => {
      const d = new Date(ev.fecha)
      return d.getDate() === dia
    })
  }

  const cambiarMes = (delta: number) => {
    const nueva = new Date(mesVista)
    nueva.setMonth(nueva.getMonth() + delta)
    setMesVista(nueva)
  }

  const irHoy = () => {
    const n = new Date()
    setMesVista(new Date(n.getFullYear(), n.getMonth(), 1))
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="flujo">Flujo de Caja</TabsTrigger>
          <TabsTrigger value="recomendaciones">Recomendaciones</TabsTrigger>
          <TabsTrigger value="calendario">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="proyectos">Proyectos Futuros</TabsTrigger>
          <TabsTrigger value="plan-financiero">Plan Financiero</TabsTrigger>
        </TabsList>

        {/* === MOVIMIENTOS === */}
        {/* === DASHBOARD FINANCIERO === */}
        <TabsContent value="dashboard" className="space-y-4">
          <DashboardFinanciero />
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Movimientos Financieros</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cargar}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Recargar
              </Button>
              <Button size="sm" onClick={abrirNuevo}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nuevo Movimiento
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : movimientos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay movimientos. Crea el primero con el botón "Nuevo Movimiento".
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimientos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{formatearFecha(m.fecha)}</TableCell>
                        <TableCell>
                          {m.tipo === 'INGRESO' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Ingreso
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/15 text-red-700 border-red-300">
                              <ArrowDownRight className="w-3 h-3 mr-1" />
                              Gasto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{m.categoria}</TableCell>
                        <TableCell className="text-sm">{m.descripcion}</TableCell>
                        <TableCell className="text-xs">{m.metodoPago || '—'}</TableCell>
                        <TableCell className="text-xs">{m.responsable || '—'}</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            m.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {m.tipo === 'INGRESO' ? '+' : '-'} {formatearMoneda(m.monto)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => abrirEditar(m)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-700 hover:bg-red-50"
                              onClick={() => eliminar(m)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === FLUJO DE CAJA === */}
        <TabsContent value="flujo" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {resumen ? formatearMoneda(resumen.totalIngresos) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Ingresos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center text-red-600">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">
                    {resumen ? formatearMoneda(resumen.totalGastos) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Gastos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold ${
                      resumen && resumen.balance >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {resumen ? formatearMoneda(resumen.balance) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance Neto</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativo Mensual</CardTitle>
              <CardDescription>
                Compara los ingresos y gastos del mes actual frente al mes anterior
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resumen ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periodo</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Mes Actual</TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {formatearMoneda(resumen.mesActual.ingresos)}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatearMoneda(resumen.mesActual.gastos)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          resumen.mesActual.balance >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatearMoneda(resumen.mesActual.balance)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Mes Anterior</TableCell>
                      <TableCell className="text-right text-emerald-700">
                        {formatearMoneda(resumen.mesAnterior.ingresos)}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {formatearMoneda(resumen.mesAnterior.gastos)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          resumen.mesAnterior.balance >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatearMoneda(resumen.mesAnterior.balance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="py-6 text-center text-muted-foreground">Cargando resumen...</div>
              )}
            </CardContent>
          </Card>

          {/* Contabilidad bancaria (existente) */}
          <ContabilidadBancariaView />
        </TabsContent>

        {/* === RECOMENDACIONES === */}
        <TabsContent value="recomendaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Recomendaciones Automáticas
              </CardTitle>
              <CardDescription>
                Sugerencias basadas en el análisis de tus movimientos financieros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recomendaciones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay recomendaciones disponibles. Registra movimientos para generar análisis.
                </div>
              ) : (
                recomendaciones.map((r, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${SEVERIDAD_STYLE[r.severidad] || SEVERIDAD_STYLE.INFO}`}
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{r.titulo}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${r.severidad === 'ALERT' ? 'bg-red-100 text-red-800' : r.severidad === 'WARN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}
                          >
                            {r.severidad}
                          </Badge>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{r.detalle}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CALENDARIO / AGENDA === */}
        <TabsContent value="calendario" className="space-y-4">
          {/* KPIs del calendario */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-white">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{resumenCal?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total eventos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{resumenCal?.pendientes ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{resumenCal?.completados ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Completados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-600">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{resumenCal?.eventosMes ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Este mes</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vista de calendario mensual */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    Calendario / Agenda Financiera
                  </CardTitle>
                  <CardDescription>
                    Se actualiza con cada orden, compra, cuota, saldo y gasto en tiempo real
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => cambiarMes(-1)}>
                    ← Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={irHoy}>
                    Hoy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => cambiarMes(1)}>
                    Siguiente →
                  </Button>
                  <Button variant="outline" size="sm" onClick={cargarCalendario}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Recargar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => abrirNuevoEvento()}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Nuevo Evento
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold">
                {MESES[mesVista.getMonth()]} {mesVista.getFullYear()}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCal ? (
                <div className="text-center py-10 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                  Cargando calendario...
                </div>
              ) : (
                <>
                  {/* Encabezado días */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DIAS_SEMANA.map((d) => (
                      <div
                        key={d}
                        className="text-center text-[11px] font-semibold text-muted-foreground py-1"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Celdas del mes */}
                  <div className="grid grid-cols-7 gap-1">
                    {construirMatrizMes().map((dia, i) => {
                      if (dia === null) {
                        return <div key={i} className="min-h-[88px] rounded bg-muted/20" />
                      }
                      const evs = eventosPorDia(dia)
                      const esHoy =
                        dia === new Date().getDate() &&
                        mesVista.getMonth() === new Date().getMonth() &&
                        mesVista.getFullYear() === new Date().getFullYear()
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            abrirNuevoEvento(
              `${mesVista.getFullYear()}-${String(mesVista.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}T08:00`
                            )
                          }
                          className={`min-h-[88px] rounded border p-1 text-left flex flex-col gap-0.5 transition-colors ${
                            esHoy
                              ? 'border-primary bg-primary/5'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                          }`}
                          title="Haz clic para crear un evento en este día"
                        >
                          <div
                            className={`text-[11px] font-semibold ${
                              esHoy ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          >
                            {dia}
                          </div>
                          <div className="flex-1 space-y-0.5 overflow-hidden">
                            {evs.slice(0, 3).map((ev) => {
                              const cfg = getTipoEvento(ev.tipo)
                              const Icon = cfg.icon
                              return (
                                <div
                                  key={ev.id}
                                  className={`text-[9px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 border ${cfg.bg} ${
                                    ev.completado ? 'line-through opacity-60' : ''
                                  }`}
                                  title={ev.titulo}
                                >
                                  <Icon className={`w-2.5 h-2.5 shrink-0 ${cfg.color}`} />
                                  <span className="truncate">{ev.titulo}</span>
                                </div>
                              )
                            })}
                            {evs.length > 3 && (
                              <div className="text-[9px] text-muted-foreground px-1">
                                +{evs.length - 3} más
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Lista de próximos eventos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                Próximos Eventos
              </CardTitle>
              <CardDescription>
                Los 5 eventos más cercanos pendientes de completar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resumenCal?.proximos && resumenCal.proximos.length > 0 ? (
                <div className="space-y-2">
                  {resumenCal.proximos.map((ev) => {
                    const cfg = getTipoEvento(ev.tipo)
                    const Icon = cfg.icon
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03]"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center border ${cfg.bg}`}
                        >
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{ev.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatearFechaHora(ev.fecha)}
                            {ev.monto !== null ? ` · ${formatearMoneda(ev.monto)}` : ''}
                            {ev.categoria ? ` · ${ev.categoria}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleCompletado(ev)}
                          title="Marcar como completado"
                        >
                          <Circle className="w-4 h-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No hay eventos próximos. Crea uno con el botón "Nuevo Evento".
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista completa de eventos (gestionable) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todos los Eventos del Mes</CardTitle>
              <CardDescription>
                Gestiona, completa o elimina los eventos programados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCal ? (
                <div className="text-center py-6 text-muted-foreground">
                  Cargando eventos...
                </div>
              ) : eventosDelMes().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay eventos en {MESES[mesVista.getMonth()]}. Crea el primero con el botón "Nuevo Evento".
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {eventosDelMes()
                    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                    .map((ev) => {
                      const cfg = getTipoEvento(ev.tipo)
                      const Icon = cfg.icon
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            ev.completado
                              ? 'border-emerald-400/30 bg-emerald-500/[0.05] opacity-80'
                              : 'border-white/10 bg-white/[0.03]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCompletado(ev)}
                            className="shrink-0"
                            title={ev.completado ? 'Reabrir' : 'Marcar completado'}
                          >
                            {ev.completado ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
              <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                            )}
                          </button>
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center border ${cfg.bg} shrink-0`}
                          >
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={`text-sm font-semibold truncate ${
                                  ev.completado ? 'line-through' : ''
                                }`}
                              >
                                {ev.titulo}
                              </p>
                              <Badge variant="outline" className="text-[10px]">
                                {cfg.label}
                              </Badge>
                              {ev.categoria && (
                                <Badge variant="outline" className="text-[10px]">
                                  {ev.categoria}
                                </Badge>
                              )}
                              {ev.origen && ev.origen !== 'MANUAL' && (
                                <Badge variant="outline" className="text-[10px]">
                                  {ev.origen}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatearFechaHora(ev.fecha)}
                              {ev.monto !== null ? ` · ${formatearMoneda(ev.monto)}` : ''}
                              {ev.descripcion ? ` · ${ev.descripcion}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirEditarEvento(ev)}
                              title="Editar evento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-700 hover:bg-red-50"
                              onClick={() => eliminarEvento(ev)}
                              title="Eliminar evento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PROYECTOS FUTUROS === */}
        <TabsContent value="proyectos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Proyectos Futuros Vinculados al Plan Financiero
              </CardTitle>
              <CardDescription>
                Planes estratégicos con fecha de inicio posterior a hoy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proyectosFuturos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay proyectos futuros. Créalos desde la pestaña "Plan Financiero".
                </div>
              ) : (
                proyectosFuturos.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-lg border border-white/10 bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{p.nombre}</p>
                          <Badge variant="outline" className="text-[10px]">{p.tipo}</Badge>
                          <Badge variant="outline" className="text-[10px]">{p.estado}</Badge>
                          <Badge variant="outline" className="text-[10px]">{p.prioridad}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.descripcion || 'Sin descripción'}
                        </p>
                        <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                          <div>
                            <strong>Código:</strong> {p.codigo}
                          </div>
                          <div>
                            <strong>Inicio:</strong> {formatearFecha(p.fechaInicio)} · <strong>Fin:</strong>{' '}
                            {formatearFecha(p.fechaFin)}
                          </div>
                          <div>
                            <strong>Presupuesto:</strong> {formatearMoneda(p.presupuestoInversion)} ·{' '}
                            <strong>Meta ingresos:</strong> {formatearMoneda(p.metaIngresos)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Progreso</p>
                        <p className="text-2xl font-bold">{p.progreso}%</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PLAN FINANCIERO COMPLETO === */}
        <TabsContent value="plan-financiero">
          <PlanFinancieroView />
        </TabsContent>
      </Tabs>

      {/* === MODAL NUEVO/EDITAR MOVIMIENTO === */}
      <Dialog open={modalNuevo} onOpenChange={setModalNuevo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Movimiento' : 'Nuevo Movimiento Financiero'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INGRESO">Ingreso</SelectItem>
                    <SelectItem value="GASTO">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría *</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.tipo === 'INGRESO' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción *</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                required
                placeholder="Ej: Pago de arriendo oficina"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto (COP) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select
                value={form.metodoPago}
                onValueChange={(v) => setForm({ ...form, metodoPago: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="TARJETA">Tarjeta</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalNuevo(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editando ? 'Guardar cambios' : 'Crear movimiento'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === MODAL NUEVO/EDITAR EVENTO DE CALENDARIO === */}
      <Dialog open={modalEvento} onOpenChange={setModalEvento}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {eventoEditando ? 'Editar Evento' : 'Nuevo Evento de Calendario'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={guardarEvento} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={formEvento.titulo}
                onChange={(e) => setFormEvento({ ...formEvento, titulo: e.target.value })}
                required
                placeholder="Ej: Pago cuota cliente Juan Pérez"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={formEvento.tipo}
                  onValueChange={(v) => setFormEvento({ ...formEvento, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_EVENTO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha y hora *</Label>
                <Input
                  type="datetime-local"
                  value={formEvento.fecha}
                  onChange={(e) => setFormEvento({ ...formEvento, fecha: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto (COP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formEvento.monto}
                  onChange={(e) => setFormEvento({ ...formEvento, monto: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Input
                  value={formEvento.categoria}
                  onChange={(e) => setFormEvento({ ...formEvento, categoria: e.target.value })}
                  placeholder="Ej: CUOTA, COMPRA, SALDO"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={formEvento.descripcion}
                onChange={(e) => setFormEvento({ ...formEvento, descripcion: e.target.value })}
                rows={2}
                placeholder="Detalles del evento..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalEvento(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {eventoEditando ? 'Guardar cambios' : 'Crear evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// DashboardFinanciero — Dashboard de control financiero
// Muestra KPIs, gastos por categoría, ingresos vs gastos,
// separación negocio vs personal, proyecciones y más.
// =====================================================
function DashboardFinanciero() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ambito, setAmbito] = useState<'TODOS' | 'NEGOCIO' | 'PERSONAL'>('TODOS')
  const { toast } = useToast()

  const cargar = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ dashboard: 'true' })
      if (ambito !== 'TODOS') params.set('ambito', ambito)
      const res = await fetch(`/api/admin/finanzas?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [ambito])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          Cargando dashboard financiero...
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const fmtPct = (v: number) => `${v.toFixed(1)}%`

  return (
    <div className="space-y-4">
      {/* === Filtro de ámbito === */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Dashboard Financiero</h3>
          <p className="text-xs text-muted-foreground">Control total de ingresos y gastos para toma de decisiones</p>
        </div>
        <div className="flex gap-1">
          {(['TODOS', 'NEGOCIO', 'PERSONAL'] as const).map((a) => (
            <Button
              key={a}
              size="sm"
              variant={ambito === a ? 'default' : 'outline'}
              onClick={() => setAmbito(a)}
              className="text-xs"
            >
              {a === 'TODOS' ? '📊 Todo' : a === 'NEGOCIO' ? '🏢 Negocio' : '👤 Personal'}
            </Button>
          ))}
        </div>
      </div>

      {/* === KPIs principales === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Ingresos mes</p>
                <p className="text-xl font-bold text-emerald-400">{formatearMoneda(data.kpis.ingresosMes)}</p>
                {data.kpis.variacionIngresos !== 0 && (
                  <p className={`text-[10px] ${data.kpis.variacionIngresos >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.kpis.variacionIngresos >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(data.kpis.variacionIngresos))} vs mes anterior
                  </p>
                )}
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Gastos mes</p>
                <p className="text-xl font-bold text-red-400">{formatearMoneda(data.kpis.gastosMes)}</p>
                {data.kpis.variacionGastos !== 0 && (
                  <p className={`text-[10px] ${data.kpis.variacionGastos <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.kpis.variacionGastos >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(data.kpis.variacionGastos))} vs mes anterior
                  </p>
                )}
              </div>
              <TrendingDown className="w-6 h-6 text-red-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className={data.kpis.balanceMes >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Balance mes</p>
                <p className={`text-xl font-bold ${data.kpis.balanceMes >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                  {formatearMoneda(data.kpis.balanceMes)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {data.kpis.balanceMes >= 0 ? '✅ Positivo' : '⚠️ Negativo'}
                </p>
              </div>
              <DollarSign className="w-6 h-6 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-violet-500/5 border-violet-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Proyección fin de mes</p>
                <p className={`text-xl font-bold ${data.proyecciones.proyeccionBalance >= 0 ? 'text-violet-400' : 'text-amber-400'}`}>
                  {formatearMoneda(data.proyecciones.proyeccionBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Promedio diario: {formatearMoneda(data.proyecciones.promedioIngresoDiario - data.proyecciones.promedioGastoDiario)}
                </p>
              </div>
              <Activity className="w-6 h-6 text-violet-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === Separación Negocio vs Personal === */}
      {ambito === 'TODOS' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🏢 Negocio vs 👤 Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Negocio */}
              <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs font-semibold text-blue-400">🏢 NEGOCIO</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingresos:</span>
                    <strong className="text-emerald-400">{formatearMoneda(data.separacion.ingresosNegocio)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gastos:</span>
                    <strong className="text-red-400">{formatearMoneda(data.separacion.gastosNegocio)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-500/20">
                    <span className="font-semibold">Balance:</span>
                    <strong className={data.separacion.balanceNegocio >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {formatearMoneda(data.separacion.balanceNegocio)}
                    </strong>
                  </div>
                </div>
              </div>
              {/* Personal */}
              <div className="space-y-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-xs font-semibold text-purple-400">👤 PERSONAL</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingresos:</span>
                    <strong className="text-emerald-400">{formatearMoneda(data.separacion.ingresosPersonal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gastos:</span>
                    <strong className="text-red-400">{formatearMoneda(data.separacion.gastosPersonal)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-purple-500/20">
                    <span className="font-semibold">Balance:</span>
                    <strong className={data.separacion.balancePersonal >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {formatearMoneda(data.separacion.balancePersonal)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Gastos por categoría === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Gastos por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.gastosPorCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin gastos este mes</p>
            ) : (
              data.gastosPorCategoria.map((g: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{g.categoria}</span>
                    <span>{formatearMoneda(g.monto)} ({fmtPct(g.porcentaje)})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                      style={{ width: `${Math.min(100, g.porcentaje)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* === Ingresos por categoría === */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Ingresos por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ingresosPorCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin ingresos este mes</p>
            ) : (
              data.ingresosPorCategoria.map((ing: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{ing.categoria}</span>
                    <span>{formatearMoneda(ing.monto)} ({fmtPct(ing.porcentaje)})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                      style={{ width: `${Math.min(100, ing.porcentaje)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Proyecciones y promedios === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            Proyecciones y promedios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground">Días transcurridos</p>
              <p className="text-lg font-bold">{data.proyecciones.diasTranscurridos} / {data.proyecciones.diasEnMes}</p>
            </div>
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground">Promedio ingreso/día</p>
              <p className="text-lg font-bold text-emerald-400">{formatearMoneda(data.proyecciones.promedioIngresoDiario)}</p>
            </div>
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground">Promedio gasto/día</p>
              <p className="text-lg font-bold text-red-400">{formatearMoneda(data.proyecciones.promedioGastoDiario)}</p>
            </div>
            <div className="p-2 rounded bg-muted/30">
              <p className="text-muted-foreground">Proyección ingresos</p>
              <p className="text-lg font-bold text-violet-400">{formatearMoneda(data.proyecciones.proyeccionIngresos)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Totales históricos === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Totales históricos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total ingresos</p>
              <p className="text-lg font-bold text-emerald-400">{formatearMoneda(data.totalesHistoricos.totalIngresos)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total gastos</p>
              <p className="text-lg font-bold text-red-400">{formatearMoneda(data.totalesHistoricos.totalGastos)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Balance total</p>
              <p className={`text-lg font-bold ${data.totalesHistoricos.balanceTotal >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                {formatearMoneda(data.totalesHistoricos.balanceTotal)}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {data.totalesHistoricos.numMovimientos} movimientos registrados
          </p>
        </CardContent>
      </Card>

      {/* === Últimos movimientos === */}
      {data.ultimosMovimientos && data.ultimosMovimientos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Últimos 10 movimientos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ultimosMovimientos.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatearFechaHora(m.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.tipo === 'INGRESO' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}>
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.descripcion}</TableCell>
                    <TableCell className="text-xs">{m.categoria}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.ambito === 'NEGOCIO' ? 'text-blue-400 border-blue-500/30 text-[10px]' : 'text-purple-400 border-purple-500/30 text-[10px]'}>
                        {m.ambito}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${m.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatearMoneda(m.monto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
