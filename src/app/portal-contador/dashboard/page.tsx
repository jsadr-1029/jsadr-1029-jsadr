'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  FileWarning,
  CalendarClock,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  PiggyBank,
  Plus,
} from 'lucide-react'
import { useContadorAuth, apiContador } from '../componentes/contador-auth-provider'
import { PageHeader, KpiCard, formatCOP, formatDate, EmptyState } from '../componentes/ui-contador'
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

interface DashboardData {
  kpis: {
    empresasActivas: number
    totalEmpresas: number
    declaracionesPendientes: number
    periodosAbiertos: number
    comprobantesBorrador: number
  }
  indicadoresFinancieros: {
    activos: number
    pasivos: number
    patrimonio: number
    ingresos: number
    gastos: number
    costos: number
    utilidad: number
  }
  declaracionesProximas: Array<{
    id: string
    tipo: string
    periodoFiscal: string
    fechaVencimiento: string | null
    valorAPagar: number
    estado: string
  }>
  ultimosComprobantes: Array<{
    id: string
    numero: string
    tipo: string
    concepto: string
    totalDebitos: number
    estado: string
    createdAt: string
    periodo: { anio: number; mes: number } | null
  }>
  tercerosPorTipo: Array<{ tipoTercero: string; _count: number }>
}

export default function DashboardContadorPage() {
  const { user, empresaId, loading: authLoading } = useContadorAuth()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    if (!empresaId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    apiContador(`/api/portal-contador/dashboard?empresaId=${empresaId}`)
      .then((r) => {
        if (r.ok) setData(r.data.data)
        else setError(r.error || 'No se pudo cargar el dashboard.')
      })
      .finally(() => setLoading(false))
  }, [authLoading, user, empresaId])

  if (authLoading) return null

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Dashboard contable"
        descripcion={`Bienvenido, ${user?.nombre}. Resumen operativo y financiero de la empresa seleccionada.`}
      />

      {!empresaId && (
        <EmptyState
          titulo="No hay empresa seleccionada"
          descripcion="Para ver indicadores, selecciona o crea una empresa en el módulo de Empresas."
          accion={
            <Button onClick={() => router.push('/portal-contador/empresas')} className="gap-2">
              <Plus className="h-4 w-4" /> Ir a empresas
            </Button>
          }
        />
      )}

      {empresaId && loading && (
        <div className="text-sm text-slate-500">Cargando indicadores…</div>
      )}

      {empresaId && error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {empresaId && data && (
        <div className="space-y-6">
          {/* KPIs operativos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              titulo="Empresas activas"
              valor={data.kpis.empresasActivas}
              descripcion={`${data.kpis.totalEmpresas} en total`}
              icon={Building2}
              accent="sky"
            />
            <KpiCard
              titulo="Declaraciones pend."
              valor={data.kpis.declaracionesPendientes}
              descripcion="Por presentar"
              icon={FileWarning}
              accent="amber"
            />
            <KpiCard
              titulo="Períodos abiertos"
              valor={data.kpis.periodosAbiertos}
              descripcion="Listos para registrar"
              icon={CalendarClock}
              accent="emerald"
            />
            <KpiCard
              titulo="Comprobantes borrador"
              valor={data.kpis.comprobantesBorrador}
              descripcion="Pendientes de aprobar"
              icon={FileText}
              accent="violet"
            />
            <KpiCard
              titulo="Terceros"
              valor={data.tercerosPorTipo.reduce((a, b) => a + b._count, 0)}
              descripcion="En la empresa"
              icon={Building2}
              accent="slate"
            />
          </div>

          {/* Indicadores financieros */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Indicadores financieros
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                titulo="Activos"
                valor={formatCOP(data.indicadoresFinancieros.activos)}
                icon={Wallet}
                accent="sky"
              />
              <KpiCard
                titulo="Pasivos"
                valor={formatCOP(data.indicadoresFinancieros.pasivos)}
                icon={TrendingDown}
                accent="rose"
              />
              <KpiCard
                titulo="Patrimonio"
                valor={formatCOP(data.indicadoresFinancieros.patrimonio)}
                icon={Landmark}
                accent="emerald"
              />
              <KpiCard
                titulo="Utilidad del período"
                valor={formatCOP(data.indicadoresFinancieros.utilidad)}
                descripcion={`Ingresos ${formatCOP(data.indicadoresFinancieros.ingresos)} · Gastos ${formatCOP(data.indicadoresFinancieros.gastos + data.indicadoresFinancieros.costos)}`}
                icon={data.indicadoresFinancieros.utilidad >= 0 ? TrendingUp : TrendingDown}
                accent={data.indicadoresFinancieros.utilidad >= 0 ? 'emerald' : 'rose'}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Declaraciones próximas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Declaraciones próximas a vencer</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/portal-contador/declaraciones')}
                >
                  Ver todas
                </Button>
              </CardHeader>
              <CardContent>
                {data.declaracionesProximas.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No hay declaraciones próximas a vencer (30 días).
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.declaracionesProximas.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.tipo}</TableCell>
                          <TableCell>{d.periodoFiscal}</TableCell>
                          <TableCell>{formatDate(d.fechaVencimiento)}</TableCell>
                          <TableCell className="text-right">{formatCOP(d.valorAPagar)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Últimos comprobantes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Últimos comprobantes</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/portal-contador/contabilidad')}
                >
                  Ver todos
                </Button>
              </CardHeader>
              <CardContent>
                {data.ultimosComprobantes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Aún no se han registrado comprobantes.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ultimosComprobantes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{c.concepto}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.estado}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCOP(c.totalDebitos)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resumen terceros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terceros por tipo</CardTitle>
            </CardHeader>
            <CardContent>
              {data.tercerosPorTipo.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No hay terceros registrados.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {data.tercerosPorTipo.map((t) => (
                    <div
                      key={t.tipoTercero}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"
                    >
                      <p className="text-xs text-slate-500">{t.tipoTercero}</p>
                      <p className="text-xl font-bold text-slate-900">{t._count}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
