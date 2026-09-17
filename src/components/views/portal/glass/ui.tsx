'use client'

// =====================================================
// Portal Neobanco Glass — Primitivos UI
// Sistema de diseño minimalista (Revolut/N26/Cash App).
// Mobile-first, WCAG AA, dark/light.
// =====================================================

import * as React from 'react'
import { cn } from '@/lib/utils'

// =====================================================
// GlassCard — contenedor base translúcido
// =====================================================
type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'soft' | 'elevated'
  interactive?: boolean
  radius?: 'sm' | 'md' | 'lg' | 'xl'
}

const radiusMap: Record<NonNullable<GlassCardProps['radius']>, string> = {
  sm: 'rounded-[12px]',
  md: 'rounded-[16px]',
  lg: 'rounded-[24px]',
  xl: 'rounded-[32px]',
}

export function GlassCard({
  className,
  variant = 'default',
  interactive = false,
  radius = 'lg',
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'relative',
        radiusMap[radius],
        variant === 'default' && 'nb-glass',
        variant === 'soft' && 'nb-glass-2',
        variant === 'elevated' && 'nb-glass',
        variant === 'elevated' && 'shadow-[0_24px_48px_-12px_rgba(15,23,42,0.25)]',
        interactive && 'nb-press cursor-pointer hover:border-[var(--nb-border-strong)]',
        className,
      )}
      {...rest}
    >
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// =====================================================
// GlassButton — botón con jerarquía primaria/secundaria/ghost
// =====================================================
type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

export function GlassButton({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  disabled,
  ...rest
}: GlassButtonProps) {
  const sizes = {
    sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[12px]',
    md: 'h-11 px-5 text-sm gap-2 rounded-[14px]',
    lg: 'h-14 px-6 text-base gap-2.5 rounded-[16px]',
  }

  const variants = {
    primary:
      'text-white border-0 bg-[var(--nb-gradient-brand)] shadow-[0_8px_24px_-8px_rgba(91,91,247,0.55)] hover:brightness-[1.06]',
    secondary:
      'text-[var(--nb-fg)] bg-[var(--nb-surface)] border border-[var(--nb-border-strong)] backdrop-blur-md hover:bg-[var(--nb-surface-2)]',
    ghost:
      'text-[var(--nb-fg-muted)] bg-transparent border-0 hover:bg-[var(--nb-surface-2)] hover:text-[var(--nb-fg)]',
    danger:
      'text-white bg-[var(--nb-danger)] border-0 shadow-[0_8px_24px_-8px_rgba(225,29,72,0.55)] hover:brightness-[1.06]',
    success:
      'text-white bg-[var(--nb-success)] border-0 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.55)] hover:brightness-[1.06]',
  }

  return (
    <button
      className={cn(
        'nb-press inline-flex items-center justify-center font-semibold tracking-[-0.01em] select-none',
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  )
}

// =====================================================
// GlassInput — campo de texto
// =====================================================
type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  prefix?: string
  suffix?: string
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassInput(
    { className, label, hint, error, iconLeft, iconRight, prefix, suffix, id, ...rest },
    ref,
  ) {
    const reactId = React.useId()
    const inputId = id ?? reactId
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[12px] font-semibold tracking-wide text-[var(--nb-fg-muted)] uppercase"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center h-12 rounded-[14px] px-3.5 gap-2 transition-colors',
            'bg-[var(--nb-surface-2)] border backdrop-blur-md',
            error
              ? 'border-[var(--nb-danger)]'
              : 'border-[var(--nb-border)] focus-within:border-[var(--nb-primary)]',
          )}
        >
          {iconLeft && <span className="text-[var(--nb-fg-subtle)]">{iconLeft}</span>}
          {prefix && (
            <span className="text-[var(--nb-fg-muted)] font-medium text-sm">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[var(--nb-fg)] placeholder:text-[var(--nb-fg-subtle)] nb-tabular',
              className,
            )}
            {...rest}
          />
          {suffix && (
            <span className="text-[var(--nb-fg-muted)] font-medium text-sm">{suffix}</span>
          )}
          {iconRight && <span className="text-[var(--nb-fg-subtle)]">{iconRight}</span>}
        </div>
        {hint && !error && (
          <p className="text-[12px] text-[var(--nb-fg-subtle)] pl-1">{hint}</p>
        )}
        {error && (
          <p className="text-[12px] text-[var(--nb-danger)] pl-1 font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

// =====================================================
// SegmentedControl — switch entre opciones (tabs pill)
// =====================================================
type SegmentedControlProps<T extends string> = {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex p-1 rounded-[14px] bg-[var(--nb-surface-2)] border border-[var(--nb-border)] backdrop-blur-md gap-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'nb-press inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-all',
              size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]',
              active
                ? 'bg-[var(--nb-gradient-brand)] text-white shadow-[0_4px_12px_-2px_rgba(91,91,247,0.45)]'
                : 'text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)] hover:bg-[var(--nb-surface)]',
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// =====================================================
// Chip — etiqueta compacta con color semántico
// =====================================================
type ChipProps = {
  children: React.ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
  variant?: 'soft' | 'solid'
  size?: 'sm' | 'md'
  className?: string
}

export function Chip({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  className,
}: ChipProps) {
  const tones: Record<NonNullable<ChipProps['tone']>, string> = {
    neutral:
      variant === 'soft'
        ? 'bg-[var(--nb-surface-2)] text-[var(--nb-fg-muted)] border-[var(--nb-border)]'
        : 'bg-[var(--nb-fg-muted)] text-white border-0',
    brand:
      variant === 'soft'
        ? 'bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] border-[var(--nb-primary)]/20'
        : 'bg-[var(--nb-gradient-brand)] text-white border-0',
    success:
      variant === 'soft'
        ? 'bg-[var(--nb-success-soft)] text-[var(--nb-success)] border-[var(--nb-success)]/20'
        : 'bg-[var(--nb-success)] text-white border-0',
    warning:
      variant === 'soft'
        ? 'bg-[var(--nb-warning-soft)] text-[var(--nb-warning)] border-[var(--nb-warning)]/20'
        : 'bg-[var(--nb-warning)] text-white border-0',
    danger:
      variant === 'soft'
        ? 'bg-[var(--nb-danger-soft)] text-[var(--nb-danger)] border-[var(--nb-danger)]/20'
        : 'bg-[var(--nb-danger)] text-white border-0',
    info:
      variant === 'soft'
        ? 'bg-[var(--nb-info-soft)] text-[var(--nb-info)] border-[var(--nb-info)]/20'
        : 'bg-[var(--nb-info)] text-white border-0',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold tracking-[-0.01em]',
        size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// =====================================================
// Skeleton — placeholder de carga
// =====================================================
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('nb-skeleton rounded-[12px]', className)} />
}

// =====================================================
// EmptyState — cuando no hay datos
// =====================================================
type EmptyStateProps = {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-16 h-16 rounded-3xl bg-[var(--nb-primary-soft)] flex items-center justify-center mb-4 text-[var(--nb-primary)]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[var(--nb-fg)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-[13px] text-[var(--nb-fg-muted)] max-w-[280px] mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// =====================================================
// ListRow — fila de lista con separadores
// =====================================================
type ListRowProps = {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: ListRowProps) {
  const Comp: 'button' | 'div' = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
        onClick && 'nb-press hover:bg-[var(--nb-surface-2)]',
        'border-b border-[var(--nb-divider)] last:border-0',
        className,
      )}
    >
      {leading && (
        <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--nb-surface-2)] flex items-center justify-center text-[var(--nb-fg-muted)]">
          {leading}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--nb-fg)] truncate">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-[var(--nb-fg-muted)] truncate mt-0.5">{subtitle}</div>
        )}
      </div>
      {trailing && <div className="shrink-0 text-[var(--nb-fg-muted)]">{trailing}</div>}
    </Comp>
  )
}

// =====================================================
// ProgressRing — anillo de progreso (acceso WCAG)
// =====================================================
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone = 'brand',
  label,
}: {
  value: number // 0-100
  size?: number
  stroke?: number
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  label?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (v / 100) * c
  const toneColor = {
    brand: 'var(--nb-primary)',
    success: 'var(--nb-success)',
    warning: 'var(--nb-warning)',
    danger: 'var(--nb-danger)',
  }[tone]
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--nb-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.2,0.7,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-bold text-[var(--nb-fg)] nb-tabular">{Math.round(v)}%</span>
        {label && (
          <span className="text-[9px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

// =====================================================
// MiniBarChart — barras horizontales para historial
// =====================================================
export function MiniBarChart({
  data,
  tone = 'brand',
  height = 80,
}: {
  data: Array<{ label: string; value: number; highlight?: boolean }>
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const toneColor = {
    brand: 'var(--nb-primary)',
    success: 'var(--nb-success)',
    warning: 'var(--nb-warning)',
    danger: 'var(--nb-danger)',
  }[tone]
  return (
    <div className="flex items-end gap-1.5 w-full" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-1.5 justify-end"
          style={{ height: '100%' }}
        >
          <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
            <div
              className="w-full max-w-[22px] rounded-t-[6px] nb-press transition-all"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: 4,
                background: d.highlight ? 'var(--nb-gradient-brand)' : toneColor,
                opacity: d.highlight ? 1 : 0.55,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[10px] text-[var(--nb-fg-subtle)] font-medium truncate max-w-full">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// Sheet — bottom sheet modal (mobile-first)
// =====================================================
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm nb-anim-fade"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[var(--nb-max-w)] nb-glass rounded-t-[28px] nb-anim-slide"
        style={{ maxHeight: '85vh' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-[var(--nb-border-strong)]" />
        </div>
        {title && (
          <div className="px-5 pt-2 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--nb-fg)]">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="nb-press w-8 h-8 rounded-full bg-[var(--nb-surface-2)] flex items-center justify-center text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        )}
        <div
          className="px-5 pb-5 overflow-y-auto"
          style={{ maxHeight: 'calc(85vh - 80px)' }}
        >
          {children}
        </div>
        {footer && (
          <div className="sticky bottom-0 px-5 py-4 border-t border-[var(--nb-divider)] bg-[var(--nb-surface)] backdrop-blur-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================
// Toast — notificación inline
// =====================================================
type ToastContextValue = {
  push: (msg: string, tone?: 'neutral' | 'success' | 'danger' | 'warning') => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useNbToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useNbToast debe usarse dentro de NbToastProvider')
  return ctx
}

export function NbToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<
    Array<{ id: number; msg: string; tone: 'neutral' | 'success' | 'danger' | 'warning' }>
  >([])
  const idRef = React.useRef(0)

  const push = React.useCallback(
    (msg: string, tone: 'neutral' | 'success' | 'danger' | 'warning' = 'neutral') => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, msg, tone }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
    },
    [],
  )

  const toneColor: Record<string, string> = {
    neutral: 'bg-[var(--nb-surface)] border-[var(--nb-border-strong)] text-[var(--nb-fg)]',
    success: 'bg-[var(--nb-success-soft)] border-[var(--nb-success)]/30 text-[var(--nb-success)]',
    danger: 'bg-[var(--nb-danger-soft)] border-[var(--nb-danger)]/30 text-[var(--nb-danger)]',
    warning: 'bg-[var(--nb-warning-soft)] border-[var(--nb-warning)]/30 text-[var(--nb-warning)]',
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[var(--nb-max-w)] px-4 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'nb-anim-slide nb-glass border rounded-[14px] px-4 py-3 text-[13px] font-semibold shadow-lg pointer-events-auto',
              toneColor[t.tone],
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// =====================================================
// SectionHeader — título de sección con acción opcional
// =====================================================
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between mb-3 px-1', className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--nb-fg-muted)]">
        {title}
      </h2>
      {action}
    </div>
  )
}
