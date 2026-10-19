'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime } from './helpers'
import { apiFetch } from './helpers'

export function AuditoriaPanel() {
  const [auditoria, setAuditoria] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEntidad, setFiltroEntidad] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')

  const cargar = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroEntidad) params.set('entidad', filtroEntidad)
    if (filtroAccion) params.set('accion', filtroAccion)
    const r = await apiFetch('/api/vehiculos/auditoria' + (params.toString() ? `?${params}` : ''))
    if (r.success) setAuditoria(r.data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEntidad, filtroAccion])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={filtroEntidad || 'TODAS'} onValueChange={v => setFiltroEntidad(v === 'TODAS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Entidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="VEHICULO">Vehículo</SelectItem>
            <SelectItem value="CONDUCTOR">Conductor</SelectItem>
            <SelectItem value="CONTRATO">Contrato</SelectItem>
            <SelectItem value="OBLIGACION">Obligación</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
            <SelectItem value="REPUESTO">Repuesto</SelectItem>
            <SelectItem value="GASTO">Gasto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroAccion || 'TODAS'} onValueChange={v => setFiltroAccion(v === 'TODAS' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Acción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="CREAR">Crear</SelectItem>
            <SelectItem value="MODIFICAR">Modificar</SelectItem>
            <SelectItem value="ELIMINAR">Eliminar</SelectItem>
            <SelectItem value="APROBAR">Aprobar</SelectItem>
            <SelectItem value="RECHAZAR">Rechazar</SelectItem>
            <SelectItem value="REVERSAR">Reversar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : auditoria.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No hay registros de auditoría.
        </CardContent></Card>
      ) : (
        <div className="space-y-1">
          {auditoria.map(a => (
            <div key={a.id} className="p-2 rounded border text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{a.accion}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 rounded">{a.entidad}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                <span className="text-xs">por <strong>{a.usuarioNombre}</strong></span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{a.descripcion}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
