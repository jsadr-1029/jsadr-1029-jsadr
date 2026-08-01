'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from 'recharts'
import {
  Wallet,
  AlertTriangle,
  Banknote,
  Scale,
  TrendingUp,
  PiggyBank,
  Loader2,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  Users,
  FileText,
  ArrowUpRight,
  Activity,
} from 'lucide-react'
import { AccesosPortalReporte } from './AccesosPortalReporte'
import { EstadoBadge } from '@/components/ui-basics'

interface ReportesData {
  kpis: {
    totalClientes: number
    totalPrestamos: number
    carteraTotal: number
    montoEnMora: number
    cantidadEnMora: number
    recaudoHoy: number
    recaudoRango: number
    cantidadPagosHoy: number
    cantidadPagosRango: number
    casosJuridicos: number
    casosJuridicosActivos: number
    totalMovimientosCajas: number
  }
  financieros: {
    capitalPendiente: number
    interesPendiente: number
    totalProyectado: number
    moraProyectada: number
    ratioMora: number
    rentabilidadEsperada: number
  }
  proyeccion30Dias: { fecha: string; monto: number; cuotas: number }[]
  proyeccionMensual: {
    mes: string
    monto: number
    cuotas: number
    capital: number
    interes: number
  }[]
  porCategoria: {
    categoria: string
    codigo: string
    count: number
    montoPrincipal: number
    saldoTotal: number
  }[]
  porCliente: {
    clienteId: string
    nombre: string
    cedula: string
    saldoTotal: number
    prestamos: number
  }[]
  porPrestamo: {
    id: string
    codigo: string
    cliente: string
    cedula: string
    montoPrincipal: number
    saldoTotal: number
    estado: string
    diasMora: number
    fechaVencimiento: string
  }[]
  resumenEstados: {
    estado: string
    _count: number
    _sum: { saldoTotal: number | null; montoPrincipal: number | null }
  }[]
  cajas: any[]
  categorias: any[]
  cuentas: any[]
  casosJuridicosRecientes: any[]
  alertasJuridico: any[]
  metadata: {
    rango: string
    fechaGeneracion: string
    moneda: string
  }
}

const COLORES_GRAFICO = [
  '#a78bfa',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#60a5fa',
  '#f472b6',
]

interface Props {
  onAbrirPrestamo: (id: string) => void
}

export function ReportesUnificadoView({ onAbrirPrestamo }: Props) {
  const [data, setData] = useState<ReportesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState<'7d' | '30d' | '90d' | '12m'>('30d')
  const { toast } = useToast()

  useEffect(() => {
    cargar()
  }, [rango])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes?rango=${rango}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Reportes Unificados"
          subtitle="Dashboard integral de cartera y finanzas"
          icon={<BarChart3 className="w-5 h-5" />}
        />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  const { kpis, financieros } = data

  // Datos para gráficos
  const proyeccion30Data = data.proyeccion30Dias.map((p) => ({
    fecha: new Date(p.fecha).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
    }),
    monto: p.monto,
    cuotas: p.cuotas,
  }))

  const mensualData = data.proyeccionMensual.map((m) => ({
    ...m,
    mesCorto: m.mes.split(' ')[0],
  }))

  const categoriaData = data.porCategoria.map((c) => ({
    name: c.categoria,
    value: c.saldoTotal,
    count: c.count,
  }))

  const estadosData = data.resumenEstados.map((e) => ({
    name: e.estado,
    value: e._count,
    monto: e._sum.saldoTotal || 0,
  }))

  const ratioMoraPct = Math.min(financieros.ratioMora, 100)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes Unificados"
        subtitle="Dashboard integral: cartera, finanzas, proyecciones y análisis"
        icon={<BarChart3 className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
              {([
                { v: '7d', l: '7d' },
                { v: '30d', l: '30d' },
                { v: '90d', l: '90d' },
                { v: '12m', l: '12m' },
              ] as const).map((opt) => (
                <Button
                  key={opt.v}
                  size="sm"
                  variant={rango === opt.v ? 'default' : 'ghost'}
                  onClick={() => setRango(opt.v)}
                  className={`h-7 px-3 text-xs ${
                    rango === opt.v
                      ? 'gradient-primary text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.l}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={cargar}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {/* === KPIs OPERACIONALES === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Cartera Total"
          value={formatearMoneda(kpis.carteraTotal)}
          subtitle={`${kpis.totalPrestamos} préstamos`}
          icon={Wallet}
          color="violet"
        />
        <KPICard
          title="En Mora"
          value={formatearMoneda(kpis.montoEnMora)}
          subtitle={`${kpis.cantidadEnMora} préstamos`}
          icon={AlertTriangle}
          color="amber"
        />
        <KPICard
          title="Recaudo Hoy"
          value={formatearMoneda(kpis.recaudoHoy)}
          subtitle={`${kpis.cantidadPagosHoy} pagos hoy`}
          icon={Banknote}
          color="emerald"
        />
        <KPICard
          title="Casos Jurídicos"
          value={String(kpis.casosJuridicos)}
          subtitle={`${kpis.casosJuridicosActivos} activos`}
          icon={Scale}
          color="rose"
        />
      </div>

      {/* === KPIs FINANCIEROS === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Capital Activo"
          value={formatearMoneda(financieros.capitalPendiente)}
          subtitle="Pendiente por cobrar"
          icon={TrendingUp}
          color="cyan"
        />
        <KPICard
          title="Intereses Proyectados"
          value={formatearMoneda(financieros.interesPendiente)}
          subtitle={`Rentab. ${financieros.rentabilidadEsperada.toFixed(2)}%`}
          icon={ArrowUpRight}
          color="violet"
        />
        <KPICard
          title="Mora Pendiente"
          value={formatearMoneda(financieros.moraProyectada)}
          subtitle="Por cobrar (mora)"
          icon={AlertTriangle}
          color="amber"
        />
        <KPICard
          title="Total a Recuperar"
          value={formatearMoneda(financieros.totalProyectado)}
          subtitle="Capital + interés + mora"
          icon={PiggyBank}
          color="emerald"
        />
      </div>

      {/* === RESUMEN FINANCIERO CON BARRA DE PROGRESO === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Resumen Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-muted-foreground">Capital pendiente</p>
              <p className="text-xl font-bold mt-1">
                {formatearMoneda(financieros.capitalPendiente)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-muted-foreground">Interés proyectado</p>
              <p className="text-xl font-bold mt-1 text-violet-300">
                {formatearMoneda(financieros.interesPendiente)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-muted-foreground">Total a recuperar</p>
              <p className="text-xl font-bold mt-1 text-emerald-300">
                {formatearMoneda(financieros.totalProyectado)}
              </p>
            </div>
          </div>

          {/* Barra de progreso: ratio de mora */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ratio de mora sobre cartera total</span>
              <span
                className={`font-bold ${
                  ratioMoraPct > 15
                    ? 'text-rose-300'
                    : ratioMoraPct > 5
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}
              >
                {financieros.ratioMora.toFixed(2)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  ratioMoraPct > 15
                    ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                    : ratioMoraPct > 5
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${Math.max(ratioMoraPct, 2)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>Saludable: &lt;5%</span>
              <span>Crítico: &gt;15%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === CAJAS MENORES === */}
      {data.cajas.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-primary" />
              Cajas Menores
              <Badge variant="outline" className="ml-2 text-xs bg-white/5">
                {data.cajas.length} cajas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.cajas.slice(0, 6).map((caja: any) => (
                <div
                  key={caja.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{caja.nombre}</h4>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        caja.activa
                          ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {caja.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo actual:</span>
                      <span className="font-bold text-emerald-300">
                        {formatearMoneda(caja.saldoActual)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingresos:</span>
                      <span className="text-cyan-300">
                        {formatearMoneda(caja.totalIngresos)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Egresos:</span>
                      <span className="text-rose-300">
                        {formatearMoneda(caja.totalEgresos)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
                      <span className="text-muted-foreground">Movimientos:</span>
                      <span>{caja._count?.movimientos || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === GRÁFICO BARRAS: PROYECCIÓN 30 DÍAS === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Proyección de Recaudo — Próximos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proyeccion30Data.length > 0 ? (
            <>
              <div className="mb-3 flex items-center gap-4">
                <Badge variant="outline" className="bg-violet-500/15 text-violet-300 border-violet-400/30">
                  Total: {formatearMoneda(data.proyeccion30Dias.reduce((s, p) => s + p.monto, 0))}
                </Badge>
                <Badge variant="outline" className="bg-cyan-500/15 text-cyan-300 border-cyan-400/30">
                  Cuotas: {data.proyeccion30Dias.reduce((s, p) => s + p.cuotas, 0)}
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={proyeccion30Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="fecha" fontSize={11} stroke="rgba(255,255,255,0.5)" />
                  <YAxis
                    fontSize={11}
                    stroke="rgba(255,255,255,0.5)"
                    tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatearMoneda(value)}
                    contentStyle={{
                      backgroundColor: 'rgba(20, 20, 35, 0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="monto" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Monto" />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No hay pagos proyectados en los próximos 30 días
            </div>
          )}
        </CardContent>
      </Card>

      {/* === GRÁFICO COMPUESTO: 12 MESES CAPITAL+INTERES === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Proyección 12 meses — Capital + Interés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={mensualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mesCorto" fontSize={11} stroke="rgba(255,255,255,0.5)" />
              <YAxis
                fontSize={11}
                stroke="rgba(255,255,255,0.5)"
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value: number) => formatearMoneda(value)}
                contentStyle={{
                  backgroundColor: 'rgba(20, 20, 35, 0.95)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="capital" name="Capital" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="interes" name="Interés" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={20} />
              <Line
                type="monotone"
                dataKey="monto"
                name="Total"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3, fill: '#fbbf24' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* === PIE CHARTS: CATEGORÍA + ESTADOS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Distribución por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoriaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name}`}
                    labelLine={false}
                  >
                    {categoriaData.map((_, i) => (
                      <Cell key={i} fill={COLORES_GRAFICO[i % COLORES_GRAFICO.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatearMoneda(value)}
                    contentStyle={{
                      backgroundColor: 'rgba(20, 20, 35, 0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin categorías
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {estadosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={estadosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {estadosData.map((_, i) => (
                      <Cell key={i} fill={COLORES_GRAFICO[i % COLORES_GRAFICO.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(20, 20, 35, 0.95)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === TABLA: DETALLE MENSUAL === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Detalle Mensual — Proyección 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Mes</TableHead>
                  <TableHead className="text-right text-muted-foreground">Cuotas</TableHead>
                  <TableHead className="text-right text-muted-foreground">Capital</TableHead>
                  <TableHead className="text-right text-muted-foreground">Interés</TableHead>
                  <TableHead className="text-right text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensualData.map((m, i) => (
                  <TableRow key={i} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-sm font-medium capitalize">{m.mes}</TableCell>
                    <TableCell className="text-right text-sm">{m.cuotas}</TableCell>
                    <TableCell className="text-right text-sm text-cyan-300">
                      {formatearMoneda(m.capital)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-violet-300">
                      {formatearMoneda(m.interes)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold">
                      {formatearMoneda(m.monto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* === TABLA: ANÁLISIS POR CATEGORÍA === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Análisis por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Código</TableHead>
                  <TableHead className="text-muted-foreground">Categoría</TableHead>
                  <TableHead className="text-right text-muted-foreground">Préstamos</TableHead>
                  <TableHead className="text-right text-muted-foreground">Monto Principal</TableHead>
                  <TableHead className="text-right text-muted-foreground">Saldo Total</TableHead>
                  <TableHead className="text-right text-muted-foreground">% Cartera</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porCategoria.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Sin categorías
                    </TableCell>
                  </TableRow>
                ) : (
                  data.porCategoria.map((c, i) => {
                    const totalCartera = data.porCategoria.reduce(
                      (s, x) => s + x.saldoTotal,
                      0
                    )
                    const pct = totalCartera > 0 ? (c.saldoTotal / totalCartera) * 100 : 0
                    return (
                      <TableRow key={i} className="border-white/5 hover:bg-white/5">
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono bg-white/5">
                            {c.codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{c.categoria}</TableCell>
                        <TableCell className="text-right text-sm">{c.count}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatearMoneda(c.montoPrincipal)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold">
                          {formatearMoneda(c.saldoTotal)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ color: COLORES_GRAFICO[i % COLORES_GRAFICO.length] }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: COLORES_GRAFICO[i % COLORES_GRAFICO.length],
                              }}
                            />
                            {pct.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* === TABLA: TOP 15 CLIENTES === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Top 15 Clientes por Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Cédula</TableHead>
                  <TableHead className="text-right text-muted-foreground">Préstamos</TableHead>
                  <TableHead className="text-right text-muted-foreground">Saldo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porCliente.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay clientes con préstamos activos
                    </TableCell>
                  </TableRow>
                ) : (
                  data.porCliente.map((c, i) => (
                    <TableRow key={i} className="border-white/5 hover:bg-white/5">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {c.cedula}
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.prestamos}</TableCell>
                      <TableCell className="text-right text-sm font-bold text-violet-300">
                        {formatearMoneda(c.saldoTotal)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* === TABLA: TOP 20 PRÉSTAMOS === */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Top 20 Préstamos por Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Código</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-right text-muted-foreground">Principal</TableHead>
                  <TableHead className="text-right text-muted-foreground">Saldo</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-right text-muted-foreground">Días mora</TableHead>
                  <TableHead className="text-muted-foreground">Vencimiento</TableHead>
                  <TableHead className="text-right text-muted-foreground">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porPrestamo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No hay préstamos activos
                    </TableCell>
                  </TableRow>
                ) : (
                  data.porPrestamo.map((p) => (
                    <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                      <TableCell>
                        <button
                          onClick={() => onAbrirPrestamo(p.id)}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {p.codigo}
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{p.cliente}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.cedula}</p>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatearMoneda(p.montoPrincipal)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold">
                        {formatearMoneda(p.saldoTotal)}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={p.estado} />
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {p.diasMora > 0 ? (
                          <span
                            className={
                              p.diasMora >= 60
                                ? 'text-rose-300 font-bold'
                                : p.diasMora >= 30
                                ? 'text-amber-300'
                                : 'text-yellow-300'
                            }
                          >
                            {p.diasMora}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatearFecha(p.fechaVencimiento)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 hover:bg-white/10"
                          onClick={() => onAbrirPrestamo(p.id)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* === ACCESOS PORTAL === */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-px flex-1 bg-white/10" />
          <span>Análisis de accesos al portal</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <AccesosPortalReporte />
      </div>
    </div>
  )
}

// ===================== KPI CARD =====================
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  subtitle: string
  icon: any
  color: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
}) {
  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-500/15 text-violet-300',
    cyan: 'bg-cyan-500/15 text-cyan-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    rose: 'bg-rose-500/15 text-rose-300',
  }
  return (
    <Card className="glass-card hover:border-primary/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClasses[color]}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
