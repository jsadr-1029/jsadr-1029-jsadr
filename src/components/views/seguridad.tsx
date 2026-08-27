'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { ShieldCheck, Lock, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export function SeguridadView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useFetch<{ modulos: any[] }>(`/api/seguridad/modulos`, { refreshKey })
  const modulos = data?.modulos || []

  const toggleProtegido = async (modulo: any) => {
    try {
      await apiPost('/api/seguridad/modulos', {
        moduloKey: modulo.moduloKey,
        moduloNombre: modulo.moduloNombre,
        protegido: !modulo.protegido,
      })
      setRefreshKey(k => k + 1)
      toast.success(`Módulo ${!modulo.protegido ? 'protegido' : 'desprotegido'}`)
    } catch (e) { toast.error('Error: ' + (e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Seguridad" subtitle="Módulos protegidos del sistema" icon={ShieldCheck} />
      <Card>
        {loading ? (
          <LoadingState />
        ) : !modulos.length ? (
          <EmptyState icon={ShieldCheck} title="Sin módulos" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modulos.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    m.protegido ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.moduloNombre}</p>
                    <p className="text-xs text-slate-500">{m.moduloKey}</p>
                  </div>
                </div>
                <Switch checked={m.protegido} onCheckedChange={() => toggleProtegido(m)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
