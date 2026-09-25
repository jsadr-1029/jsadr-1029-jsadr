'use client'

// =====================================================
// Portal Neobanco Glass — Shell principal
// Layout mobile-first con bottom-tab navigation,
// header con switch de tema, y routing interno entre
// las 9 vistas del portal.
// =====================================================

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useNeobancoPortal, useNbTheme, type NbOtroSi } from './glass/useNeobancoPortal'
import { NbToastProvider, GlassButton, GlassCard, Sheet, useNbToast } from './glass/ui'

import { HubView } from './glass/views/HubView'
import { CreditosView } from './glass/views/CreditosView'
import { ProximosPagosView } from './glass/views/ProximosPagosView'
import { SimuladorView } from './glass/views/SimuladorView'
import { SolicitudesView } from './glass/views/SolicitudesView'
import { ChatView } from './glass/views/ChatView'
import { HistorialView } from './glass/views/HistorialView'
import { AvisosView } from './glass/views/AvisosView'
import { CampanasView } from './glass/views/CampanasView'

import {
  Home,
  Landmark,
  CalendarClock,
  Calculator,
  Send,
  History,
  Bell,
  Megaphone,
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  FileText,
  Sparkles,
  User,
} from 'lucide-react'

type Vista =
  | 'hub'
  | 'creditos'
  | 'proximos-pagos'
  | 'simulador'
  | 'solicitudes'
  | 'chat'
  | 'historial'
  | 'avisos'
  | 'campanas'

const TABS_PRIMARIOS: Array<{ key: Vista; label: string; icon: React.ReactNode; badgeKey?: 'mora' | 'avisos' }> = [
  { key: 'hub', label: 'Inicio', icon: <Home size={18} /> },
  { key: 'creditos', label: 'Créditos', icon: <Landmark size={18} /> },
  { key: 'proximos-pagos', label: 'Pagos', icon: <CalendarClock size={18} />, badgeKey: 'mora' },
  { key: 'simulador', label: 'Simular', icon: <Calculator size={18} /> },
  { key: 'mas', label: 'Más', icon: <MoreHorizontal size={18} /> } as any,
]

const TABS_SECUNDARIOS: Array<{ key: Vista; label: string; icon: React.ReactNode; desc: string }> = [
  { key: 'solicitudes', label: 'Solicitudes', icon: <FileText size={18} />, desc: 'Pide un nuevo crédito' },
  { key: 'chat', label: 'Chat', icon: <Send size={18} />, desc: 'Habla con tu asesor' },
  { key: 'historial', label: 'Historial', icon: <History size={18} />, desc: 'Pagos aplicados' },
  { key: 'avisos', label: 'Avisos', icon: <Bell size={18} />, desc: 'Notificaciones' },
  { key: 'campanas', label: 'Campañas', icon: <Megaphone size={18} />, desc: 'Ofertas para ti' },
]

export function PortalNeobancoGlass() {
  return (
    <NbToastProvider>
      <PortalShell />
    </NbToastProvider>
  )
}

function PortalShell() {
  const router = useRouter()
  const { estado, cargando, error, token, cedula, otrosSi, campanas, recargar } = useNeobancoPortal()
  const { theme, toggle } = useNbTheme()
  const toast = useNbToast()

  const [vista, setVista] = React.useState<Vista>('hub')
  const [verMas, setVerMas] = React.useState(false)
  const [verPerfil, setVerPerfil] = React.useState(false)

  // Contar avisos no leídos
  const avisosNoLeidos = React.useMemo(() => {
    let n = 0
    n += (estado?.proximosVencimientos ?? []).filter(
      (v) => (diasEntreLocal(v.fechaVencimiento) ?? 0) <= 3,
    ).length
    n += otrosSi.filter((o) => o.estado === 'PENDIENTE_FIRMA').length
    return n
  }, [estado, otrosSi])

  const enMora = (estado?.proximosVencimientos ?? []).filter(
    (v) => (diasEntreLocal(v.fechaVencimiento) ?? 0) < 0,
  ).length

  const cliente = estado?.cliente

  const handleCerrarSesion = React.useCallback(() => {
    try {
      localStorage.removeItem('portal_cliente_token')
      localStorage.removeItem('portal_cliente_cedula')
      localStorage.removeItem('portal_cliente_nombre')
      localStorage.removeItem('portal_cliente_id')
      localStorage.removeItem('access_token')
    } catch {}
    router.push('/login')
  }, [router])

  const irA = (v: string) => {
    setVista(v as Vista)
    setVerMas(false)
    setVerPerfil(false)
    // Scroll al top al cambiar de vista
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  // === Error fatal ===
  if (error && !estado) {
    return (
      <div
        style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }}
        className="flex items-center justify-center p-6"
      >
        <div className="nb-glass rounded-[24px] p-6 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--nb-danger-soft)] text-[var(--nb-danger)] flex items-center justify-center mx-auto mb-3">
            <LogOut size={20} />
          </div>
          <h2 className="text-base font-bold text-[var(--nb-fg)] mb-1">No pudimos cargar tu portal</h2>
          <p className="text-[13px] text-[var(--nb-fg-muted)] mb-4">{error}</p>
          <div className="flex flex-col gap-2">
            <GlassButton fullWidth variant="primary" onClick={recargar}>
              Reintentar
            </GlassButton>
            <GlassButton fullWidth variant="ghost" onClick={handleCerrarSesion}>
              Cerrar sesión
            </GlassButton>
          </div>
        </div>
      </div>
    )
  }

  // === Sesión no iniciada ===
  if (!token && !cargando) {
    return (
      <div
        style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }}
        className="flex items-center justify-center p-6"
      >
        <div className="nb-glass rounded-[24px] p-6 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center mx-auto mb-3">
            <User size={20} />
          </div>
          <h2 className="text-base font-bold text-[var(--nb-fg)] mb-1">Inicia sesión</h2>
          <p className="text-[13px] text-[var(--nb-fg-muted)] mb-4">
            Necesitas iniciar sesión como cliente para ver tu portal.
          </p>
          <GlassButton fullWidth variant="primary" onClick={() => router.push('/login')}>
            Ir al login
          </GlassButton>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ background: 'var(--nb-gradient-aurora)', minHeight: '100vh' }}
      className="flex justify-center"
    >
      {/* Contenedor móvil centrado */}
      <div className="w-full" style={{ maxWidth: 'var(--nb-max-w)' }}>
        {/* === HEADER === */}
        <header className="sticky top-0 z-30 px-4 h-14 flex items-center justify-between backdrop-blur-md bg-[var(--nb-surface)] border-b border-[var(--nb-border)]">
          <button
            onClick={() => setVista('hub')}
            className="nb-press flex items-center gap-2"
            aria-label="Inicio"
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--nb-gradient-brand)] flex items-center justify-center text-white shadow-[0_4px_12px_-2px_rgba(91,91,247,0.45)]">
              <Sparkles size={16} />
            </div>
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--nb-fg)]">
              JSADR
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Toggle tema */}
            <button
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="nb-press w-9 h-9 rounded-xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] flex items-center justify-center text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)]"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {/* Avisos */}
            <button
              onClick={() => setVista('avisos')}
              aria-label="Avisos"
              className="nb-press relative w-9 h-9 rounded-xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] flex items-center justify-center text-[var(--nb-fg-muted)] hover:text-[var(--nb-fg)]"
            >
              <Bell size={16} />
              {avisosNoLeidos > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--nb-danger)] text-white text-[10px] font-bold flex items-center justify-center">
                  {avisosNoLeidos > 9 ? '9+' : avisosNoLeidos}
                </span>
              )}
            </button>
            {/* Avatar / Perfil */}
            <button
              onClick={() => setVerPerfil(true)}
              aria-label="Mi perfil"
              className="nb-press w-9 h-9 rounded-xl bg-[var(--nb-gradient-brand)] text-white flex items-center justify-center text-[12px] font-bold shadow-[0_4px_12px_-2px_rgba(91,91,247,0.45)]"
            >
              {(cliente?.nombre || '?').slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {/* === CONTENIDO === */}
        <main className="px-4 pt-4" style={{ paddingBottom: 'calc(var(--nb-tabbar-h) + 16px)' }}>
          {vista === 'hub' && (
            <HubView estado={estado} cargando={cargando} avisosNoLeidos={avisosNoLeidos} onIrA={irA} />
          )}
          {vista === 'creditos' && (
            <CreditosView
              estado={estado}
              cargando={cargando}
              token={token}
              onAbrirEstadoCuenta={(pid) => window.open(`/api/estado-cuenta?prestamo=${pid}&token=${token}`, '_blank')}
            />
          )}
          {vista === 'proximos-pagos' && <ProximosPagosView estado={estado} cargando={cargando} />}
          {vista === 'simulador' && (
            <SimuladorView token={token} onCrearSolicitud={() => irA('solicitudes')} />
          )}
          {vista === 'solicitudes' && (
            <SolicitudesView token={token} cedula={cedula} onSolicitudCreada={() => toast.push('Solicitud enviada', 'success')} />
          )}
          {vista === 'chat' && <ChatView cliente={cliente ?? null} token={token} cedula={cedula} />}
          {vista === 'historial' && <HistorialView estado={estado} cargando={cargando} />}
          {vista === 'avisos' && (
            <AvisosView
              estado={estado}
              cargando={cargando}
              otrosSi={otrosSi}
              onAbrirOtroSi={(os) => window.open(`/api/portal/otros-si-pendientes/${os.id}/documento?token=${token}`, '_blank')}
            />
          )}
          {vista === 'campanas' && (
            <CampanasView campanas={campanas} cargando={cargando} token={token} />
          )}
        </main>

        {/* === BOTTOM TAB BAR === */}
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-full"
          style={{ maxWidth: 'var(--nb-max-w)' }}
          aria-label="Navegación principal"
        >
          <div className="mx-3 mb-3 nb-glass rounded-[24px] px-2 py-1.5 flex items-center justify-between shadow-[0_8px_32px_-8px_rgba(15,23,42,0.25)]">
            {TABS_PRIMARIOS.map((tab) => {
              const isMas = tab.key === ('mas' as any)
              const activo = vista === tab.key
              const badge = tab.badgeKey === 'mora' ? enMora : tab.badgeKey === 'avisos' ? avisosNoLeidos : 0
              if (isMas) {
                return (
                  <TabButton
                    key="mas"
                    label="Más"
                    icon={<MoreHorizontal size={18} />}
                    activo={false}
                    onClick={() => setVerMas(true)}
                  />
                )
              }
              return (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  icon={tab.icon}
                  activo={activo}
                  badge={badge}
                  onClick={() => irA(tab.key)}
                />
              )
            })}
          </div>
        </nav>

        {/* === SHEET "MÁS" === */}
        <Sheet open={verMas} onClose={() => setVerMas(false)} title="Más opciones">
          <div className="flex flex-col gap-2 pb-4">
            {TABS_SECUNDARIOS.map((t) => (
              <button
                key={t.key}
                onClick={() => irA(t.key)}
                className="nb-press flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] hover:border-[var(--nb-border-strong)] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--nb-primary-soft)] text-[var(--nb-primary)] flex items-center justify-center">
                  {t.icon}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[var(--nb-fg)]">{t.label}</p>
                  <p className="text-[12px] text-[var(--nb-fg-muted)]">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Sheet>

        {/* === SHEET PERFIL === */}
        <Sheet open={verPerfil} onClose={() => setVerPerfil(false)} title="Mi cuenta">
          {cliente && (
            <div className="flex flex-col gap-4 pb-4">
              <GlassCard radius="lg" variant="elevated">
                <div className="p-4 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--nb-gradient-brand)] text-white flex items-center justify-center text-[24px] font-bold mb-2 shadow-[0_8px_24px_-4px_rgba(91,91,247,0.45)]">
                    {cliente.nombre.slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-[16px] font-bold text-[var(--nb-fg)]">{cliente.nombre}</p>
                  <p className="text-[12px] text-[var(--nb-fg-muted)] mt-0.5">CC {cliente.cedula}</p>
                  {cliente.email && (
                    <p className="text-[11px] text-[var(--nb-fg-subtle)] mt-0.5">{cliente.email}</p>
                  )}
                </div>
              </GlassCard>

              <div className="grid grid-cols-2 gap-2.5">
                <GlassCard radius="md">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Créditos activos
                    </p>
                    <p className="text-[18px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {estado?.resumen.prestamosActivos ?? 0}
                    </p>
                  </div>
                </GlassCard>
                <GlassCard radius="md">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--nb-fg-subtle)] font-semibold">
                      Total pagado
                    </p>
                    <p className="text-[14px] font-bold text-[var(--nb-fg)] nb-tabular">
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(estado?.resumen.totalPagado ?? 0)}
                    </p>
                  </div>
                </GlassCard>
              </div>

              <button
                onClick={() => { setVerPerfil(false); irA('historial') }}
                className="nb-press flex items-center justify-between p-3.5 rounded-2xl bg-[var(--nb-surface-2)] border border-[var(--nb-border)] hover:border-[var(--nb-border-strong)]"
              >
                <span className="text-[14px] font-semibold text-[var(--nb-fg)]">Ver historial completo</span>
                <History size={16} className="text-[var(--nb-fg-muted)]" />
              </button>

              <GlassButton fullWidth variant="danger" iconLeft={<LogOut size={16} />} onClick={handleCerrarSesion}>
                Cerrar sesión
              </GlassButton>
              <p className="text-[11px] text-[var(--nb-fg-subtle)] text-center leading-relaxed">
                JSADR Microfinanzas · v1.0 Neobanco Glass
              </p>
            </div>
          )}
        </Sheet>
      </div>
    </div>
  )
}

function TabButton({
  label,
  icon,
  activo,
  badge = 0,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  activo: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="nb-press relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors min-w-[58px]"
      aria-label={label}
      aria-current={activo ? 'page' : undefined}
    >
      <span
        className={`flex items-center justify-center transition-colors ${activo ? 'text-[var(--nb-primary)]' : 'text-[var(--nb-fg-muted)]'}`}
      >
        {icon}
      </span>
      <span
        className={`text-[10px] font-semibold tracking-tight transition-colors ${activo ? 'text-[var(--nb-fg)] font-bold' : 'text-[var(--nb-fg-muted)]'}`}
      >
        {label}
      </span>
      {badge > 0 && (
        <span className="absolute top-0 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--nb-danger)] text-white text-[9px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {activo && (
        <span
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[var(--nb-gradient-brand)]"
          aria-hidden
        />
      )}
    </button>
  )
}

// Helper local (no importar de useNeobancoPortal para evitar ciclo)
function diasEntreLocal(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  return Math.floor((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}
