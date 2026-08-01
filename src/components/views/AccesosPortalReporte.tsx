'use client'

import { useEffect, useState } from 'react'
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
import { formatearFechaHora } from '@/lib/finanzas'
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
  Legend,
} from 'recharts'
import {
  Users,
  UserCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Activity,
  DoorOpen,
  BarChart3,
} from 'lucide-react'

interface AccesoPortal {
  id: string
  clienteId: string | null
  clienteCedula: string | null
  clienteNombre: string | null
  ipOrigen: string | null
  userAgent: string | null
  accion: string
  exito: boolean
  detalle: string | null
  metadata: string | null
  createdAt: string
}

interface AccesosData {
  accesos: AccesoPortal[]
  kpis: {
    totalRegistros: number
    totalHoy: number
    intentosFallidosHoy: number
    loginsExitososHoy: number
    clientesUnicosHoy: number
    clientesUnicosRango: number
    intentosFallidosRango: number
  }
  resumen: {
    topClientes: {
      clienteCedula: string | null
      clienteNombre: string | null
      _count: number
    }[]
    porAccion: { accion: string; _count: number }[]
    porDia: { fecha: string; logins: number; consultas: number; fallidos: number }[]
    porDispositivo: { name: string; value: number }[]
  }
}

const OPCIONES_DIAS = [7, 15, 30, 60, 90]

const COLORES_GRAFICO = [
  '#a78bfa', // violeta
  '#22d3ee', // cyan
  '#34d399', // esmeralda
  '#fbbf24', // ámbar
  '#fb7185', // rosa
  '#60a5fa', // azul
]

const ACCION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  CONSULTA: 'Consulta',
  INTENTO_FALLIDO: 'Intento fallido',
  LOGOUT: 'Logout',
  CAMBIO_PIN: 'Cambio PIN',
  VERIFICAR_CEDULA: 'Verificar cédula',
}

const DISPOSITIVO_ICON: Record<string, any> = {
  Móvil: Smartphone,
  Tablet: Tablet,
  Escritorio: Monitor,
  Otro: Globe,
}

export function AccesosPortalReporte() {
  const [data, setData] = useState<AccesosData | null>(null)
  const [dias, setDias] = useState(30)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    cargar()
  }, [dias])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/accesos-portal?dias=${dias}&limit=500`)
      const json = await res.json()
      if (json.success) {
        setData({
          accesos: json.data,
          kpis: json.kpis,
          resumen: json.resumen,
        })
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
      <Card className="glass-card">
        <CardContent className="p-10 text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando accesos al portal...</p>
        </CardContent>
      </Card>
    )
  }

  const { kpis, resumen, accesos } = data

  const porAccionData = resumen.porAccion.map((a) => ({
    name: ACCION_LABELS[a.accion] || a.accion,
    value: a._count,
  }))

  const porDiaData = resumen.porDia.map((d) => ({
    ...d,
    fechaCorta: new Date(d.fecha).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
    }),
  }))

  return (
    <div className="space-y-4">
      {/* Header con filtro de días */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-primary" />
                Accesos al Portal del Cliente
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Monitorea la actividad del portal en tiempo real
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Periodo:</span>
              <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                {OPCIONES_DIAS.map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={dias === d ? 'default' : 'ghost'}
                    onClick={() => setDias(d)}
                    className={`h-7 px-3 text-xs ${
                      dias === d
                        ? 'gradient-primary text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={cargar} className="h-8">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total accesos</p>
                <p className="text-xl font-bold">{kpis.totalRegistros}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Únicos (rango)</p>
                <p className="text-xl font-bold">{kpis.clientesUnicosRango}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Accesos hoy</p>
                <p className="text-xl font-bold">{kpis.totalHoy}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fallidos (rango)</p>
                <p className="text-xl font-bold text-rose-300">
                  {kpis.intentosFallidosRango}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras: actividad por día */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Actividad por día
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porDiaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porDiaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="fechaCorta" fontSize={11} stroke="rgba(255,255,255,0.5)" />
                <YAxis fontSize={11} stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 20, 35, 0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="logins" name="Logins" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consultas" name="Consultas" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fallidos" name="Fallidos" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No hay actividad registrada en los últimos {dias} días
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pie charts: por tipo y por dispositivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Por tipo de acción
            </CardTitle>
          </CardHeader>
          <CardContent>
            {porAccionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={porAccionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {porAccionData.map((_, i) => (
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
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              Por dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumen.porDispositivo.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={resumen.porDispositivo}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                    labelLine={false}
                  >
                    {resumen.porDispositivo.map((_, i) => (
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
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de dispositivo
              </div>
            )}
            {/* Detalle de dispositivos */}
            <div className="mt-3 flex flex-wrap gap-2">
              {resumen.porDispositivo.map((d, i) => {
                const Icon = DISPOSITIVO_ICON[d.name] || Globe
                const total = resumen.porDispositivo.reduce((s, x) => s + x.value, 0)
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                return (
                  <Badge
                    key={d.name}
                    variant="outline"
                    className="bg-white/5"
                    style={{ borderColor: COLORES_GRAFICO[i % COLORES_GRAFICO.length] + '60' }}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {d.name}: {d.value} ({pct}%)
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 15 clientes */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Top 15 clientes más activos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Cédula</TableHead>
                  <TableHead className="text-right text-muted-foreground">Accesos</TableHead>
                  <TableHead className="text-right text-muted-foreground">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.topClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay actividad de clientes registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  resumen.topClientes.map((c, i) => {
                    const pct =
                      kpis.totalRegistros > 0
                        ? ((c._count / kpis.totalRegistros) * 100).toFixed(1)
                        : '0'
                    return (
                      <TableRow key={i} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {i + 1}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {c.clienteNombre || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {c.clienteCedula || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold">
                          {c._count}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {pct}%
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

      {/* Log detallado */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Registro detallado de accesos
            <Badge variant="outline" className="ml-2 text-xs bg-white/5">
              {accesos.length} registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Acción</TableHead>
                  <TableHead className="text-muted-foreground">IP</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-muted-foreground">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accesos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay accesos registrados en este periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  accesos.slice(0, 200).map((a) => (
                    <TableRow
                      key={a.id}
                      className={`border-white/5 hover:bg-white/5 ${
                        !a.exito ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatearFechaHora(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{a.clienteNombre || 'Anónimo'}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {a.clienteCedula || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-white/5">
                          {ACCION_LABELS[a.accion] || a.accion}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {a.ipOrigen || '—'}
                      </TableCell>
                      <TableCell>
                        {a.exito ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Éxito
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Fallido
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {a.detalle || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
