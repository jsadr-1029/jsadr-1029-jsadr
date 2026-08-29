'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, DollarSign, AlertTriangle, Activity } from 'lucide-react'
import { formatearMoneda } from '@/lib/finanzas'

interface DatosInforme {
  reporteAnual: { mes: string; total: number; capital: number; interes: number; mora: number; numPagos: number }[]
  metodosHoy: Record<string, number>
  topClientesHoy: { nombre: string; total: number; pagos: number }[]
  comparativoDiario: { hoy: { total: number }; ayer: { total: number }; variacion: number }
  comparativoMensual: { mesActual: { total: number }; mesAnterior: { total: number }; variacion: number }
  cartera: { prestamosActivos: number; prestamosEnMora: number; saldoTotalActivos: number; tasaMora: number }
}

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e']

export function PagosCharts({ periodo }: { periodo: string }) {
  const [data, setData] = useState<DatosInforme | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pagos/informe?periodo=${periodo}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data)
      })
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
        <span className="text-slate-500">Cargando gráficos...</span>
      </div>
    )
  }
  if (!data) return <div className="text-center text-slate-500 py-8">Sin datos</div>

  const metodosData = Object.entries(data.metodosHoy || {}).map(([name, value]) => ({ name, value }))
  const topClientes = (data.topClientesHoy || []).map((c) => ({ name: c.nombre.split(' ')[0], total: c.total }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label="Recaudo hoy"
          value={formatearMoneda(data.comparativoDiario?.hoy?.total || 0)}
          sub={`Ayer: ${formatearMoneda(data.comparativoDiario?.ayer?.total || 0)}`}
          variacion={data.comparativoDiario?.variacion}
          color="indigo"
        />
        <KpiCard
          icon={Activity}
          label="Recaudo mes"
          value={formatearMoneda(data.comparativoMensual?.mesActual?.total || 0)}
          sub={`Mes ant: ${formatearMoneda(data.comparativoMensual?.mesAnterior?.total || 0)}`}
          variacion={data.comparativoMensual?.variacion}
          color="purple"
        />
        <KpiCard
          icon={DollarSign}
          label="Saldo cartera"
          value={formatearMoneda(data.cartera?.saldoTotalActivos || 0)}
          sub={`${data.cartera?.prestamosActivos || 0} solicitudes activos`}
          color="emerald"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Tasa mora"
          value={`${(data.cartera?.tasaMora || 0).toFixed(1)}%`}
          sub={`${data.cartera?.prestamosEnMora || 0} en mora`}
          color={data.cartera?.tasaMora > 10 ? 'red' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-700">Tendencia de recaudo (anual)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.reporteAnual || []}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorMora" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: any) => formatearMoneda(value)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#colorTotal)" name="Total" />
                <Area type="monotone" dataKey="mora" stroke="#f43f5e" strokeWidth={2} fill="url(#colorMora)" name="Mora" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-700">Métodos de pago (hoy)</CardTitle>
          </CardHeader>
          <CardContent>
            {metodosData.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-sm">Sin pagos hoy</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={metodosData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name}: ${formatearMoneda(entry.value)}`}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {metodosData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatearMoneda(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-700">Top clientes (hoy)</CardTitle>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-sm">Sin pagos hoy</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" style={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value: any) => formatearMoneda(value)} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-700">Composición del recaudo (anual)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.reporteAnual || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" style={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: any) => formatearMoneda(value)} />
                <Legend />
                <Bar dataKey="capital" stackId="a" fill="#22c55e" name="Capital" />
                <Bar dataKey="interes" stackId="a" fill="#3b82f6" name="Interés" />
                <Bar dataKey="mora" stackId="a" fill="#f43f5e" name="Mora" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, variacion, color }: any) {
  const colorMap: any = {
    indigo: 'from-indigo-500 to-purple-500',
    purple: 'from-purple-500 to-fuchsia-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
  }
  return (
    <Card className="bg-white border-slate-200 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-slate-500 font-medium">{label}</span>
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
        {variacion !== undefined && (
          <div className={`text-[11px] mt-1 font-medium ${variacion >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {variacion >= 0 ? '↑' : '↓'} {Math.abs(variacion).toFixed(1)}% vs anterior
          </div>
        )}
      </CardContent>
    </Card>
  )
}
