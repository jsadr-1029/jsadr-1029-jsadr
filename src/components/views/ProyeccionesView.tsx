'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  TrendingUp,
  Wallet,
  Coins,
  Target,
  Calendar,
  Users,
  Layers,
  AlertTriangle,
  PiggyBank,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from 'recharts'

interface ProyeccionesData {
  kpis: {
    capitalActivo: number
    interesesProyectados: number
    moraPendiente: number
    totalARecuperar: number
    totalDesembolsado: number
    totalInteresGenerado: number
    totalPagado: number
    gananciaEsperadaPct: number
    cantidadPrestamos: number
  }
  proyeccionMensual: { mes: string; capital: number; interes: number; mora: number; total: number }[]
  porCategoria: any[]
  porCliente: any[]
  porPrestamo: any[]
  resumenEstados: { ACTIVO: number; EN_MORA: number; total: number }
}

const COLORES = ['#1e3a5f', '#3b82a3', '#5cb85c', '#f0ad4e', '#d9534f', '#5bc0de', '#8e44ad']

export function ProyeccionesView() {
  const [data, setData] = useState<ProyeccionesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/proyecciones')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Error al cargar proyecciones')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-900">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <p className="font-semibold">Error al cargar proyecciones</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button onClick={cargar} className="mt-4" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const k = data.kpis
  const gananciaRealizada = k.totalPagado - (k.totalDesembolsado - k.capitalActivo)
  const gananciaRealizadaPct = k.totalDesembolsado > 0 ? (gananciaRealizada / k.totalDesembolsado) * 100 : 0

  const kpiCards = [
    {
      title: 'Capital Activo',
      value: formatearMoneda(k.capitalActivo),
      subtitle: `${k.cantidadPrestamos} préstamos activos`,
      icon: Wallet,
      color: 'text-blue-700 bg-blue-50',
      border: 'border-blue-200',
    },
    {
      title: 'Intereses Proyectados',
      value: formatearMoneda(k.interesesProyectados),
      subtitle: `${k.gananciaEsperadaPct.toFixed(1)}% sobre capital`,
      icon: TrendingUp,
      color: 'text-emerald-700 bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      title: 'Mora Pendiente',
      value: formatearMoneda(k.moraPendiente),
      subtitle: `${data.resumenEstados.EN_MORA} en mora`,
      icon: AlertTriangle,
      color: 'text-amber-700 bg-amber-50',
      border: 'border-amber-200',
    },
    {
      title: 'Total a Recuperar',
      value: formatearMoneda(k.totalARecuperar),
      subtitle: 'Capital + Interés + Mora',
      icon: Target,
      color: 'text-purple-700 bg-purple-50',
      border: 'border-purple-200',
    },
  ]

  // Datos para gráfico de proyección mensual
  const datosMensual = data.proyeccionMensual.map((p) => ({
    mes: p.mes,
    Capital: p.capital,
    Interés: p.interes,
    Total: p.total,
  }))

  // Datos para pie chart por categoría
  const datosCategoria = data.porCategoria.map((c) => ({
    name: c.codigo,
    value: c.capitalActivo,
    label: c.categoria,
  }))

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Proyecciones Financieras
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Capital activo, intereses proyectados y ganancia esperada de la cartera actual
          </p>
        </div>
        <Button variant="outline" onClick={cargar}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon
          return (
            <Card key={i} className={`overflow-hidden border-2 ${card.border} hover:shadow-md transition-shadow`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-2">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Resumen financiero detallado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-primary" />
            Resumen Financiero de la Cartera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">Total Desembolsado</p>
              <p className="text-lg font-bold text-blue-900 mt-1">{formatearMoneda(k.totalDesembolsado)}</p>
              <p className="text-xs text-blue-600 mt-1">Capital histórico entregado</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium">Interés Total Generado</p>
              <p className="text-lg font-bold text-emerald-900 mt-1">{formatearMoneda(k.totalInteresGenerado)}</p>
              <p className="text-xs text-emerald-600 mt-1">Interés total del contrato</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700 font-medium">Total Recibido (Pagado)</p>
              <p className="text-lg font-bold text-purple-900 mt-1">{formatearMoneda(k.totalPagado)}</p>
              <p className="text-xs text-purple-600 mt-1">Capital + Interés ya cobrado</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700 font-medium">Ganancia Realizada</p>
              <p className="text-lg font-bold text-amber-900 mt-1">
                {formatearMoneda(gananciaRealizada)}
              </p>
              <p className="text-xs text-amber-600 mt-1">{gananciaRealizadaPct.toFixed(1)}% sobre desembolsado</p>
            </div>
          </div>

          {/* Barra de progreso de recuperación */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progreso de recuperación de cartera</span>
              <span className="text-sm font-bold">
                {k.totalDesembolsado > 0 ? ((k.totalPagado / (k.totalDesembolsado + k.totalInteresGenerado)) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-3"
                style={{ width: `${Math.min(100, (k.totalPagado / (k.totalDesembolsado + k.totalInteresGenerado)) * 100)}%` }}
                title="Recuperado"
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>Recuperado: {formatearMoneda(k.totalPagado)}</span>
              <span>Por recuperar: {formatearMoneda(k.totalARecuperar)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de proyección mensual 12 meses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Proyección de Recupero - Próximos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datosMensual.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={datosMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number) => formatearMoneda(value)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Capital" stackId="a" fill="#1e3a5f" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Interés" stackId="a" fill="#5cb85c" radius={[4, 4, 0, 0]} />
                <Line dataKey="Total" stroke="#d9534f" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No hay cuotas pendientes en los próximos 12 meses
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Las barras muestran capital (azul) e interés (verde) que se espera recuperar cada mes. La línea roja muestra el total mensual proyectado.
          </p>
        </CardContent>
      </Card>

      {/* Dos columnas: Pie categorias + Tabla mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Distribución del Capital Activo por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {datosCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {datosCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatearMoneda(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla proyección mensual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              Detalle Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Interés</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.proyeccionMensual.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium capitalize">{m.mes}</TableCell>
                    <TableCell className="text-right text-blue-700">{formatearMoneda(m.capital)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatearMoneda(m.interes)}</TableCell>
                    <TableCell className="text-right font-bold">{formatearMoneda(m.total)}</TableCell>
                  </TableRow>
                ))}
                {data.proyeccionMensual.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Sin datos de proyección
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {data.proyeccionMensual.length > 0 && (
                <tfoot>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right text-blue-700">
                      {formatearMoneda(data.proyeccionMensual.reduce((s, m) => s + m.capital, 0))}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700">
                      {formatearMoneda(data.proyeccionMensual.reduce((s, m) => s + m.interes, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatearMoneda(data.proyeccionMensual.reduce((s, m) => s + m.total, 0))}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tabla por categoría */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Análisis por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-center">Préstamos</TableHead>
                <TableHead className="text-right">Tasa Promedio</TableHead>
                <TableHead className="text-right">Capital Activo</TableHead>
                <TableHead className="text-right">Intereses Proyectados</TableHead>
                <TableHead className="text-right">Mora</TableHead>
                <TableHead className="text-right">Total a Recuperar</TableHead>
                <TableHead className="text-right">Ganancia %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porCategoria.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.categoria}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.codigo}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{c.cantidadPrestamos}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-blue-700">{c.tasaPromedio.toFixed(1)}%</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-blue-700">{formatearMoneda(c.capitalActivo)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatearMoneda(c.interesesProyectados)}</TableCell>
                  <TableCell className="text-right text-amber-700">
                    {c.moraPendiente > 0 ? formatearMoneda(c.moraPendiente) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatearMoneda(c.totalARecuperar)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                      +{c.gananciaPct.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.porCategoria.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Sin préstamos activos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabla top clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Top 15 Clientes por Capital Activo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead className="text-center">Cat</TableHead>
                <TableHead className="text-center">Préstamos</TableHead>
                <TableHead className="text-right">Capital Activo</TableHead>
                <TableHead className="text-right">Intereses</TableHead>
                <TableHead className="text-right">Mora</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Próximo Venc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porCliente.map((c, i) => (
                <TableRow key={c.clienteId}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.cliente}</TableCell>
                  <TableCell className="font-mono text-xs">{c.cedula}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{c.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{c.cantidadPrestamos}</TableCell>
                  <TableCell className="text-right font-medium text-blue-700">{formatearMoneda(c.capitalActivo)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatearMoneda(c.interesesProyectados)}</TableCell>
                  <TableCell className="text-right text-amber-700">
                    {c.moraPendiente > 0 ? formatearMoneda(c.moraPendiente) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatearMoneda(c.totalARecuperar)}</TableCell>
                  <TableCell className="text-xs">
                    {c.proximoVencimiento ? formatearFecha(new Date(c.proximoVencimiento)) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {data.porCliente.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                    Sin préstamos activos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabla top préstamos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Top 20 Préstamos por Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Cat</TableHead>
                <TableHead className="text-right">Monto Original</TableHead>
                <TableHead className="text-right">Capital Pend.</TableHead>
                <TableHead className="text-right">Interés Pend.</TableHead>
                <TableHead className="text-right">Mora</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Cuotas</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porPrestamo.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                  <TableCell className="font-medium">{p.cliente}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{p.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatearMoneda(p.montoPrincipal)}</TableCell>
                  <TableCell className="text-right font-medium text-blue-700">{formatearMoneda(p.capitalActivo)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatearMoneda(p.interesesProyectados)}</TableCell>
                  <TableCell className="text-right text-amber-700">
                    {p.moraPendiente > 0 ? formatearMoneda(p.moraPendiente) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatearMoneda(p.totalARecuperar)}</TableCell>
                  <TableCell className="text-center text-xs">
                    {p.cuotasPagadas}/{p.totalCuotas}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={p.estado === 'ACTIVO' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {p.estado === 'ACTIVO' ? 'Activo' : 'En Mora'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.porPrestamo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                    Sin préstamos activos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
