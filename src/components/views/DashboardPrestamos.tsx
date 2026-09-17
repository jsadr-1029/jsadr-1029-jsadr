'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  FileText, AlertTriangle, Clock, CheckCircle, XCircle,
  TrendingUp, Users, Bell, ShieldAlert, Zap, ArrowRight,
  DollarSign, Calendar, Activity, Target,
} from 'lucide-react'
import { formatearMoneda, formatearFecha } from '@/lib/finanzas'

// =====================================================
// DashboardPrestamos
// Tablero de control del módulo Préstamos que muestra:
//  - Solicitudes pendientes (por prioridad)
//  - Préstamos activos vs en mora
//  - Notificaciones pendientes
//  - Acciones prioritarias sugeridas
//  - Resumen financiero del portafolio
// =====================================================

interface DashboardData {
  solicitudesPendientes: number
  prestamosActivos: number
  prestamosEnMora: number
  prestamosJuridico: number
  prestamosCancelados: number
  saldoTotalActivos: number
  totalMoraAcumulada: number
  clientesConMora: number
  notificacionesPendientes: number
  solicitudesPendienteAceptacion: number
  proximosVencimientos: number
  prioridades: PrioridadItem[]
}

interface PrioridadItem {
  nivel: 'ALTA' | 'MEDIA' | 'BAJA'
  titulo: string
  descripcion: string
  accion: string
  modulo: string
  cantidad: number
}

export function DashboardPrestamos({ onIrA }: { onIrA: (modulo: string, tab?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 60000) // auto-refresh cada 60s
    return () => clearInterval(interval)
  }, [])

  const cargar = async () => {
    try {
      setErrorCarga(null)
      // Cargar préstamos
      const resPrestamos = await fetch('/api/prestamos')
      if (!resPrestamos.ok) throw new Error(`HTTP ${resPrestamos.status} al cargar préstamos`)
      const jsonPrestamos = await resPrestamos.json()
      // Cargar notificaciones
      const resNotif = await fetch('/api/notificaciones')
      if (!resNotif.ok) throw new Error(`HTTP ${resNotif.status} al cargar notificaciones`)
      const jsonNotif = await resNotif.json()

      if (jsonPrestamos.success) {
        const prestamos = jsonPrestamos.data
        const solicitudesPendientes = prestamos.filter((p: any) => p.estado === 'SOLICITUD').length
        const prestamosActivos = prestamos.filter((p: any) => p.estado === 'ACTIVO').length
        const prestamosEnMora = prestamos.filter((p: any) => p.estado === 'EN_MORA').length
        const prestamosJuridico = prestamos.filter((p: any) => p.estado === 'JURIDICO').length
        const prestamosCancelados = prestamos.filter((p: any) => p.estado === 'CANCELADO').length
        const prestamosPendienteAceptacion = prestamos.filter((p: any) => p.estado === 'PENDIENTE_ACEPTACION').length

        const saldoTotalActivos = prestamos
          .filter((p: any) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA')
          .reduce((s: number, p: any) => s + (p.saldoTotal || 0), 0)

        const clientesConMora = prestamos.filter((p: any) => p.estado === 'EN_MORA').length
        const totalMoraAcumulada = prestamos
          .filter((p: any) => p.estado === 'EN_MORA')
          .reduce((s: number, p: any) => s + (p.montoMora || 0), 0)

        // Próximos vencimientos (próximos 7 días)
        const ahora = new Date()
        const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)
        const proximosVencimientos = prestamos.filter((p: any) => {
          if (!p.fechaVencimiento) return false
          const fecha = new Date(p.fechaVencimiento)
          return fecha >= ahora && fecha <= en7Dias && p.estado === 'ACTIVO'
        }).length

        // Notificaciones pendientes
        const notificaciones = jsonNotif.success ? (jsonNotif.data || []) : []
        const notifPendientes = notificaciones.filter((n: any) => n.estado === 'PENDIENTE' || n.estado === 'PENDIENTE_MANUAL').length

        // === Construir lista de prioridades ===
        const prioridades: PrioridadItem[] = []

        if (prestamosPendienteAceptacion > 0) {
          prioridades.push({
            nivel: 'ALTA',
            titulo: 'Préstamos pendientes de aceptación T&C',
            descripcion: `${prestamosPendienteAceptacion} préstamo(s) esperando que el cliente acepte términos y condiciones`,
            accion: 'Revisar solicitudes',
            modulo: 'solicitudes',
            cantidad: prestamosPendienteAceptacion,
          })
        }

        if (prestamosEnMora > 0) {
          prioridades.push({
            nivel: 'ALTA',
            titulo: 'Préstamos en mora',
            descripcion: `${prestamosEnMora} préstamo(s) en mora con ${formatearMoneda(totalMoraAcumulada)} acumulada`,
            accion: 'Gestionar cobro',
            modulo: 'pagos',
            cantidad: prestamosEnMora,
          })
        }

        if (prestamosJuridico > 0) {
          prioridades.push({
            nivel: 'ALTA',
            titulo: 'Préstamos en cobro jurídico',
            descripcion: `${prestamosJuridico} préstamo(s) en proceso jurídico activo`,
            accion: 'Revisar casos',
            modulo: 'juridico',
            cantidad: prestamosJuridico,
          })
        }

        if (solicitudesPendientes > 0) {
          prioridades.push({
            nivel: 'MEDIA',
            titulo: 'Solicitudes nuevas pendientes',
            descripcion: `${solicitudesPendientes} solicitud(es) esperando aprobación`,
            accion: 'Revisar solicitudes',
            modulo: 'solicitudes',
            cantidad: solicitudesPendientes,
          })
        }

        if (proximosVencimientos > 0) {
          prioridades.push({
            nivel: 'MEDIA',
            titulo: 'Vencimientos próximos (7 días)',
            descripcion: `${proximosVencimientos} préstamo(s) con vencimiento en los próximos 7 días`,
            accion: 'Ver próximos pagos',
            modulo: 'pagos',
            cantidad: proximosVencimientos,
          })
        }

        if (notifPendientes > 0) {
          prioridades.push({
            nivel: 'MEDIA',
            titulo: 'Notificaciones pendientes de envío',
            descripcion: `${notifPendientes} notificación(es) sin enviar`,
            accion: 'Enviar notificaciones',
            modulo: 'notificaciones',
            cantidad: notifPendientes,
          })
        }

        setData({
          solicitudesPendientes,
          prestamosActivos,
          prestamosEnMora,
          prestamosJuridico,
          prestamosCancelados,
          saldoTotalActivos,
          totalMoraAcumulada,
          clientesConMora,
          notificacionesPendientes: notifPendientes,
          solicitudesPendienteAceptacion: prestamosPendienteAceptacion,
          proximosVencimientos,
          prioridades,
        })
      }
    } catch (e: any) {
      console.error('Error cargando dashboard:', e)
      setErrorCarga(e.message || 'Error desconocido al cargar el tablero')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          Cargando tablero de control...
        </CardContent>
      </Card>
    )
  }

  if (errorCarga && !data) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="py-12 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <div>
            <p className="font-semibold text-red-700">Error cargando el tablero</p>
            <p className="text-sm text-muted-foreground mt-1">{errorCarga}</p>
          </div>
          <Button variant="outline" size="sm" onClick={cargar}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const prioridadColor = {
    ALTA: 'bg-red-500/15 text-red-400 border-red-500/30',
    MEDIA: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    BAJA: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }

  const prioridadIcon = {
    ALTA: <ShieldAlert className="w-4 h-4" />,
    MEDIA: <Clock className="w-4 h-4" />,
    BAJA: <Bell className="w-4 h-4" />,
  }

  return (
    <div className="space-y-4">
      {/* === Título del dashboard === */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Tablero de Control — Préstamos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estado general del módulo. Enfócate en las prioridades de mayor urgencia.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar}>
          <Activity className="w-3.5 h-3.5 mr-1.5" />
          Actualizar
        </Button>
      </div>

      {/* === KPIs principales (4 tarjetas) === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Activos</p>
                <p className="text-2xl font-bold text-blue-400">{data.prestamosActivos}</p>
              </div>
              <CheckCircle className="w-6 h-6 text-blue-400/50" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Saldo: {formatearMoneda(data.saldoTotalActivos)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">En Mora</p>
                <p className="text-2xl font-bold text-red-400">{data.prestamosEnMora}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-400/50" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Mora: {formatearMoneda(data.totalMoraAcumulada)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Pendientes</p>
                <p className="text-2xl font-bold text-amber-400">
                  {data.solicitudesPendientes + data.solicitudesPendienteAceptacion}
                </p>
              </div>
              <Clock className="w-6 h-6 text-amber-400/50" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {data.solicitudesPendientes} nuevas · {data.solicitudesPendienteAceptacion} T&C
            </p>
          </CardContent>
        </Card>

        <Card className="bg-violet-500/5 border-violet-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Jurídico</p>
                <p className="text-2xl font-bold text-violet-400">{data.prestamosJuridico}</p>
              </div>
              <ShieldAlert className="w-6 h-6 text-violet-400/50" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Casos en cobro jurídico
            </p>
          </CardContent>
        </Card>
      </div>

      {/* === Sección: Prioridades de acción === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Prioridades de Acción
            <Badge variant="outline" className="text-[10px]">
              {data.prioridades.length} tareas
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.prioridades.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              ¡Todo al día! No hay tareas prioritarias pendientes.
            </div>
          ) : (
            data.prioridades.map((p, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${prioridadColor[p.nivel]}`}
              >
                <div className="shrink-0 mt-0.5">
                  {prioridadIcon[p.nivel]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${prioridadColor[p.nivel]}`}>
                      {p.nivel}
                    </Badge>
                    <span className="text-xs font-semibold">{p.cantidad}</span>
                  </div>
                  <p className="text-sm font-medium mt-0.5">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => onIrA(p.modulo)}
                >
                  {p.accion}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* === Sección: Resumen rápido === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-[10px] text-muted-foreground">Clientes en mora</p>
            <p className="text-lg font-bold">{data.clientesConMora}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <p className="text-[10px] text-muted-foreground">Vencimientos 7 días</p>
            <p className="text-lg font-bold">{data.proximosVencimientos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Bell className="w-5 h-5 mx-auto mb-1 text-amber-400" />
            <p className="text-[10px] text-muted-foreground">Notif. pendientes</p>
            <p className="text-lg font-bold">{data.notificacionesPendientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
            <p className="text-[10px] text-muted-foreground">Cancelados</p>
            <p className="text-lg font-bold">{data.prestamosCancelados}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
