'use client'

import { useFetch } from '@/hooks/use-fetch'
import { Card, StatCard, PageHeader, Badge, LoadingState, EmptyState } from '@/components/shared/ui'
import { formatCOP, formatDate, formatPercent, formatRelativeTime, diasEntre, estadoPrestamoColor } from '@/lib/format'
import { Users, FileText, Wallet, AlertTriangle, Bell, CreditCard, TrendingUp, Scale, ArrowRight, Clock, Calendar } from 'lucide-react'
import { useState, useEffect } from 'react'

type View = { name: string; id?: string }

type DashboardData = {
  kpis: {
    totalClientes: number
    clientesConPrestamosActivos: number
    totalPrestamos: number
    prestamosActivos: number
    prestamosEnMora: number
    totalPagos: number
    totalNotificaciones: number
    notificacionesPendientes: number
    totalCasosJuridicos: number
    totalCapitalActivo: number
    totalInteresActivo: number
    totalSaldoPendiente: number
    totalMoraAcumulada: number
    pagosEsteMes: number
    tasaMorosidad: number
  }
  distribucionEstados: { estado: string; _count: number }[]
  ultimosPagos: any[]
  proximosVencimientos: any[]
  prestamosMora: any[]
}

export function Dashboard({ navigate }: { navigate: (v: any) => void }) {
  const { data, loading, error } = useFetch<DashboardData>('/api/dashboard')

  if (loading) return <LoadingState message="Cargando dashboard..." />
  if (error || !data) return <div className="text-red-600">Error: {error}</div>

  const { kpis, distribucionEstados, ultimosPagos, proximosVencimientos, prestamosMora } = data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen general del sistema de solicitudes"
        icon={TrendingUp}
        actions={
          <button
            onClick={() => navigate({ name: 'notificaciones' })}
            className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium hover:bg-amber-100"
          >
            <Bell className="w-3.5 h-3.5" />
            WhatsApp
            {kpis.notificacionesPendientes > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold">
                {kpis.notificacionesPendientes}
              </span>
            )}
          </button>
        }
      />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Clientes Activos"
          value={kpis.totalClientes}
          hint={`${kpis.clientesConPrestamosActivos} con solicitudes activos`}
          icon={Users}
          color="emerald"
        />
        <StatCard
          label="Solicitudes Activos"
          value={kpis.prestamosActivos}
          hint={`${kpis.totalPrestamos} total en sistema`}
          icon={FileText}
          color="blue"
        />
        <StatCard
          label="Saldo Pendiente"
          value={formatCOP(kpis.totalSaldoPendiente)}
          hint={`Capital: ${formatCOP(kpis.totalCapitalActivo)}`}
          icon={Wallet}
          color="purple"
        />
        <StatCard
          label="Tasa Morosidad"
          value={formatPercent(kpis.tasaMorosidad)}
          hint={`${kpis.prestamosEnMora} solicitudes en mora`}
          icon={AlertTriangle}
          color={kpis.tasaMorosidad > 10 ? 'red' : kpis.tasaMorosidad > 5 ? 'amber' : 'emerald'}
        />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pagos Registrados" value={kpis.totalPagos} icon={CreditCard} color="slate" />
        <StatCard label="Cobrado este mes" value={formatCOP(kpis.pagosEsteMes)} icon={TrendingUp} color="emerald" />
        <StatCard label="Notificaciones" value={kpis.totalNotificaciones} hint={`${kpis.notificacionesPendientes} pendientes`} icon={Bell} color="amber" />
        <StatCard label="Casos Jurídicos" value={kpis.totalCasosJuridicos} icon={Scale} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Próximos vencimientos */}
        <Card
          title="Próximos Vencimientos"
          subtitle="Siguientes 7 días"
          className="lg:col-span-2"
          actions={
            <button onClick={() => navigate({ name: 'prestamos' })} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          {proximosVencimientos.length === 0 ? (
            <EmptyState icon={Calendar} title="Sin vencimientos próximos" description="No hay solicitudes con vencimiento en los próximos 7 días." />
          ) : (
            <div className="divide-y divide-slate-100">
              {proximosVencimientos.map((v) => {
                const dias = diasEntre(v.fechaVencimiento)
                return (
                  <button
                    key={v.id}
                    onClick={() => navigate({ name: 'prestamo-detalle', id: v.id })}
                    className="w-full flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{v.cliente}</p>
                      <p className="text-xs text-slate-500">{v.codigo}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-semibold text-slate-900">{formatCOP(v.saldoTotal)}</p>
                      <Badge variant={dias <= 1 ? 'danger' : dias <= 3 ? 'warning' : 'info'}>
                        <Clock className="w-3 h-3 mr-1" />
                        {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Distribución por estado */}
        <Card title="Distribución de Solicitudes" subtitle="Por estado actual">
          {distribucionEstados.length === 0 ? (
            <EmptyState icon={FileText} title="Sin datos" />
          ) : (
            <div className="space-y-2">
              {distribucionEstados.map((d) => {
                const total = distribucionEstados.reduce((s, x) => s + x._count, 0)
                const pct = (d._count / total) * 100
                return (
                  <div key={d.estado}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{d.estado}</span>
                      <span className="text-slate-500">{d._count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Solicitudes en mora */}
        <Card
          title="Solicitudes en Mora"
          subtitle={`${prestamosMora.length} solicitudes vencidos`}
          actions={
            <button onClick={() => navigate({ name: 'juridicos' })} className="text-xs text-red-600 hover:underline flex items-center gap-1">
              Ver jurídica <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          {prestamosMora.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Sin morosidad" description="No hay solicitudes vencidos actualmente." />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {prestamosMora.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate({ name: 'prestamo-detalle', id: p.id })}
                  className="w-full flex items-center justify-between p-2 rounded-md bg-red-50 hover:bg-red-100 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.cliente}</p>
                    <p className="text-xs text-slate-500">{p.codigo} · {p.diasMora} días mora</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-sm font-semibold text-red-700">{formatCOP(p.saldoTotal)}</p>
                    {p.montoMora > 0 && <p className="text-xs text-red-600">Mora: {formatCOP(p.montoMora)}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Últimos pagos */}
        <Card
          title="Últimos Pagos"
          subtitle="Movimientos recientes"
          actions={
            <button onClick={() => navigate({ name: 'pagos' })} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          {ultimosPagos.length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin pagos registrados" />
          ) : (
            <div className="space-y-2">
              {ultimosPagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.clienteNombre}</p>
                    <p className="text-xs text-slate-500">
                      {p.codigoPrestamo} · {formatRelativeTime(p.fechaPago)}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-sm font-semibold text-emerald-700">{formatCOP(p.montoTotal)}</p>
                    <Badge variant={p.estado === 'CONFIRMADO' ? 'success' : p.estado === 'REVERSADO' ? 'danger' : 'warning'}>
                      {p.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
