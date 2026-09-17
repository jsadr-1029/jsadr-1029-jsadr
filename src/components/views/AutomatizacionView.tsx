'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Zap,
  Bell,
  Clock,
  Mail,
  MessageSquare,
  TrendingDown,
  FileCheck,
  AlertTriangle,
  Plus,
  Bot as BotIcon,
  Plug,
} from 'lucide-react'
import { BotsView } from '@/components/views/BotsView'
import { ConexionesPanel } from '@/components/views/ConexionesPanel'

interface Regla {
  id: string
  nombre: string
  descripcion: string
  modulo: string
  trigger: string
  accion: string
  activa: boolean
  ejecuciones: number
  ultimaEjecucion: string | null
}

const reglasIniciales: Regla[] = [
  {
    id: 'r1',
    nombre: 'Recordatorio de pago',
    descripcion: 'Envía WhatsApp 3 días antes del vencimiento de cada cuota',
    modulo: 'Pagos',
    trigger: 'Cuota vence en 3 días',
    accion: 'WhatsApp automático',
    activa: true,
    ejecuciones: 1247,
    ultimaEjecucion: '2025-01-15 09:30',
  },
  {
    id: 'r2',
    nombre: 'Alerta de mora',
    descripcion: 'Marca préstamo como EN_MORA al día siguiente del vencimiento',
    modulo: 'Préstamos',
    trigger: 'Cuota vencida 1 día',
    accion: 'Cambiar estado + notificar',
    activa: true,
    ejecuciones: 89,
    ultimaEjecucion: '2025-01-15 00:05',
  },
  {
    id: 'r3',
    nombre: 'Escalamiento jurídico',
    descripcion: 'Crea caso jurídico tras 30 días de mora sin pago',
    modulo: 'Jurídico',
    trigger: 'Días de mora >= 30',
    accion: 'Abrir caso + asignar abogado',
    activa: true,
    ejecuciones: 12,
    ultimaEjecucion: '2025-01-12 14:20',
  },
  {
    id: 'r4',
    nombre: 'Confirmación de pago',
    descripcion: 'Envía email + WhatsApp al registrar un pago',
    modulo: 'Pagos',
    trigger: 'Pago registrado',
    accion: 'Email + WhatsApp',
    activa: true,
    ejecuciones: 892,
    ultimaEjecucion: '2025-01-15 11:45',
  },
  {
    id: 'r5',
    nombre: 'Recibo de pagare',
    descripcion: 'Genera PDF del pagaré al aprobar un préstamo',
    modulo: 'Préstamos',
    trigger: 'Préstamo aprobado',
    accion: 'Generar documento PDF',
    activa: false,
    ejecuciones: 56,
    ultimaEjecucion: '2025-01-10 16:00',
  },
  {
    id: 'r6',
    nombre: 'Reporte semanal',
    descripcion: 'Envía resumen semanal de cartera al administrador',
    modulo: 'Reportes',
    trigger: 'Cada lunes 08:00',
    accion: 'Email con dashboard',
    activa: true,
    ejecuciones: 24,
    ultimaEjecucion: '2025-01-13 08:00',
  },
]

const plantillas = [
  { nombre: 'Notificación WhatsApp', icon: MessageSquare, color: 'text-emerald-300' },
  { nombre: 'Email transaccional', icon: Mail, color: 'text-sky-300' },
  { nombre: 'Cambio de estado', icon: TrendingDown, color: 'text-amber-300' },
  { nombre: 'Generación de documento', icon: FileCheck, color: 'text-violet-300' },
  { nombre: 'Alerta crítica', icon: AlertTriangle, color: 'text-red-300' },
  { nombre: 'Tarea programada', icon: Clock, color: 'text-cyan-300' },
]

export function AutomatizacionView() {
  const [reglas, setReglas] = useState<Regla[]>(reglasIniciales)
  const [tab, setTab] = useState('reglas')
  const { toast } = useToast()

  const toggleRegla = (id: string) => {
    setReglas((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nueva = !r.activa
          toast({
            title: nueva ? 'Regla activada' : 'Regla desactivada',
            description: r.nombre,
          })
          return { ...r, activa: nueva }
        }
        return r
      })
    )
  }

  const activas = reglas.filter((r) => r.activa).length
  const totalEjecuciones = reglas.reduce((acc, r) => acc + r.ejecuciones, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatización"
        subtitle="Reglas, workflows, notificaciones automáticas y bots del sistema"
        icon={<Zap className="w-5 h-5" />}
        actions={
          tab === 'reglas' ? (
            <Button>
              <Plus className="w-4 h-4" />
              Nueva regla
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="reglas">
            <Zap className="w-4 h-4 mr-1.5" />
            Reglas
          </TabsTrigger>
          <TabsTrigger value="bots">
            <BotIcon className="w-4 h-4 mr-1.5" />
            Bots
          </TabsTrigger>
          <TabsTrigger value="conexiones">
            <Plug className="w-4 h-4 mr-1.5" />
            Conexiones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reglas" className="space-y-6 mt-4">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white shadow-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activas}</p>
              <p className="text-xs text-muted-foreground">Reglas activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalEjecuciones.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Ejecuciones totales</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reglas.length}</p>
              <p className="text-xs text-muted-foreground">Workflows configurados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de reglas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reglas de automatización</CardTitle>
          <CardDescription>
            Activa o desactiva los workflows automáticos del sistema bancario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reglas.map((regla) => (
            <div
              key={regla.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    regla.activa
                      ? 'gradient-primary text-white'
                      : 'bg-white/5 text-muted-foreground'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{regla.nombre}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {regla.modulo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{regla.descripcion}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                    <span>
                      <span className="text-foreground/70 font-medium">Trigger:</span>{' '}
                      {regla.trigger}
                    </span>
                    <span>
                      <span className="text-foreground/70 font-medium">Acción:</span>{' '}
                      {regla.accion}
                    </span>
                    <span>
                      <span className="text-foreground/70 font-medium">Ejecuciones:</span>{' '}
                      {regla.ejecuciones.toLocaleString()}
                    </span>
                    {regla.ultimaEjecucion && (
                      <span>
                        <span className="text-foreground/70 font-medium">Última:</span>{' '}
                        {regla.ultimaEjecucion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge
                  variant={regla.activa ? 'default' : 'outline'}
                  className="text-[10px]"
                >
                  {regla.activa ? 'Activa' : 'Inactiva'}
                </Badge>
                <Switch checked={regla.activa} onCheckedChange={() => toggleRegla(regla.id)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Plantillas rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plantillas de automatización</CardTitle>
          <CardDescription>Crea nuevas reglas a partir de plantillas preconfiguradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {plantillas.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.nombre}
                  onClick={() =>
                    toast({
                      title: 'Plantilla seleccionada',
                      description: p.nombre,
                    })
                  }
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-0.5 transition-all text-center"
                >
                  <Icon className={`w-6 h-6 ${p.color}`} />
                  <span className="text-xs font-medium">{p.nombre}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="bots" className="mt-4">
          <BotsView />
        </TabsContent>

        <TabsContent value="conexiones" className="mt-4">
          <ConexionesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
