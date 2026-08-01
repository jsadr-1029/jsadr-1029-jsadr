'use client'

// =====================================================
// PWA Mode Toggle — Jsadr
// Switch flotante top-right que activa/desactiva el modo PWA.
//
// Cuando ON:
//   - Inyecta <link rel="manifest">
//   - Registra Service Worker (sw.js) si existe en /sw.js
//   - Inyecta CSS responsivo (meta viewport + bottom-nav)
//   - Crea bottom nav flotante con atajos principales
// Cuando OFF:
//   - Remueve todo lo inyectado y desregistra el SW
//
// Persiste en localStorage('pwa_mode_enabled')
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { Smartphone, X } from 'lucide-react'

const STORAGE_KEY = 'pwa_mode_enabled'

const NAV_ITEMS = [
  { label: 'Inicio', href: '/#inicio', icon: '🏠' },
  { label: 'Préstamos', href: '/#prestamos', icon: '💳' },
  { label: 'Pagos', href: '/#pagos', icon: '💰' },
  { label: 'Clientes', href: '/#clientes', icon: '👥' },
  { label: 'Reportes', href: '/#reportes', icon: '📊' },
]

const MANIFEST_HREF = '/manifest.webmanifest'
const SW_URL = '/sw.js'
const VIEWPORT_META_ID = 'pwa-viewport-meta'
const MANIFEST_LINK_ID = 'pwa-manifest-link'
const CSS_STYLE_ID = 'pwa-responsive-css'
const BOTTOM_NAV_ID = 'pwa-bottom-nav'
const THEME_COLOR_META_ID = 'pwa-theme-color'

export function PWAModeToggle() {
  const [enabled, setEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Cargar estado de localStorage al montar
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') {
        setEnabled(true)
      }
    } catch {
      // ignore
    }
  }, [])

  // Aplicar/remover inyecciones cuando cambia enabled
  useEffect(() => {
    if (!mounted) return

    if (enabled) {
      injectPWAAssets()
    } else {
      removePWAAssets()
    }

    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // ignore
    }
  }, [enabled, mounted])

  const toggle = useCallback(() => setEnabled((v) => !v), [])

  if (!mounted) {
    return null // evitar hidratación inconsistente
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? 'Desactivar modo PWA' : 'Activar modo PWA'}
      className="fixed top-3 right-3 z-[9999] flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border backdrop-blur-md transition-all shadow-lg"
      style={{
        background: enabled
          ? 'linear-gradient(135deg, oklch(0.58 0.22 275) 0%, oklch(0.55 0.24 300) 100%)'
          : 'oklch(0.20 0.04 268 / 85%)',
        color: '#ffffff',
        borderColor: enabled
          ? 'oklch(0.55 0.22 280 / 0.6)'
          : 'oklch(0.35 0.05 275 / 35%)',
        boxShadow: enabled
          ? '0 0 0 1px oklch(0.55 0.22 280 / 0.4), 0 6px 24px -4px oklch(0.55 0.22 285 / 0.55)'
          : '0 8px 24px -8px oklch(0.08 0.04 270 / 0.6)',
      }}
    >
      {enabled ? <Smartphone className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 opacity-70" />}
      <span>{enabled ? 'PWA: ON' : 'PWA'}</span>
      {enabled && <X className="w-3 h-3 opacity-80" />}
    </button>
  )
}

// === INYECCIÓN ===

function injectPWAAssets() {
  if (typeof document === 'undefined') return

  // 1) Manifest link
  if (!document.getElementById(MANIFEST_LINK_ID)) {
    const link = document.createElement('link')
    link.id = MANIFEST_LINK_ID
    link.rel = 'manifest'
    link.href = MANIFEST_HREF
    document.head.appendChild(link)
  }

  // 2) Viewport meta (responsive) — si no existe ya uno, agregar
  let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
  if (!viewport) {
    viewport = document.createElement('meta')
    viewport.id = VIEWPORT_META_ID
    viewport.name = 'viewport'
    viewport.content =
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    document.head.appendChild(viewport)
  } else {
    // Guardar contenido original y reforzar
    if (!viewport.dataset.pwaOriginal) {
      viewport.dataset.pwaOriginal = viewport.content
      viewport.content =
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    }
  }

  // 3) Theme color
  if (!document.getElementById(THEME_COLOR_META_ID)) {
    const meta = document.createElement('meta')
    meta.id = THEME_COLOR_META_ID
    meta.name = 'theme-color'
    meta.content = '#6366f1'
    document.head.appendChild(meta)
  }

  // 4) CSS responsivo
  if (!document.getElementById(CSS_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = CSS_STYLE_ID
    style.textContent = `
      /* PWA responsive mode */
      html, body { -webkit-tap-highlight-color: transparent; }
      body { padding-bottom: env(safe-area-inset-bottom, 0px); }
      @media (max-width: 768px) {
        body { padding-bottom: 64px !important; }
        [data-sidebar], aside { display: none !important; }
        main, .main-content { margin-left: 0 !important; padding: 12px !important; }
        .grid-cols-12, .grid-cols-2, .grid-cols-3, .grid-cols-4 { grid-template-columns: 1fr !important; }
        .hide-on-pwa { display: none !important; }
      }
      /* Bottom nav */
      #${BOTTOM_NAV_ID} {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 9998;
        display: flex;
        justify-content: space-around;
        align-items: center;
        height: 56px;
        background: oklch(0.16 0.03 268 / 92%);
        backdrop-filter: blur(20px) saturate(150%);
        -webkit-backdrop-filter: blur(20px) saturate(150%);
        border-top: 1px solid oklch(0.35 0.05 275 / 35%);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        box-shadow: 0 -8px 24px -8px oklch(0.08 0.04 270 / 0.6);
      }
      #${BOTTOM_NAV_ID} a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 10px;
        color: oklch(0.7 0.04 270);
        font-size: 10px;
        font-weight: 600;
        text-decoration: none;
        border-radius: 8px;
        transition: all 0.15s ease;
        flex: 1;
      }
      #${BOTTOM_NAV_ID} a:hover, #${BOTTOM_NAV_ID} a:active {
        color: oklch(0.85 0.22 280);
        background: oklch(0.25 0.05 275 / 40%);
      }
      #${BOTTOM_NAV_ID} a .pwa-nav-icon { font-size: 18px; line-height: 1; }
    `
    document.head.appendChild(style)
  }

  // 5) Bottom nav
  if (!document.getElementById(BOTTOM_NAV_ID)) {
    const nav = document.createElement('nav')
    nav.id = BOTTOM_NAV_ID
    // Reforzado: construir nav con DOM API en lugar de innerHTML (evita XSS)
    for (const item of NAV_ITEMS) {
      const a = document.createElement('a')
      a.href = item.href
      a.setAttribute('data-pwa-nav', '')
      const iconSpan = document.createElement('span')
      iconSpan.className = 'pwa-nav-icon'
      iconSpan.textContent = item.icon // textContent no interpreta HTML
      const labelSpan = document.createElement('span')
      labelSpan.textContent = item.label
      a.appendChild(iconSpan)
      a.appendChild(labelSpan)
      nav.appendChild(a)
    }
    document.body.appendChild(nav)
  }

  // 6) Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then(() => {
        // SW registrado OK
      })
      .catch(() => {
        // /sw.js puede no existir — falla silenciosa
      })
  }

  // 7) Clase en <html> para CSS opcional
  document.documentElement.classList.add('pwa-mode')
}

function removePWAAssets() {
  if (typeof document === 'undefined') return

  const remove = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.remove()
  }

  remove(MANIFEST_LINK_ID)
  remove(CSS_STYLE_ID)
  remove(BOTTOM_NAV_ID)
  remove(THEME_COLOR_META_ID)

  // Restaurar viewport original
  const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
  if (viewport && viewport.dataset.pwaOriginal) {
    viewport.content = viewport.dataset.pwaOriginal
    delete viewport.dataset.pwaOriginal
  }
  // Si el viewport lo agregamos nosotros (sin original), removerlo
  remove(VIEWPORT_META_ID)

  // Desregistrar SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        if (reg.scope === window.location.origin + '/') {
          reg.unregister().catch(() => {})
        }
      }
    })
  }

  document.documentElement.classList.remove('pwa-mode')
}

export default PWAModeToggle
