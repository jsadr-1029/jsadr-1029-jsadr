'use client'

// =====================================================
// Página /portal-neobanco
// Vista previa del nuevo diseño Neobanco Glass.
// Requiere login como cliente (portal_cliente_token).
// =====================================================

import dynamic from 'next/dynamic'

// Carga diferida para no inflar el bundle inicial
const PortalNeobancoGlass = dynamic(
  () =>
    import('@/components/views/portal/PortalNeobancoGlass').then(
      (m) => ({ default: m.PortalNeobancoGlass }),
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(180deg, #060812 0%, #0a0d1d 50%, #0e1224 100%)',
          color: '#9aa3b8',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7c7cff] to-[#a78bff] flex items-center justify-center animate-pulse" />
          <p className="text-sm">Cargando portal…</p>
        </div>
      </div>
    ),
  },
)

export default function PortalNeobancoPage() {
  return <PortalNeobancoGlass />
}
