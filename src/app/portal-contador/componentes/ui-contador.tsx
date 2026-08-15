'use client'

// =====================================================
// Componentes UI reutilizables del Portal del Contador
// =====================================================

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Construction } from 'lucide-react'

export function formatCOP(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) value = 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  if (typeof value !== 'number' || isNaN(value)) value = 0
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d)
}

export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

export function KpiCard({
  titulo,
  valor,
  descripcion,
  icon: Icon,
  accent = 'sky',
}: {
  titulo: string
  valor: string | number
  descripcion?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet'
}) {
  const accentMap: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
            {descripcion && <p className="mt-1 text-xs text-slate-500">{descripcion}</p>}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentMap[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ModuloEnDesarrollo({
  titulo,
  descripcion,
}: {
  titulo: string
  descripcion?: string
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Construction className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-slate-600">
            {descripcion ||
              'Este módulo está en desarrollo. La estructura y el acceso ya están disponibles; la funcionalidad completa se habilitará en una próxima versión.'}
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Portal del Contador · JSADR
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function EmptyState({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-xs text-slate-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}
