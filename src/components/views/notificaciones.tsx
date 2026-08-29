'use client'

import { useState, useEffect } from 'react'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { formatRelativeTime, formatDate } from '@/lib/format'
import { Bell, Send, Check, ExternalLink, Search, Clock, CheckCircle2, AlertCircle, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export function NotificacionesView() {
  const [estado, setEstado] = useState('PENDIENTE_MANUAL')
  const [tipo, setTipo] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState<any>(null)

  const handleEstadoChange = (v: string) => { setEstado(v); setPage(1) }
  const handleTipoChange = (v: string) => { setTipo(v); setPage(1) }

  const query = new URLSearchParams({
    estado: estado === 'TODOS' ? '' : estado,
    tipo: tipo === 'TODOS' ? '' : tipo,
    page: String(page),
    pageSize: '50',
  }).toString()

  const { data, loading } = useFetch<{ notificaciones: any[]; total: number; totalPages: number }>(
    `/api/notificaciones?${query}`,
    { refreshKey }
  )

  const marcarEnviado = async (id: string) => {
    try {
      await apiPost(`/api/notificaciones/${id}/enviar`, {})
      toast.success('Marcado como enviado')
      setRefreshKey(k => k + 1)
    } catch (e) {
      toast.error('Error: ' + (e as Error).message)
    }
  }

  const pendientes = data?.notificaciones?.filter(n => n.estado === 'PENDIENTE_MANUAL').length || 0
  const enviadas = data?.notificaciones?.filter(n => n.estado === 'ENVIADO').length || 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Buzón de Notificaciones WhatsApp"
        subtitle={`${data?.total || 0} notificaciones · ${pendientes} pendientes`}
        icon={Bell}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={pendientes > 0 ? 'warning' : 'success'}>
              <Clock className="w-3 h-3 mr-1" />
              {pendientes} pendientes
            </Badge>
          </div>
        }
      />

      {/* Filtros */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={estado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estados</SelectItem>
              <SelectItem value="PENDIENTE_MANUAL">Pendientes</SelectItem>
              <SelectItem value="ENVIADO">Enviados</SelectItem>
              <SelectItem value="FALLIDO">Fallidos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={handleTipoChange}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los tipos</SelectItem>
              <SelectItem value="SOLICITUD">Solicitud</SelectItem>
              <SelectItem value="APROBACION">Aprobación</SelectItem>
              <SelectItem value="DESEMBOLSO">Desembolso</SelectItem>
              <SelectItem value="RECORDATORIO_PAGO">Recordatorio</SelectItem>
              <SelectItem value="MORA">Mora</SelectItem>
              <SelectItem value="PAGO_CONFIRMADO">Pago confirmado</SelectItem>
              <SelectItem value="OTP">OTP</SelectItem>
              <SelectItem value="JURIDICO">Jurídico</SelectItem>
              <SelectItem value="ESTADO_CUENTA">Estado cuenta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista */}
        <Card className="lg:col-span-2">
          {loading ? (
            <LoadingState />
          ) : !data?.notificaciones.length ? (
            <EmptyState icon={Bell} title="Sin notificaciones" description="No hay notificaciones con estos filtros." />
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {data.notificaciones.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected?.id === n.id
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                  onClick={() => setSelected(n)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="info">{n.tipo}</Badge>
                      <span className="text-xs text-slate-500 truncate">
                        {n.prestamo?.cliente?.nombre || n.clienteTelefono}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {n.estado === 'PENDIENTE_MANUAL' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                      {n.estado === 'ENVIADO' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {n.estado === 'FALLIDO' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      <span className="text-xs text-slate-400">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{n.mensaje}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Detalle */}
        <Card title="Detalle" subtitle={selected ? 'Notificación seleccionada' : 'Selecciona una notificación'}>
          {!selected ? (
            <EmptyState icon={Bell} title="Nada seleccionado" description="Haz clic en una notificación de la lista para ver el detalle." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">{selected.tipo}</Badge>
                <Badge variant={selected.estado === 'PENDIENTE_MANUAL' ? 'warning' : selected.estado === 'ENVIADO' ? 'success' : 'danger'}>
                  {selected.estado}
                </Badge>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-slate-500">Cliente: <span className="text-slate-900 font-medium">{selected.prestamo?.cliente?.nombre || 'N/A'}</span></p>
                <p className="text-slate-500">Teléfono: <span className="text-slate-900 font-mono">{selected.clienteTelefono}</span></p>
                <p className="text-slate-500">Creada: <span className="text-slate-900">{formatDate(selected.createdAt, { withTime: true })}</span></p>
                {selected.fechaEnvio && (
                  <p className="text-slate-500">Enviada: <span className="text-slate-900">{formatDate(selected.fechaEnvio, { withTime: true })}</span></p>
                )}
                {selected.prestamo && (
                  <p className="text-slate-500">Solicitud: <span className="text-slate-900 font-mono">{selected.prestamo.codigo}</span></p>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Mensaje</p>
                <p className="text-xs text-slate-800 whitespace-pre-wrap font-mono">{selected.mensaje}</p>
              </div>

              <div className="flex flex-col gap-2">
                {selected.linkWaMe && (
                  <a
                    href={selected.linkWaMe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Abrir en WhatsApp
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selected.estado === 'PENDIENTE_MANUAL' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => marcarEnviado(selected.id)}
                  >
                    <Check className="w-4 h-4 mr-1" /> Marcar como Enviado
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
