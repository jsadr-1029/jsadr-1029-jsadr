'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import { Bell, CheckCircle, XCircle, Send, ExternalLink, Clock } from 'lucide-react'

interface Notificacion {
  id: string
  clienteTelefono: string
  tipo: string
  mensaje: string
  estado: string
  error: string | null
  linkWaMe: string | null
  fechaEnvio: string
  prestamo?: { codigo: string; cliente: { nombre: string } } | null
}

const TIPO_CONFIG: Record<string, { label: string; color: string }> = {
  SOLICITUD: { label: 'Solicitud', color: 'bg-blue-100 text-blue-800' },
  PAGO: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800' },
  CANCELACION: { label: 'Cancelación', color: 'bg-green-100 text-green-800' },
  RECORDATORIO: { label: 'Recordatorio', color: 'bg-amber-100 text-amber-800' },
  MORA: { label: 'Mora', color: 'bg-orange-100 text-orange-800' },
  LEGAL: { label: 'Legal', color: 'bg-red-100 text-red-800' },
  TYC: { label: 'T&C', color: 'bg-purple-100 text-purple-800' },
  OTP: { label: 'OTP', color: 'bg-indigo-100 text-indigo-800' },
  CAMPANA: { label: 'Campaña', color: 'bg-pink-100 text-pink-800' },
}

export function NotificacionesView() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('all')
  const [filtroEstado, setFiltroEstado] = useState('all')
  const { toast } = useToast()

  useEffect(() => {
    cargar()
  }, [filtroTipo, filtroEstado])

  const cargar = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtroTipo !== 'all') params.append('tipo', filtroTipo)
      if (filtroEstado !== 'all') params.append('estado', filtroEstado)
      const res = await fetch(`/api/notificaciones?${params}`)
      const json = await res.json()
      if (json.success) setNotificaciones(json.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Marcar notificación como ENVIADA después de abrir WhatsApp
  const marcarComoEnviado = async (id: string) => {
    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: 'ENVIADO' }),
      })
      toast({
        title: 'WhatsApp abierto',
        description: 'Se abrió WhatsApp con el mensaje. Marca como enviado.',
      })
      cargar()
    } catch (e: any) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        subtitle="Historial de mensajes WhatsApp enviados"
        icon={<Bell className="w-5 h-5" />}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="SOLICITUD">Solicitud</SelectItem>
            <SelectItem value="TYC">T&C</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="CANCELACION">Cancelación</SelectItem>
            <SelectItem value="RECORDATORIO">Recordatorio</SelectItem>
            <SelectItem value="MORA">Mora</SelectItem>
            <SelectItem value="LEGAL">Legal</SelectItem>
            <SelectItem value="OTP">OTP Firma</SelectItem>
            <SelectItem value="CAMPANA">Campaña</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PENDIENTE_MANUAL">⏳ Pendiente Manual</SelectItem>
            <SelectItem value="ENVIADO">Enviado</SelectItem>
            <SelectItem value="FALLIDO">Fallido</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando...</div>
            ) : notificaciones.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p>No hay notificaciones con estos filtros</p>
              </div>
            ) : (
              <div className="divide-y">
                {notificaciones.map((n) => {
                  const cfg = TIPO_CONFIG[n.tipo] || { label: n.tipo, color: 'bg-gray-100 text-gray-800' }
                  const esPendienteManual = n.estado === 'PENDIENTE_MANUAL' && n.linkWaMe
                  return (
                    <div key={n.id} className="p-4 hover:bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {n.estado === 'ENVIADO' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          ) : esPendienteManual ? (
                            <Clock className="w-5 h-5 text-amber-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                n.estado === 'ENVIADO'
                                  ? 'text-emerald-700'
                                  : esPendienteManual
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {n.estado === 'PENDIENTE_MANUAL' ? '⏳ Pendiente envío manual' : n.estado}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatearFechaHora(n.fechaEnvio)}
                            </span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {n.clienteTelefono}
                            </span>
                          </div>
                          {n.prestamo && (
                            <div className="text-xs text-muted-foreground mb-1">
                              {n.prestamo.cliente.nombre} · {n.prestamo.codigo}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap text-foreground/80">
                            {n.mensaje}
                          </p>
                          {esPendienteManual && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-amber-800 flex-1 min-w-0">
                                💬 Este mensaje no se envió automáticamente. Haz clic para abrir
                                WhatsApp con el mensaje pre-cargado y enviarlo al cliente.
                              </p>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-7"
                                onClick={() => {
                                  window.open(n.linkWaMe!, '_blank')
                                  marcarComoEnviado(n.id)
                                }}
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Abrir WhatsApp
                              </Button>
                            </div>
                          )}
                          {n.error && n.estado !== 'PENDIENTE_MANUAL' && (
                            <p className="text-xs text-red-600 mt-1">⚠️ {n.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
