'use client'

import { cn } from '@/lib/utils'

export function Badge({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-300',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    warning: 'bg-amber-50 text-amber-700 border-amber-300',
    danger: 'bg-red-50 text-red-700 border-red-300',
    info: 'bg-blue-50 text-blue-700 border-blue-300',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  icon?: any
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            {title && <h3 className="font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'slate',
  hint,
}: {
  label: string
  value: string | number
  icon: any
  trend?: { value: string; positive: boolean }
  color?: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' | 'purple'
  hint?: string
}) {
  const colors = {
    slate: 'from-slate-500 to-slate-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    red: 'from-red-500 to-red-700',
    blue: 'from-blue-500 to-blue-700',
    purple: 'from-purple-500 to-purple-700',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
          {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin mb-2" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
