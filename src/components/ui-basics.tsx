'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white shadow-lg glow-primary">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

interface EstadoBadgeProps {
  estado: string
}

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    SOLICITUD: { label: 'Solicitud', className: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
    APROBADO: { label: 'Aprobado', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
    ACTIVO: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    EN_MORA: { label: 'En Mora', className: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    JURIDICO: { label: 'Jurídico', className: 'bg-orange-500/15 text-orange-300 border-orange-400/30' },
    CANCELADO: { label: 'Cancelado', className: 'bg-green-500/15 text-green-300 border-green-400/30' },
    RECHAZADO: { label: 'Rechazado', className: 'bg-red-500/15 text-red-300 border-red-400/30' },
  }

  const cfg = config[estado] || { label: estado, className: 'bg-white/10 text-foreground border-white/20' }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}
