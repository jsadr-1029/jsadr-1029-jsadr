'use client'

// =====================================================
// useResponsiveView — Hook para gestionar el modo de vista
// responsiva preferido por el usuario (Móvil / Tablet / PC / Auto).
//
// El modo seleccionado se persiste en localStorage y se propaga
// a través de un evento custom `responsive-view:changed` para
// que cualquier componente (page.tsx, Sidebar, MobileNav, etc.)
// pueda reaccionar sin tener que re-leer localStorage en cada
// render.
//
// Modos:
//   - 'auto'    → respeta el device-width real (comportamiento por defecto)
//   - 'mobile'  → fuerza layout móvil (sidebar oculto, mobile-nav visible,
//                 contenido centrado con max-width 480px)
//   - 'tablet'  → fuerza layout tablet (sidebar oculto, mobile-nav visible,
//                 contenido centrado con max-width 768px)
//   - 'desktop' → fuerza layout desktop (sidebar visible, mobile-nav oculto,
//                 sin restricción de ancho)
//
// Disponible para: ADMIN, GESTOR, CONSULTOR
// NO disponible para: ABOGADO (usa portal jurídico propio),
//                     CLIENTE (usa portal cliente propio)
// =====================================================

import { useState, useEffect, useCallback } from 'react'

export type ResponsiveViewMode = 'auto' | 'mobile' | 'tablet' | 'desktop'

const STORAGE_KEY = 'responsive_view_mode'
const EVENT_NAME = 'responsive-view:changed'

const VALID_MODES: ResponsiveViewMode[] = ['auto', 'mobile', 'tablet', 'desktop']

function readFromStorage(): ResponsiveViewMode {
  if (typeof window === 'undefined') return 'auto'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && VALID_MODES.includes(v as ResponsiveViewMode)) {
      return v as ResponsiveViewMode
    }
  } catch {}
  return 'auto'
}

function writeToStorage(mode: ResponsiveViewMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, mode)
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: mode }))
  } catch {}
}

/**
 * Hook principal — lee y actualiza el modo de vista responsiva.
 * Re-renderiza automáticamente cuando el modo cambia (incluso
 * si el cambio viene de otra pestaña o componente).
 */
export function useResponsiveView(): {
  mode: ResponsiveViewMode
  setMode: (mode: ResponsiveViewMode) => void
  reset: () => void
} {
  const [mode, setModeState] = useState<ResponsiveViewMode>('auto')

  // Cargar modo inicial + escuchar cambios
  useEffect(() => {
    setModeState(readFromStorage())

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as ResponsiveViewMode
      if (detail && VALID_MODES.includes(detail)) {
        setModeState(detail)
      } else {
        // Si no hay detail, releer de storage (puede ser cambio en otra pestaña)
        setModeState(readFromStorage())
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(readFromStorage())
    }

    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setMode = useCallback((m: ResponsiveViewMode) => {
    writeToStorage(m)
    setModeState(m)
  }, [])

  const reset = useCallback(() => {
    writeToStorage('auto')
    setModeState('auto')
  }, [])

  return { mode, setMode, reset }
}

/**
 * Devuelve el layout efectivo considerando tanto el modo forzado
 * por el usuario como el ancho real del dispositivo.
 *
 * Lógica:
 *   - Si mode='auto' → usa el device-width real
 *   - Si mode='mobile' → siempre 'mobile'
 *   - Si mode='tablet' → siempre 'tablet'
 *   - Si mode='desktop' → siempre 'desktop'
 *
 * Útil para componentes que necesitan saber qué layout renderizar
 * (Sidebar, MobileNav) sin tener que importar el hook directamente.
 */
export function useEffectiveLayout(): 'mobile' | 'tablet' | 'desktop' {
  const { mode } = useResponsiveView()
  const [deviceWidth, setDeviceWidth] = useState<number>(0)

  useEffect(() => {
    const update = () => setDeviceWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (mode === 'mobile') return 'mobile'
  if (mode === 'tablet') return 'tablet'
  if (mode === 'desktop') return 'desktop'

  // mode === 'auto' → usar device-width real
  if (deviceWidth === 0) return 'desktop' // SSR-safe default
  if (deviceWidth < 768) return 'mobile'
  if (deviceWidth < 1024) return 'tablet'
  return 'desktop'
}

/**
 * Helper para saber si el usuario actual puede usar el toggle
 * responsivo. Solo ADMIN, GESTOR y CONSULTOR tienen acceso.
 * ABOGADO y CLIENTE usan portales propios que NO se modifican.
 */
export function canUseResponsiveToggle(rol: string | undefined | null): boolean {
  if (!rol) return false
  const r = rol.toUpperCase()
  return r === 'ADMIN' || r === 'GESTOR' || r === 'CONSULTOR'
}
