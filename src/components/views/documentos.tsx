'use client'

import { useFetch } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { FileSearch, FileText, Download } from 'lucide-react'

export function DocumentosView() {
  const { data, loading } = useFetch<{ documentos: any[] }>(`/api/documentos`)

  return (
    <div className="space-y-4">
      <PageHeader title="Documentos" subtitle={`${data?.documentos?.length || 0} documentos`} icon={FileSearch} />
      <Card>
        {loading ? (
          <LoadingState />
        ) : !data?.documentos?.length ? (
          <EmptyState icon={FileText} title="Sin documentos" description="Los documentos subidos aparecerán aquí." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.documentos.map((d) => (
              <div key={d.id} className="p-3 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm truncate">{d.titulo}</p>
                    <p className="text-xs text-slate-500 truncate">{d.archivoNombre}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="info">{d.tipo}</Badge>
                      <span className="text-xs text-slate-400">{formatRelativeTime(d.fechaSubida)}</span>
                    </div>
                  </div>
                </div>
                {d.archivoBase64 && (
                  <a
                    href={d.archivoBase64}
                    download={d.archivoNombre}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                  >
                    <Download className="w-3 h-3" /> Descargar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
