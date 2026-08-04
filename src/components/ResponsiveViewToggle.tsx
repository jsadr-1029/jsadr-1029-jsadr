'use client'

// =====================================================
// ResponsiveViewToggle — Botón flotante que permite al
// administrador / gestor / consultor cambiar el modo de
// vista responsiva del sistema:
//
//   • Auto    → respeta el tamaño real del dispositivo
//   • Móvil   → fuerza vista móvil (max-width 480px)
//   • Tablet  → fuerza vista tablet (max-width 768px)
//   • PC      → fuerza vista desktop (con sidebar)
//
// El botón:
//   - Se ubica fijo en la esquina superior derecha, junto
//     al UserMenu, para estar siempre accesible.
//   - Solo se renderiza para ADMIN / GESTOR / CONSULTOR.
//   - NO se renderiza en el portal cliente ni en el portal
//     jurídico (esos tienen layout propio).
//   - Persiste la preferencia en localStorage.
//   - Muestra un ícono distinto según el modo activo.
//
// El cambio de modo dispara un evento custom que page.tsx
// escucha para re-renderizar el layout adecuado.
// =====================================================

import { useState, useRef, useEffect } from 'react'
import { useResponsiveView, type ResponsiveViewMode, canUseResponsiveToggle } from '@/hooks/use-responsive-view'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
import { getUserData } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  ChevronDown,
  Check,
  LayoutGrid,
} from 'lucide-react'

interface ModeOption {
  value: ResponsiveViewMode
  label: string
  description: string
  icon: typeof Smartphone
  maxWidth?: number // px — ancho máximo del contenido cuando se fuerza
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'auto',
    label: 'Automático',
    description: 'Detecta el dispositivo real',
    icon: RefreshCw,
  },
  {
    value: 'mobile',
    label: 'Móvil',
    description: 'Vista celular (480px)',
    icon: Smartphone,
    maxWidth: 480,
  },
  {
    value: 'tablet',
    label: 'Tablet',
    description: 'Vista tablet (768px)',
    icon: Tablet,
    maxWidth: 768,
  },
  {
    value: 'desktop',
    label: 'PC',
    description: 'Vista escritorio (sidebar)',
    icon: Monitor,
  },
]

export function ResponsiveViewToggle() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { mode, setMode } = useResponsiveView()
  const { rol: reactiveRol } = useAuthReactive()
  const userData = getUserData()
  const rol = reactiveRol || userData?.rol || ''

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEsc)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  // No renderizar si el rol no tiene permiso
  if (!canUseResponsiveToggle(rol)) {
    return null
  }

  const currentOption = MODE_OPTIONS.find((o) => o.value === mode) || MODE_OPTIONS[0]
  const CurrentIcon = currentOption.icon

  const handleSelect = (m: ResponsiveViewMode) => {
    setMode(m)
    setOpen(false)
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed top-3 left-3 z-[60]"
      style={{ zIndex: 60 }}
    >
      {/* Botón principal — posicionado a la IZQUIERDA para no overlapping
          con el UserMenu FAB (top-right, z-9997). El toggle debe ser
          accesible sin captura de clics por parte del FAB. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Modo de vista: ${currentOption.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Vista actual: ${currentOption.label} — click para cambiar`}
        className={cn(
          'group relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold',
          'glass-card border border-white/15 shadow-lg transition-all',
          'hover:border-white/30 hover:shadow-[0_0_20px_rgba(124,108,240,0.25)]',
          mode !== 'auto' && 'border-violet-400/50 ring-1 ring-violet-400/30',
        )}
      >
        {/* Indicador de modo activo */}
        {mode !== 'auto' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.6)]" />
        )}

        <CurrentIcon
          className={cn(
            'w-4 h-4 transition-transform',
            mode === 'auto' ? 'text-white/70 group-hover:text-white' : 'text-violet-300',
            mode === 'auto' && 'group-hover:rotate-180',
          )}
          style={mode === 'auto' ? { transitionDuration: '500ms' } : undefined}
        />
        <span className="text-white/90 hidden xl:inline">{currentOption.label}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-white/50 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown — se abre hacia la DERECHA desde el botón izquierdo */}
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 rounded-2xl glass-card-strong border border-white/15 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-violet-300" />
              <h3 className="text-sm font-bold text-white">Modo de vista</h3>
            </div>
            <p className="text-[11px] text-white/55 mt-0.5">
              Adapta el sistema al dispositivo seleccionado
            </p>
          </div>

          {/* Opciones */}
          <div className="p-1.5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = mode === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                    'group/item',
                    isActive
                      ? 'bg-violet-500/15 ring-1 ring-violet-400/30'
                      : 'hover:bg-white/5',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isActive
                        ? 'gradient-primary text-white shadow-lg'
                        : 'bg-white/5 text-white/60 group-hover/item:text-white',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-semibold',
                        isActive ? 'text-white' : 'text-white/85',
                      )}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-white/50">{opt.description}</div>
                  </div>
                  {isActive && (
                    <Check className="w-4 h-4 text-violet-300 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.02]">
            <p className="text-[10px] text-white/45 leading-tight">
              <span className="font-semibold text-white/65">Tip:</span> Usa{' '}
              <span className="text-violet-300">Móvil</span> o{' '}
              <span className="text-violet-300">Tablet</span> para previsualizar cómo se
              ve el sistema en pantallas pequeñas sin cambiar de dispositivo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
