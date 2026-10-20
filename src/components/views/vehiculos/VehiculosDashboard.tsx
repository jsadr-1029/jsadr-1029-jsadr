'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Car, Users, FileText, Clock } from 'lucide-react'
import { apiFetch, formatCOP, EstadoBadge } from './helpers'

export function VehiculosDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/vehiculos/dashboard').then(r => {
      if (r.success && r.data) setData(r.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando dashboard...</div>
  if (!data) return <div className="text-center py-8 text-red-600">Error al cargar datos</div>

  const k = data.kpis

  const kpis = [
    { label: 'Vehículos', value: k.totalVehiculos, sub: `${k.vehiculosDisponibles} disponibles · ${k.vehiculosAsignados} asignados`, icon: Car, color: 'text-blue-600' },
    { label: 'Conductores', value: k.totalConductores, icon: Users, color: 'text-green-600' },
    { label: 'Contratos activos', value: k.contratosActivos, icon: FileText, color: 'text-purple-600' },
    { label: 'Ingresos facturados', value: formatCOP(k.ingresosFacturados), sub: `+multas ${formatCOP(k.multasFacturadas)}`, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Dinero recibido', value: formatCOP(k.dineroRecibido), icon: DollarSign, color: 'text-green-700' },
    { label: 'Pendiente verificar', value: `${k.pagosPendientesVerificar} pagos`, sub: formatCOP(k.montoPendienteVerificar), icon: Clock, color: 'text-orange-600' },
    { label: 'Cartera vencida', value: formatCOP(k.montoCarteraVencida), sub: `${k.carteraVencidaCount} obligaciones`, icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Gastos', value: formatCOP(k.totalGastos + k.totalMantenimientos), icon: TrendingDown, color: 'text-red-700' },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border shadow-sm">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="mt-1 text-lg md:text-2xl font-bold">{kpi.value}</div>
              {kpi.sub && <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rentabilidad por vehículo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rentabilidad por vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rentabilidadPorVehiculo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay vehículos registrados.</p>
          ) : (
            <div className="space-y-2">
              {data.rentabilidadPorVehiculo.map((v: any) => (
                <div key={v.vehiculoId} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2 rounded border text-sm">
                  <div className="font-medium col-span-2">{v.marca} {v.modelo} <span className="text-muted-foreground">({v.placa})</span></div>
                  <div className="text-emerald-700">Facturado: {formatCOP(v.facturado)}</div>
                  <div className="text-green-700">Recibido: {formatCOP(v.recibido)}</div>
                  <div className={v.rentabilidad >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                    Rentabilidad: {formatCOP(v.rentabilidad)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas críticas */}
      {data.alertasCriticas.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" /> Alertas críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.alertasCriticas.map((a: any) => (
                <div key={a.id} className="p-2 bg-red-50 rounded border border-red-200 text-sm">
                  <div className="font-medium">{a.titulo}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.descripcion}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contratos activos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratos activos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.contratosActivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay contratos activos.</p>
          ) : (
            <div className="space-y-2">
              {data.contratosActivos.map((c: any) => (
                <div key={c.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2 rounded border text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Contrato</div>
                    <div className="font-medium">{c.numero}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Conductor</div>
                    <div>{c.conductor} <span className="text-muted-foreground">({c.cedula})</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Vehículo</div>
                    <div>{c.vehiculo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tarifa</div>
                    <div>{formatCOP(c.tarifa)} <span className="text-muted-foreground">/ {c.modalidad}</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Estado</div>
                    <EstadoBadge estado={c.estado} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
