'use client'

import { useFetch } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatDate } from '@/lib/format'
import { Building2, GitBranch, CheckCircle2 } from 'lucide-react'

export function VersionesView() {
  const { data, loading } = useFetch<{ versiones: any[] }>(`/api/versiones`)

  return (
    <div className="space-y-4">
      <PageHeader title="Versiones del Sistema" subtitle="Historial de releases" icon={Building2} />
      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.versiones?.length ? (
          <EmptyState icon={GitBranch} title="Sin versiones" />
        ) : (
          <div className="space-y-3">
            {data.versiones.map((v) => {
              let cambios: string[] = []
              try { cambios = JSON.parse(v.cambios || '[]') } catch {}
              return (
                <div key={v.id} className="p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      v.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">v{v.numero}</span>
                        <Badge variant={v.tipo === 'MAYOR' ? 'danger' : v.tipo === 'MENOR' ? 'info' : 'neutral'}>{v.tipo}</Badge>
                        {v.activa && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Activa</Badge>}
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{v.nombre}</p>
                      <p className="text-xs text-slate-500">{formatDate(v.createdAt, { withTime: true })}</p>
                    </div>
                  </div>
                  {v.descripcion && <p className="text-sm text-slate-600 mb-2">{v.descripcion}</p>}
                  {cambios.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-1 ml-4">
                      {cambios.map((c, i) => (
                        <li key={i} className="list-disc">{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
