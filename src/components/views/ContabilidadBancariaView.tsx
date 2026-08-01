'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  Calculator,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Banknote,
  TrendingUp,
  Wallet,
  PiggyBank,
  Calendar,
  Percent,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'

// =====================================================
// Tipos
// =====================================================
type TipoCredito = 'PRESTAMO' | 'TARJETA_CREDITO'

interface PrestamoBancario {
  id: string
  nombre: string
  banco: string
  tipo: string
  montoPrincipal: number
  tasaAnual: number
  plazoMeses: number
  seguroMensual: number
  fechaDesembolso: string
  estado: string
  descripcion: string | null
  cupoTotal: number
  saldoUtilizado: number
  cupoDisponible: number
  diaCorte: number
  diaPago: number
  pagoMinimo: number
  pagoTotalSin: number
  fechaCorteActual: string | null
  fechaPagoProximo: string | null
  createdAt: string
  updatedAt: string
}

interface CuotaAmortizacion {
  numero: number
  fechaVencimiento: Date
  montoCuota: number
  capital: number
  interes: number
  saldoCapital: number
  acumuladoInteres: number
  acumuladoCapital: number
}

// =====================================================
// Bancos predefinidos
// =====================================================
const BANCOS = [
  'Bancolombia',
  'Banco de Bogotá',
  'Davivienda',
  'BBVA Colombia',
  'Banco Davivienda',
  'Banco AV Villas',
  'Banco de Occidente',
  'Scotiabank Colpatria',
  'Banco GNB Sudameris',
  'Banco Falabella',
  'Itaú Colombia',
  'Nequi',
  'Daviplata',
  'Otro',
]

// =====================================================
// Componente principal
// =====================================================
export function ContabilidadBancariaView() {
  const [tab, setTab] = useState<TipoCredito>('PRESTAMO')
  const [creditos, setCreditos] = useState<PrestamoBancario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalForm, setModalForm] = useState(false)
  const [editando, setEditando] = useState<PrestamoBancario | null>(null)
  const [seleccionado, setSeleccionado] = useState<PrestamoBancario | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PrestamoBancario | null>(null)
  const { toast } = useToast()

  // Form para crear/editar
  const [form, setForm] = useState({
    nombre: '',
    banco: '',
    montoPrincipal: '',
    tasaAnual: '',
    plazoMeses: '',
    seguroMensual: '',
    fechaDesembolso: new Date().toISOString().split('T')[0],
    descripcion: '',
    // Tarjeta de crédito
    cupoTotal: '',
    saldoUtilizado: '',
    diaCorte: '1',
    diaPago: '15',
    pagoMinimo: '',
    pagoTotalSin: '',
    fechaCorteActual: '',
    fechaPagoProximo: '',
  })

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/creditos-bancarios')
      const json = await res.json()
      if (json.success) setCreditos(json.data)
    } catch (e: any) {
      toast({ title: 'Error al cargar', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const prestamos = creditos.filter((c) => c.tipo === 'PRESTAMO')
  const tarjetas = creditos.filter((c) => c.tipo === 'TARJETA_CREDITO')

  // Stats
  const stats = useMemo(() => {
    const prestamosActivos = prestamos.filter((p) => p.estado === 'ACTIVO')
    const tarjetasActivas = tarjetas.filter((t) => t.estado === 'ACTIVO')
    const totalPrincipalPrestamos = prestamosActivos.reduce((s, p) => s + p.montoPrincipal, 0)
    const totalUtilizadoTC = tarjetasActivas.reduce((s, t) => s + t.saldoUtilizado, 0)
    const interesesPagar = prestamosActivos.reduce((s, p) => {
      const tasa = p.tasaAnual / 100
      return s + p.montoPrincipal * tasa
    }, 0)
    const cupoDisponibleTC = tarjetasActivas.reduce((s, t) => s + t.cupoDisponible, 0)
    return {
      prestamosActivos: prestamosActivos.length,
      totalPrincipalPrestamos,
      tarjetasActivas: tarjetasActivas.length,
      totalUtilizadoTC,
      interesesPagar,
      cupoDisponibleTC,
    }
  }, [prestamos, tarjetas])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({
      nombre: '',
      banco: '',
      montoPrincipal: '',
      tasaAnual: '',
      plazoMeses: '',
      seguroMensual: '',
      fechaDesembolso: new Date().toISOString().split('T')[0],
      descripcion: '',
      cupoTotal: '',
      saldoUtilizado: '',
      diaCorte: '1',
      diaPago: '15',
      pagoMinimo: '',
      pagoTotalSin: '',
      fechaCorteActual: '',
      fechaPagoProximo: '',
    })
    setModalForm(true)
  }

  const abrirEditar = (c: PrestamoBancario) => {
    setEditando(c)
    setForm({
      nombre: c.nombre,
      banco: c.banco,
      montoPrincipal: c.montoPrincipal.toString(),
      tasaAnual: c.tasaAnual.toString(),
      plazoMeses: c.plazoMeses.toString(),
      seguroMensual: c.seguroMensual.toString(),
      fechaDesembolso: c.fechaDesembolso ? new Date(c.fechaDesembolso).toISOString().split('T')[0] : '',
      descripcion: c.descripcion || '',
      cupoTotal: c.cupoTotal.toString(),
      saldoUtilizado: c.saldoUtilizado.toString(),
      diaCorte: c.diaCorte.toString(),
      diaPago: c.diaPago.toString(),
      pagoMinimo: c.pagoMinimo.toString(),
      pagoTotalSin: c.pagoTotalSin.toString(),
      fechaCorteActual: c.fechaCorteActual ? new Date(c.fechaCorteActual).toISOString().split('T')[0] : '',
      fechaPagoProximo: c.fechaPagoProximo ? new Date(c.fechaPagoProximo).toISOString().split('T')[0] : '',
    })
    setModalForm(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editando ? 'PATCH' : 'POST'
      const body: any = {
        nombre: form.nombre,
        banco: form.banco,
        tipo: tab,
        descripcion: form.descripcion || null,
      }

      if (tab === 'PRESTAMO') {
        body.montoPrincipal = form.montoPrincipal
        body.tasaAnual = form.tasaAnual
        body.plazoMeses = form.plazoMeses || 0
        body.seguroMensual = form.seguroMensual || 0
        body.fechaDesembolso = form.fechaDesembolso
      } else {
        body.cupoTotal = form.cupoTotal
        body.saldoUtilizado = form.saldoUtilizado || 0
        body.tasaAnual = form.tasaAnual || 0
        body.diaCorte = form.diaCorte || 1
        body.diaPago = form.diaPago || 15
        body.pagoMinimo = form.pagoMinimo || 0
        body.pagoTotalSin = form.pagoTotalSin || 0
        body.fechaCorteActual = form.fechaCorteActual || null
        body.fechaPagoProximo = form.fechaPagoProximo || null
      }

      if (editando) body.id = editando.id

      const res = await fetch('/api/creditos-bancarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: editando ? 'Crédito actualizado' : 'Crédito creado',
          description: `${tab === 'PRESTAMO' ? 'Préstamo' : 'Tarjeta'} "${form.nombre}" guardado correctamente.`,
        })
        setModalForm(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const confirmarEliminar = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/creditos-bancarios?id=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Crédito eliminado', description: `"${deleteTarget.nombre}" fue eliminado.` })
        if (seleccionado?.id === deleteTarget.id) setSeleccionado(null)
        setDeleteTarget(null)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Actualizar saldo de tarjeta rápidamente
  const actualizarSaldoTarjeta = async (t: PrestamoBancario, nuevoSaldo: number) => {
    try {
      const res = await fetch('/api/creditos-bancarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, saldoUtilizado: nuevoSaldo }),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: 'Saldo actualizado',
          description: `${t.nombre}: ${formatearMoneda(nuevoSaldo)}`,
        })
        cargar()
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contabilidad Bancaria"
        subtitle="Gestiona préstamos bancarios y tarjetas de crédito"
        icon={<Calculator className="w-5 h-5" />}
      />

      {/* Stats principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Banknote className="w-5 h-5" />}
          label="Préstamos Activos"
          value={stats.prestamosActivos.toString()}
          subtitle={formatearMoneda(stats.totalPrincipalPrestamos)}
          gradient="from-violet-500/20 to-indigo-500/10"
          iconColor="text-violet-300"
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5" />}
          label="Tarjetas Activas"
          value={stats.tarjetasActivas.toString()}
          subtitle={`Utilizado: ${formatearMoneda(stats.totalUtilizadoTC)}`}
          gradient="from-cyan-500/20 to-blue-500/10"
          iconColor="text-cyan-300"
        />
        <StatCard
          icon={<Percent className="w-5 h-5" />}
          label="Intereses a Pagar"
          value={formatearMoneda(stats.interesesPagar)}
          subtitle="Anual estimado"
          gradient="from-amber-500/20 to-orange-500/10"
          iconColor="text-amber-300"
        />
        <StatCard
          icon={<PiggyBank className="w-5 h-5" />}
          label="Cupo Disponible TC"
          value={formatearMoneda(stats.cupoDisponibleTC)}
          subtitle="Total disponible"
          gradient="from-emerald-500/20 to-green-500/10"
          iconColor="text-emerald-300"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TipoCredito); setSeleccionado(null) }}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="PRESTAMO">
            <Banknote className="w-4 h-4 mr-1.5" />
            Préstamos
          </TabsTrigger>
          <TabsTrigger value="TARJETA_CREDITO">
            <CreditCard className="w-4 h-4 mr-1.5" />
            Tarjetas de Crédito
          </TabsTrigger>
        </TabsList>

        {/* ============================ PESTAÑA PRÉSTAMOS ============================ */}
        <TabsContent value="PRESTAMO" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  Préstamos Bancarios
                </CardTitle>
                <Button size="sm" onClick={abrirNuevo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Préstamo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Desembolso</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="text-center">Plazo</TableHead>
                    <TableHead className="text-right">Seguro</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Cargando préstamos...
                      </TableCell>
                    </TableRow>
                  ) : prestamos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No hay préstamos bancarios registrados. Crea el primero con el botón "Nuevo Préstamo".
                      </TableCell>
                    </TableRow>
                  ) : (
                    prestamos.map((p) => (
                      <TableRow
                        key={p.id}
                        className={`cursor-pointer hover:bg-white/5 ${seleccionado?.id === p.id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSeleccionado(seleccionado?.id === p.id ? null : p)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {seleccionado?.id === p.id ? (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            {p.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.banco}</TableCell>
                        <TableCell className="text-xs">{formatearFecha(p.fechaDesembolso)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatearMoneda(p.montoPrincipal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{p.tasaAnual}%</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{p.plazoMeses}m</TableCell>
                        <TableCell className="text-right text-xs">{formatearMoneda(p.seguroMensual)}</TableCell>
                        <TableCell>
                          <Badge variant={p.estado === 'ACTIVO' ? 'default' : 'secondary'}>
                            {p.estado}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirEditar(p)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
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

          {/* Tabla de amortización del préstamo seleccionado */}
          {seleccionado && seleccionado.tipo === 'PRESTAMO' && (
            <AmortizacionTable prestamo={seleccionado} />
          )}
        </TabsContent>

        {/* ============================ PESTAÑA TARJETAS ============================ */}
        <TabsContent value="TARJETA_CREDITO" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Tarjetas de Crédito
                </CardTitle>
                <Button size="sm" onClick={abrirNuevo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Tarjeta
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarjeta</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Cupo Total</TableHead>
                    <TableHead className="text-right">Utilizado</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-center">Corte / Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Cargando tarjetas...
                      </TableCell>
                    </TableRow>
                  ) : tarjetas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay tarjetas de crédito registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tarjetas.map((t) => (
                      <TableRow
                        key={t.id}
                        className={`cursor-pointer hover:bg-white/5 ${seleccionado?.id === t.id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSeleccionado(seleccionado?.id === t.id ? null : t)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {seleccionado?.id === t.id ? (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            {t.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{t.banco}</TableCell>
                        <TableCell className="text-right">{formatearMoneda(t.cupoTotal)}</TableCell>
                        <TableCell className="text-right font-semibold text-amber-300">
                          {formatearMoneda(t.saldoUtilizado)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-300">
                          {formatearMoneda(t.cupoDisponible)}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <Badge variant="outline">D{t.diaCorte}/D{t.diaPago}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.estado === 'ACTIVO' ? 'default' : 'secondary'}>
                            {t.estado}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => abrirEditar(t)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(t)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
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

          {/* Detalle de tarjeta seleccionada */}
          {seleccionado && seleccionado.tipo === 'TARJETA_CREDITO' && (
            <TarjetaDetalle tarjeta={seleccionado} onActualizarSaldo={actualizarSaldoTarjeta} />
          )}
        </TabsContent>
      </Tabs>

      {/* ============================ MODAL FORMULARIO ============================ */}
      <Dialog open={modalForm} onOpenChange={setModalForm}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tab === 'PRESTAMO' ? (
                <Banknote className="w-5 h-5 text-primary" />
              ) : (
                <CreditCard className="w-5 h-5 text-primary" />
              )}
              {editando
                ? `Editar ${tab === 'PRESTAMO' ? 'Préstamo' : 'Tarjeta'}`
                : `Nuevo ${tab === 'PRESTAMO' ? 'Préstamo Bancario' : 'Tarjeta de Crédito'}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            {/* Campos comunes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Nombre / Identificador *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder={tab === 'PRESTAMO' ? 'Ej: Préstamo Libre Inversión' : 'Ej: Visa Gold'}
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Banco *</Label>
                <Select value={form.banco} onValueChange={(v) => setForm({ ...form, banco: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos específicos de PRÉSTAMO */}
            {tab === 'PRESTAMO' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monto Principal (COP) *</Label>
                    <Input
                      type="number"
                      value={form.montoPrincipal}
                      onChange={(e) => setForm({ ...form, montoPrincipal: e.target.value })}
                      placeholder="10000000"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tasa Anual (%) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.tasaAnual}
                      onChange={(e) => setForm({ ...form, tasaAnual: e.target.value })}
                      placeholder="18.5"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plazo (meses)</Label>
                    <Input
                      type="number"
                      value={form.plazoMeses}
                      onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })}
                      placeholder="36"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seguro Mensual (COP)</Label>
                    <Input
                      type="number"
                      value={form.seguroMensual}
                      onChange={(e) => setForm({ ...form, seguroMensual: e.target.value })}
                      placeholder="25000"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Fecha de Desembolso</Label>
                    <Input
                      type="date"
                      value={form.fechaDesembolso}
                      onChange={(e) => setForm({ ...form, fechaDesembolso: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Campos específicos de TARJETA DE CRÉDITO */}
            {tab === 'TARJETA_CREDITO' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cupo Total (COP) *</Label>
                    <Input
                      type="number"
                      value={form.cupoTotal}
                      onChange={(e) => setForm({ ...form, cupoTotal: e.target.value })}
                      placeholder="5000000"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Saldo Utilizado (COP)</Label>
                    <Input
                      type="number"
                      value={form.saldoUtilizado}
                      onChange={(e) => setForm({ ...form, saldoUtilizado: e.target.value })}
                      placeholder="1200000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tasa Anual (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.tasaAnual}
                      onChange={(e) => setForm({ ...form, tasaAnual: e.target.value })}
                      placeholder="36.0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pago Mínimo (COP)</Label>
                    <Input
                      type="number"
                      value={form.pagoMinimo}
                      onChange={(e) => setForm({ ...form, pagoMinimo: e.target.value })}
                      placeholder="60000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pago Total Sin Interés (COP)</Label>
                    <Input
                      type="number"
                      value={form.pagoTotalSin}
                      onChange={(e) => setForm({ ...form, pagoTotalSin: e.target.value })}
                      placeholder="1200000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Día de Corte</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={form.diaCorte}
                      onChange={(e) => setForm({ ...form, diaCorte: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Día de Pago</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={form.diaPago}
                      onChange={(e) => setForm({ ...form, diaPago: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha Corte Actual</Label>
                    <Input
                      type="date"
                      value={form.fechaCorteActual}
                      onChange={(e) => setForm({ ...form, fechaCorteActual: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha Pago Próximo</Label>
                    <Input
                      type="date"
                      value={form.fechaPagoProximo}
                      onChange={(e) => setForm({ ...form, fechaPagoProximo: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
                placeholder="Observaciones, condiciones especiales, etc."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <ShieldCheck className="w-4 h-4 mr-2" />
                {editando ? 'Guardar Cambios' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================ CONFIRMACIÓN DELETE ============================ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar crédito bancario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{' '}
              <strong>"{deleteTarget?.nombre}"</strong> ({deleteTarget?.banco}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminar}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// =====================================================
// Tarjeta de Stats
// =====================================================
function StatCard({
  icon,
  label,
  value,
  subtitle,
  gradient,
  iconColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  gradient: string
  iconColor: string
}) {
  return (
    <Card className={`glass-card border-white/10 bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Tabla de Amortización (Sistema Francés)
// =====================================================
function calcularAmortizacion(
  principal: number,
  tasaAnual: number,
  plazoMeses: number,
  fechaDesembolso: string
): CuotaAmortizacion[] {
  if (!principal || !plazoMeses) return []
  const tasaMensual = tasaAnual / 100 / 12
  const n = plazoMeses
  let cuota: number
  if (tasaMensual === 0) {
    cuota = principal / n
  } else {
    const factor = Math.pow(1 + tasaMensual, n)
    cuota = (principal * (tasaMensual * factor)) / (factor - 1)
  }
  cuota = Math.round(cuota * 100) / 100

  const tabla: CuotaAmortizacion[] = []
  let saldoCapital = principal
  let acumuladoInteres = 0
  let acumuladoCapital = 0
  const fechaInicio = new Date(fechaDesembolso)

  for (let i = 1; i <= n; i++) {
    const interesCuota = Math.round(saldoCapital * tasaMensual * 100) / 100
    let capitalCuota = Math.round((cuota - interesCuota) * 100) / 100
    if (i === n) {
      capitalCuota = Math.round(saldoCapital * 100) / 100
    }
    saldoCapital = Math.round((saldoCapital - capitalCuota) * 100) / 100
    if (saldoCapital < 0) saldoCapital = 0
    acumuladoInteres = Math.round((acumuladoInteres + interesCuota) * 100) / 100
    acumuladoCapital = Math.round((acumuladoCapital + capitalCuota) * 100) / 100

    const fecha = new Date(fechaInicio)
    fecha.setMonth(fecha.getMonth() + i)

    tabla.push({
      numero: i,
      fechaVencimiento: fecha,
      montoCuota: i === n ? Math.round((capitalCuota + interesCuota) * 100) / 100 : cuota,
      capital: capitalCuota,
      interes: interesCuota,
      saldoCapital,
      acumuladoInteres,
      acumuladoCapital,
    })
  }
  return tabla
}

function AmortizacionTable({ prestamo }: { prestamo: PrestamoBancario }) {
  const [mostrarTodas, setMostrarTodas] = useState(false)

  const tabla = useMemo(
    () =>
      calcularAmortizacion(
        prestamo.montoPrincipal,
        prestamo.tasaAnual,
        prestamo.plazoMeses,
        prestamo.fechaDesembolso
      ),
    [prestamo]
  )

  if (tabla.length === 0) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            No se pudo calcular la tabla de amortización. Verifica el monto, tasa y plazo.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalInteres = tabla.reduce((s, c) => s + c.interes, 0)
  const totalPagar = prestamo.montoPrincipal + totalInteres
  const cuotaFija = tabla[0].montoCuota
  const filas = mostrarTodas ? tabla : tabla.slice(0, 6)

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Tabla de Amortización — {prestamo.nombre}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Sistema Francés
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Cuota Fija Mensual</p>
            <p className="text-base font-bold text-primary">{formatearMoneda(cuotaFija)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Total Interés</p>
            <p className="text-base font-bold text-amber-300">{formatearMoneda(totalInteres)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Total a Pagar</p>
            <p className="text-base font-bold">{formatearMoneda(totalPagar)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Cuotas</p>
            <p className="text-base font-bold">{tabla.length}</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => (
                <TableRow key={c.numero}>
                  <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                  <TableCell className="text-xs">
                    <Calendar className="w-3 h-3 inline mr-1 text-muted-foreground" />
                    {formatearFecha(c.fechaVencimiento)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatearMoneda(c.montoCuota)}</TableCell>
                  <TableCell className="text-right text-emerald-300">{formatearMoneda(c.capital)}</TableCell>
                  <TableCell className="text-right text-amber-300">{formatearMoneda(c.interes)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatearMoneda(c.saldoCapital)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {tabla.length > 6 && (
          <Button variant="outline" className="w-full" onClick={() => setMostrarTodas(!mostrarTodas)}>
            {mostrarTodas ? 'Ver menos' : `Ver todas las ${tabla.length} cuotas`}
            {mostrarTodas ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Detalle de Tarjeta de Crédito
// =====================================================
function TarjetaDetalle({
  tarjeta,
  onActualizarSaldo,
}: {
  tarjeta: PrestamoBancario
  onActualizarSaldo: (t: PrestamoBancario, nuevoSaldo: number) => void
}) {
  const [nuevoSaldo, setNuevoSaldo] = useState(tarjeta.saldoUtilizado.toString())

  useEffect(() => {
    setNuevoSaldo(tarjeta.saldoUtilizado.toString())
  }, [tarjeta])

  const utilizacion = tarjeta.cupoTotal > 0 ? (tarjeta.saldoUtilizado / tarjeta.cupoTotal) * 100 : 0
  const colorBar =
    utilizacion < 50
      ? 'bg-emerald-500'
      : utilizacion < 80
      ? 'bg-amber-500'
      : 'bg-red-500'
  const colorTexto =
    utilizacion < 50
      ? 'text-emerald-300'
      : utilizacion < 80
      ? 'text-amber-300'
      : 'text-red-300'
  const estadoUtilizacion =
    utilizacion < 50 ? 'Saludable' : utilizacion < 80 ? 'Atención' : 'Crítico'

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          {tarjeta.nombre} — {tarjeta.banco}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Barra de utilización */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Utilización del Cupo</p>
              <p className="text-xs text-muted-foreground">
                {formatearMoneda(tarjeta.saldoUtilizado)} de {formatearMoneda(tarjeta.cupoTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${colorTexto}`}>{utilizacion.toFixed(1)}%</p>
              <Badge variant="outline" className={colorTexto}>{estadoUtilizacion}</Badge>
            </div>
          </div>
          <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${colorBar} transition-all duration-500`}
              style={{ width: `${Math.min(100, utilizacion)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              &lt; 50%
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              50-80%
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              &gt; 80%
            </div>
          </div>
        </div>

        {/* Datos financieros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Cupo Total</p>
            <p className="text-base font-bold">{formatearMoneda(tarjeta.cupoTotal)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Disponible</p>
            <p className="text-base font-bold text-emerald-300">{formatearMoneda(tarjeta.cupoDisponible)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Pago Mínimo</p>
            <p className="text-base font-bold text-amber-300">{formatearMoneda(tarjeta.pagoMinimo)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Pago Sin Interés</p>
            <p className="text-base font-bold text-cyan-300">{formatearMoneda(tarjeta.pagoTotalSin)}</p>
          </div>
        </div>

        {/* Fechas importantes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Tasa Anual</p>
            <p className="text-base font-bold">{tarjeta.tasaAnual}%</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Día Corte / Pago</p>
            <p className="text-base font-bold">
              {tarjeta.diaCorte} / {tarjeta.diaPago}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Corte Actual</p>
            <p className="text-sm font-bold">{formatearFecha(tarjeta.fechaCorteActual)}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-muted-foreground">Pago Próximo</p>
            <p className="text-sm font-bold">{formatearFecha(tarjeta.fechaPagoProximo)}</p>
          </div>
        </div>

        {/* Actualización rápida de saldo */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-primary" />
            Actualización Rápida de Saldo
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={nuevoSaldo}
              onChange={(e) => setNuevoSaldo(e.target.value)}
              placeholder="Nuevo saldo utilizado"
              className="flex-1"
            />
            <Button
              onClick={() => {
                const val = parseFloat(nuevoSaldo)
                if (!isNaN(val) && val >= 0) {
                  onActualizarSaldo(tarjeta, val)
                }
              }}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Recalcula automáticamente el cupo disponible y la utilización.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
