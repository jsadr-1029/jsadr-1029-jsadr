'use client'

// =====================================================
// Vista: Campañas — Neobanco Glass
// Carrusel de campañas activas con tarjetas destacadas.
// Estilo Revolut "Perks & Offers".
// =====================================================

import * as React from 'react'
import { GlassCard, GlassButton, Chip, EmptyState, Skeleton } from '../ui'
import { formatFechaCorta, type NbCampana } from '../useNeobancoPortal'
import { Megaphone, Sparkles, ChevronRight, Tag, Gift, Star } from 'lucide-react'

type CampanasViewProps = {
  campanas: NbCampana[]
  cargando: boolean
  token: string | null
  onCampanaVista?: (id: string) => void
}

export function CampanasView({ campanas, cargando, token, onCampanaVista }: CampanasViewProps) {
  const [seleccionada, setSeleccionada] = React.useState<NbCampana | null>(null)

  const marcarVista = React.useCallback(
    async (id: string) => {
      if (!token) return
      try {
        await fetch('/api/portal/marcar-campana-vista', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-portal-token': token },
          body: JSON.stringify({ campanaId: id }),
        })
        onCampanaVista?.(id)
      } catch {
        /* no crítico */
      }
    },
    [token, onCampanaVista],
  )

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-44 w-full rounded-[24px]" />
        <Skeleton className="h-24 w-full rounded-[24px]" />
      </div>
    )
  }

  // Determinar tipo visual por índice (circular)
  const tipos = ['brand', 'success', 'warning', 'info'] as const

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <h1 className="text-[22px] font-bold text-[var(--nb-fg)] tracking-[-0.02em]">
          Campañas
        </h1>
        <p className="text-[13px] text-[var(--nb-fg-muted)] mt-0.5">
          {campanas.length} beneficio(s) disponible(s) para ti
        </p>
      </header>

      {campanas.length === 0 ? (
        <GlassCard radius="lg">
          <EmptyState
            icon={<Megaphone size={24} />}
            title="Sin campañas activas"
            description="Cuando lancemos promociones o beneficios exclusivos para clientes, aparecerán aquí."
          />
        </GlassCard>
      ) : (
        <>
          {/* Campaña destacada (primera) */}
          {campanas[0] && (
            <CampanaDestacada campana={campanas[0]} onClick={() => { setSeleccionada(campanas[0]); marcarVista(campanas[0].id) }} />
          )}

          {/* Resto */}
          {campanas.length > 1 && (
            <section>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--nb-fg-muted)] mb-2 px-1">
                Más beneficios
              </h2>
              <div className="flex flex-col gap-2.5">
                {campanas.slice(1).map((c, i) => (
                  <GlassCard
                    key={c.id}
                    interactive
                    radius="lg"
                    onClick={() => { setSeleccionada(c); marcarVista(c.id) }}
                  >
                    <div className="p-4 flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: `var(--nb-${tipos[(i + 1) % tipos.length]}-soft)`,
                          color: `var(--nb-${tipos[(i + 1) % tipos.length]})`,
                        }}
                      >
                        <Tag size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[var(--nb-fg)] truncate">
                          {c.titulo}
                        </p>
                        <p className="text-[11px] text-[var(--nb-fg-muted)] mt-0.5 truncate">
                          {c.descripcion?.slice(0, 80) || 'Sin descripción'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-[var(--nb-fg-subtle)]" />
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Sheet detalle */}
      {seleccionada && (
        <DetalleSheet campana={seleccionada} onClose={() => setSeleccionada(null)} />
      )}
    </div>
  )
}

function CampanaDestacada({ campana, onClick }: { campana: NbCampana; onClick: () => void }) {
  return (
    <GlassCard variant="elevated" radius="xl" interactive onClick={onClick}>
      <div className="relative overflow-hidden">
        {/* Aura de fondo */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90 pointer-events-none"
          style={{ background: 'var(--nb-gradient-aurora)' }}
        />
        <div className="relative z-10 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Chip tone="brand" variant="solid" size="sm">
              <Sparkles size={10} />
              Destacado
            </Chip>
            <Chip tone="warning" size="sm">
              <Gift size={10} />
              Exclusivo cliente
            </Chip>
          </div>
          <div>
            <h3 className="text-[20px] font-extrabold text-[var(--nb-fg)] tracking-[-0.02em] leading-tight">
              {campana.titulo}
            </h3>
            <p className="text-[13px] text-[var(--nb-fg-muted)] mt-1.5 leading-relaxed line-clamp-2">
              {campana.descripcion || 'Sin descripción disponible'}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--nb-fg-subtle)] font-semibold">
              Válido hasta {formatFechaCorta(campana.finVigencia)}
            </span>
            <GlassButton size="sm" variant="primary" iconRight={<ChevronRight size={12} />}>
              Ver detalle
            </GlassButton>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function DetalleSheet({ campana, onClose }: { campana: NbCampana; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm nb-anim-fade" onClick={onClose} />
      <div className="relative w-full max-w-[var(--nb-max-w)] nb-glass rounded-t-[28px] nb-anim-slide" style={{ maxHeight: '85vh' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-[var(--nb-border-strong)]" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--nb-fg)]">Detalle de la campaña</h3>
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
        <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <GlassCard variant="elevated" radius="xl">
            <div className="relative overflow-hidden">
              <div aria-hidden className="absolute inset-0 opacity-90 pointer-events-none" style={{ background: 'var(--nb-gradient-aurora)' }} />
              <div className="relative z-10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Chip tone="brand" variant="solid" size="sm">
                    <Star size={10} />
                    {campana.tipo || 'Promoción'}
                  </Chip>
                </div>
                <h3 className="text-[22px] font-extrabold text-[var(--nb-fg)] tracking-[-0.02em] leading-tight">
                  {campana.titulo}
                </h3>
                <p className="text-[14px] text-[var(--nb-fg-muted)] mt-2 leading-relaxed">
                  {campana.descripcion || 'Sin descripción disponible'}
                </p>
                {campana.inicioVigencia && (
                  <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-3 font-semibold">
                    Válido del {formatFechaCorta(campana.inicioVigencia)} al {formatFechaCorta(campana.finVigencia)}
                  </p>
                )}
              </div>
            </div>
          </GlassCard>
          <GlassButton
            fullWidth
            variant="primary"
            size="lg"
            className="mt-4"
            onClick={() => {
              window.open('https://wa.me/573000000000?text=Hola%2C%20me%20interesa%20la%20campa%C3%B1a', '_blank')
            }}
          >
            Quiero esta oferta
          </GlassButton>
        </div>
      </div>
    </div>
  )
}
