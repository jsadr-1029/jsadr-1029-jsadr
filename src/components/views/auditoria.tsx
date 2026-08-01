'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { History, Search, CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function AuditoriaView() {
  const [modulo, setModulo] = useState('')
  const [page, setPage] = useState(1)

  const handleModuloChange = (v: string) => { setModulo(v); setPage(1) }

  const query = new URLSearchParams({ modulo, page: String(page), pageSize: '50' }).toString()
  const { data, loading } = useFetch<{ logs: any[]; total: number; totalPages: number }>(`/api/audit-logs?${query}`)

  return (
    <div className="space-y-4">
      <PageHeader title="Auditoría" subtitle={`${data?.total || 0} eventos registrados`} icon={History} />
      <Card>
        <Select value={modulo} onValueChange={handleModuloChange}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Filtrar por módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="prestamos">Préstamos</SelectItem>
            <SelectItem value="pagos">Pagos</SelectItem>
            <SelectItem value="clientes">Clientes</SelectItem>
            <SelectItem value="notificaciones">Notificaciones</SelectItem>
            <SelectItem value="portal">Portal</SelectItem>
          </SelectContent>
        </Select>
      </Card>
      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.logs?.length ? (
          <EmptyState icon={History} title="Sin eventos" />
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {data.logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  l.exito ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {l.exito ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{l.accion}</span>
                    <Badge variant="neutral">{l.modulo}</Badge>
                    {l.entidadNombre && <span className="text-xs text-slate-500 font-mono">{l.entidadNombre}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    por {l.usuarioNombre || 'Sistema'} · {formatDate(l.fecha, { withTime: true })}
                  </p>
                  {l.errorMessage && <p className="text-xs text-red-600 mt-0.5">{l.errorMessage}</p>}
                  {l.ipOrigen && <p className="text-xs text-slate-400 mt-0.5">IP: {l.ipOrigen}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
