'use client'

import { useEffect, useState } from 'react'
import { PageHeader, EstadoBadge } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'
import {
  LayoutDashboard,
  Wallet,
  AlertTriangle,
  Banknote,
  Scale,
  TrendingUp,
  Users,
  FileText,
  ArrowRight,
  PiggyBank,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
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
} from 'recharts'

interface DashboardData {
  kpis: any
  cajas: any[]
  categorias: any[]
  cuentas: any[]
  proyeccion30Dias: { fecha: string; monto: number }[]
  resumenEstados: { estado: string; _count: number; _sum: { saldoTotal: number | null } }[]
  casosJuridicosRecientes: any[]
  alertasJuridico: any[]
}

const COLORES_GRAFICO = ['#1e3a5f', '#3b82a3', '#5cb85c', '#f0ad4e', '#d9534f', '#5bc0de', '#8e44ad']

function _countLabel(n: number): string {
  return `${n} ${n === 1 ? 'pago' : 'pagos'}`
}

export function DashboardView({ onAbrirPrestamo }: { onAbrirPrestamo: (id: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reportes" subtitle="Resumen general del sistema" icon={<LayoutDashboard className="w-5 h-5" />} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  const kpis = data.kpis
  const proyeccionData = data.proyeccion30Dias.map((p) => ({
    fecha: new Date(p.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
    monto: p.monto,
  }))
  const estadosData = data.resumenEstados.map((e) => ({
    name: e.estado,
    value: e._count,
    monto: e._sum.saldoTotal || 0,
  }))

  const cards = [
    {
      title: 'Cartera Total',
      value: formatearMoneda(kpis.carteraTotal),
      subtitle: `${kpis.totalPrestamos} préstamos registrados`,
      icon: Wallet,
      color: 'text-blue-700 bg-blue-50',
    },
    {
      title: 'En Mora',
      value: formatearMoneda(kpis.montoEnMora),
      subtitle: `${kpis.cantidadEnMora} préstamos atrasados`,
      icon: AlertTriangle,
      color: 'text-amber-700 bg-amber-50',
    },
    {
      title: 'Recaudo del Día',
      value: formatearMoneda(kpis.recaudoHoy),
      subtitle: `${kpis.cantidadPagosHoy} pagos aplicados hoy`,
      icon: Banknote,
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      title: 'Casos Jurídicos',
      value: `${kpis.casosJuridicosActivos}`,
      subtitle: 'Casos activos en legal',
      icon: Scale,
      color: 'text-orange-700 bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Panel general del sistema de gestión de préstamos"
        icon={<LayoutDashboard className="w-5 h-5" />}
        actions={
          <Button variant="outline" onClick={() => location.reload()}>
            Actualizar
          </Button>
        }
      />

      {/* Alerta de préstamos que deben ir a jurídico */}
      {data.alertasJuridico.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">
                  ⚠️ {data.alertasJuridico.length} préstamo(s) con 60+ días de mora
                </p>
                <p className="text-sm text-red-800 mt-1">
                  Deben ser derivados a cobro jurídico según la política de la empresa.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.alertasJuridico.map((p: any) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-800"
                      onClick={() => onAbrirPrestamo(p.id)}
                    >
                      {p.codigo} ({p.diasMora}d)
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow">
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

      {/* Cajas menores - destacadas */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-primary" />
          Cajas Menores
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.cajas.map((caja) => (
            <Card key={caja.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      caja.codigo === 'CAJA-MORA'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {caja.codigo === 'CAJA-MORA' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <ShieldCheck className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{caja.nombre}</p>
                      <p className="text-xs text-muted-foreground">{caja.descripcion}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-primary/10 rounded">
                    <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                    <p className="text-sm font-bold text-primary">
                      {formatearMoneda(caja.saldoActual)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 rounded">
                    <p className="text-[10px] text-muted-foreground uppercase">Ingresos</p>
                    <p className="text-xs font-bold text-emerald-700">
                      {formatearMoneda(caja.totalIngresos)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <p className="text-[10px] text-muted-foreground uppercase">Egresos</p>
                    <p className="text-xs font-bold text-red-700">
                      {formatearMoneda(caja.totalEgresos)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Clientes registrados</p>
              <p className="text-xl font-bold">{kpis.totalClientes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Préstamos totales</p>
              <p className="text-xl font-bold">{kpis.totalPrestamos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingUp className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Proyección 30 días</p>
              <p className="text-xl font-bold">
                {formatearMoneda(data.proyeccion30Dias.reduce((s, p) => s + p.monto, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Proyección de Recaudo - Próximos 30 días</CardTitle>
          </CardHeader>
          <CardContent>
            {proyeccionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={proyeccionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="fecha" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value: number) => formatearMoneda(value)} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="monto" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No hay pagos proyectados en los próximos 30 días
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {estadosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={estadosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {estadosData.map((_, i) => (
                      <Cell key={i} fill={COLORES_GRAFICO[i % COLORES_GRAFICO.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
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

      {/* Categorías y cuentas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías de Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.categorias.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  <div>
                    <span className="font-medium text-sm">{cat.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-2">({cat.codigo})</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">
                      <span className="text-blue-700 font-medium">{cat.tasaInteresAnual}%</span> anual
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatearMoneda(cat.montoMinimo)} - {formatearMoneda(cat.montoMaximo)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Cuentas de Recaudo</span>
              <span className="text-xs text-muted-foreground font-normal">
                Balance acumulado (pagos aplicados)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.cuentas.map((cta: any) => {
                const totalAplicado = (cta.pagos || []).reduce(
                  (s: number, p: any) => s + (p.montoTotal || 0),
                  0
                )
                const totalCapital = (cta.pagos || []).reduce(
                  (s: number, p: any) => s + (p.montoCapital || 0),
                  0
                )
                const totalInteres = (cta.pagos || []).reduce(
                  (s: number, p: any) => s + (p.montoInteres || 0),
                  0
                )
                const totalMora = (cta.pagos || []).reduce(
                  (s: number, p: any) => s + (p.montoMora || 0),
                  0
                )
                const nClientes = cta._count?.clientes ?? (cta.clientes?.length ?? 0)
                return (
                  <div
                    key={cta.id}
                    className="flex flex-col gap-1 p-3 rounded-md border border-border hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{cta.nombre}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {cta.codigo}
                          </span>
                          {!cta.activa && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                              INACTIVA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cta.banco} · {cta.tipoCuenta} ·{' '}
                          <span className="font-mono">{cta.numeroCuenta}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-green-600">
                          {formatearMoneda(totalAplicado)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {_countLabel(cta._count?.pagos ?? 0)} · {nClientes} clientes
                        </p>
                      </div>
                    </div>
                    {(totalCapital > 0 || totalInteres > 0 || totalMora > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>Capital: <span className="font-semibold text-foreground">{formatearMoneda(totalCapital)}</span></span>
                        <span>Interés: <span className="font-semibold text-foreground">{formatearMoneda(totalInteres)}</span></span>
                        <span>Mora: <span className="font-semibold text-foreground">{formatearMoneda(totalMora)}</span></span>
                      </div>
                    )}
                  </div>
                )
              })}
              {data.cuentas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No hay cuentas de recaudo configuradas. Crea cuentas en{' '}
                  <span className="font-medium">Administración → Cuentas</span>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Casos jurídicos recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Casos Jurídicos Activos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.casosJuridicosRecientes.length > 0 ? (
            <div className="space-y-3">
              {data.casosJuridicosRecientes.map((caso) => (
                <div
                  key={caso.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onAbrirPrestamo(caso.prestamoId)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{caso.prestamo.cliente.nombre}</span>
                      <span className="text-xs text-muted-foreground">· {caso.prestamo.codigo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Abogado: {caso.abogadoNombre || 'Sin asignar'} · Saldo: {formatearMoneda(caso.prestamo.saldoTotal)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={caso.estado} />
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay casos jurídicos activos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
