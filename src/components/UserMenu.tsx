'use client'

// =====================================================
// UserMenu v1.0 — Jsadr · Jo*** Se*** Al*** D** R**
// -----------------------------------------------------
// Reemplaza al antiguo botón PWA. Ahora es un menú
// flotante superior derecho que se adapta al dispositivo:
//
//  • Desktop (≥1024px): dropdown con info del usuario,
//    navegación rápida, acceso a perfil y cierre sesión.
//
//  • Mobile/Tablet (<1024px): botón hamburguesa que abre
//    un drawer lateral con la navegación completa, info
//    del usuario y cierre de sesión. La barra lateral
//    principal se oculta en móvil para maximizar espacio.
//
//  El menú detecta automáticamente el dispositivo con
//  un media query listener y renderiza la variante
//  adecuada. Incluye:
//    - Avatar con iniciales + gradiente de marca
//    - Indicador visual de rol (badge)
//    - Lista de vistas rápidas (6 accesos principales)
//    - Botón de cierre de sesión con confirmación
//    - Modo claro/oscuro no aplica (tema oscuro fijo)
//
//  También inyecta el meta viewport correcto para
//  evitar zoom no deseado en móviles y safe-area-insets
//  para iPhones con notch.
// =====================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserData, logout, switchUser, getImpersonation, apiJson } from '@/lib/api-client'
import { vistasPermitidas } from '@/lib/permisos'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
import {
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Shield,
  FileText,
  DollarSign,
  Inbox,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Crown,
  Scale,
  Search,
  Zap,
  ShieldAlert,
  Settings2,
  Landmark,
  Users,
  Plug,
  Code2,
  BookOpen,
  Bell,
  BarChart3,
  Calculator,
  Megaphone,
  Repeat,
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface UserMenuProps {
  currentView?: string
  onNavigate?: (view: string) => void
}

interface UserData {
  id?: string
  nombre?: string
  username?: string
  email?: string
  rol?: string
  esPortalCliente?: boolean
  cedula?: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  CONSULTOR: 'Consultor',
  ABOGADO: 'Abogado',
  CLIENTE: 'Cliente',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'from-fuchsia-500 to-purple-600',
  GESTOR: 'from-indigo-500 to-blue-600',
  CONSULTOR: 'from-cyan-500 to-teal-600',
  ABOGADO: 'from-amber-500 to-orange-600',
  CLIENTE: 'from-emerald-500 to-green-600',
}

const QUICK_NAV_ALL = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'prestamos', label: 'Préstamos', icon: FileText },
  { key: 'pagos', label: 'Pagos', icon: DollarSign },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes', icon: Inbox },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare },
  { key: 'seguridad', label: 'Seguridad', icon: Shield },
  { key: 'configuracion', label: 'Configuración', icon: Settings2 },
]

const FULL_NAV_ALL = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Principal' },
  { key: 'prestamos', label: 'Préstamos', icon: FileText, group: 'Operación' },
  { key: 'pagos', label: 'Pagos', icon: DollarSign, group: 'Operación' },
  { key: 'clientes', label: 'Clientes', icon: Users, group: 'Operación' },
  { key: 'juridico', label: 'Jurídico', icon: Scale, group: 'Operación' },
  { key: 'cajas', label: 'Cajas', icon: Landmark, group: 'Operación' },
  { key: 'campanas', label: 'Campañas', icon: Megaphone, group: 'Operación' },
  { key: 'simulador', label: 'Simulador', icon: Calculator, group: 'Operación' },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes Web', icon: Inbox, group: 'Operación' },
  { key: 'portal', label: 'Portal Cliente', icon: Search, group: 'Consulta' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare, group: 'Consulta' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell, group: 'Consulta' },
  { key: 'exportar', label: 'Reportes', icon: BarChart3, group: 'Consulta' },
  { key: 'manual', label: 'Manual', icon: BookOpen, group: 'Consulta' },
  { key: 'automatizacion', label: 'Automatización', icon: Zap, group: 'Sistema' },
  { key: 'seguridad', label: 'Seguridad', icon: Shield, group: 'Sistema' },
  { key: 'auditoria', label: 'Auditoría Seguridad', icon: ShieldAlert, group: 'Sistema' },
  { key: 'usuarios', label: 'Usuarios', icon: Users, group: 'Sistema' },
  { key: 'conexiones', label: 'Conexiones API', icon: Plug, group: 'Sistema' },
  { key: 'admin', label: 'Administración', icon: Settings, group: 'Sistema' },
  { key: 'portal-admin', label: 'Portal Admin', icon: Crown, group: 'Sistema' },
  { key: 'configuracion', label: 'Configuración Global', icon: Settings2, group: 'Sistema' },
  { key: 'codigo-fuente', label: 'Código Fuente', icon: Code2, group: 'Sistema' },
]

// Hook utilitario — filtra QUICK_NAV y FULL_NAV según el rol del usuario
function useFilteredNav() {
  const { rol } = useAuthReactive()
  const permitidas = vistasPermitidas(rol)
  return {
    QUICK_NAV: QUICK_NAV_ALL.filter((i) => permitidas.includes(i.key as any)),
    FULL_NAV: FULL_NAV_ALL.filter((i) => permitidas.includes(i.key as any)),
  }
}

function getInitials(nombre?: string): string {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface UsuarioCambio {
  id: string
  nombre: string
  username: string
  email: string | null
  rol: string
  activo: boolean
}

export function UserMenu({ currentView, onNavigate }: UserMenuProps) {
  // Hook reactivo: re-lee user_data del localStorage cuando cambia
  // (login, logout, switch-user, refresh-token fallido, storage event de
  // otra pestaña, focus en la ventana). Esto evita que el menú muestre
  // "Usuario" en lugar del rol real cuando el estado de auth cambia.
  const { user: reactiveUser, rol: reactiveRol } = useAuthReactive()
  const [user, setUser] = useState<UserData | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  // --- Cambio de cuenta (solo ADMIN) ---
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [usuariosCambio, setUsuariosCambio] = useState<UsuarioCambio[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [cambiandoA, setCambiandoA] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [adminOriginal, setAdminOriginal] = useState<{ id: string; nombre: string; username: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { QUICK_NAV, FULL_NAV } = useFilteredNav()

  // Cargar datos del usuario y detectar dispositivo
  useEffect(() => {
    setMounted(true)
    setUser(getUserData())
    setAdminOriginal(getImpersonation())

    // Detectar móvil/desktop con matchMedia
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Sincronizar el estado local `user` con el hook reactivo.
  // Cuando el hook reactivo detecte un cambio en localStorage
  // (vía evento `auth:changed`, `storage`, o `focus`), actualiza
  // el estado local del menú.
  useEffect(() => {
    if (reactiveUser) {
      setUser(reactiveUser as UserData)
    } else if (mounted && !reactiveUser) {
      // Si el hook reactivo dice que no hay user, confiar en eso
      setUser(null)
    }
  }, [reactiveUser, mounted])

  // --- Abrir modal de cambio de cuenta ---
  const abrirModalCambio = useCallback(async () => {
    setSwitchError(null)
    setDropdownOpen(false)
    setDrawerOpen(false)
    setSwitchModalOpen(true)
    if (usuariosCambio.length === 0) {
      setLoadingUsuarios(true)
      try {
        const data = await apiJson<{ success: boolean; data: UsuarioCambio[] }>('/api/usuarios?rol=all')
        if (data.success && Array.isArray(data.data)) {
          const yo = getUserData()
          const filtrados = data.data.filter(
            (u) =>
              u.activo &&
              ['GESTOR', 'CONSULTOR', 'ADMIN'].includes(u.rol) &&
              u.id !== yo?.id
          )
          setUsuariosCambio(filtrados)
        }
      } catch (e: any) {
        setSwitchError(e.message || 'Error al cargar usuarios')
      } finally {
        setLoadingUsuarios(false)
      }
    }
  }, [usuariosCambio.length])

  // --- Ejecutar el cambio de cuenta ---
  const ejecutarCambio = useCallback(async (target: UsuarioCambio) => {
    setSwitchError(null)
    setCambiandoA(target.id)
    try {
      const result = await switchUser(target.id, false)
      if (!result.success) {
        setSwitchError(result.error || 'No se pudo cambiar de cuenta')
        setCambiandoA(null)
        return
      }
      window.location.href = '/'
    } catch (e: any) {
      setSwitchError(e.message || 'Error inesperado')
      setCambiandoA(null)
    }
  }, [])

  // --- Volver a la cuenta original del admin ---
  const volverAAdmin = useCallback(async () => {
    if (!adminOriginal) return
    setSwitchError(null)
    setCambiandoA(adminOriginal.id)
    try {
      const result = await switchUser(adminOriginal.id, true)
      if (!result.success) {
        setSwitchError(result.error || 'No se pudo volver a la cuenta de administrador')
        setCambiandoA(null)
        return
      }
      window.location.href = '/'
    } catch (e: any) {
      setSwitchError(e.message || 'Error inesperado')
      setCambiandoA(null)
    }
  }, [adminOriginal])

  // Inyectar meta viewport robusto + safe-area CSS
  useEffect(() => {
    if (!mounted) return

    // Viewport meta
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!viewport) {
      viewport = document.createElement('meta')
      viewport.name = 'viewport'
      document.head.appendChild(viewport)
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover'

    // Theme color
    let theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!theme) {
      theme = document.createElement('meta')
      theme.name = 'theme-color'
      document.head.appendChild(theme)
    }
    theme.content = '#1a1530'

    // CSS responsive + safe areas (se inyecta una sola vez)
    if (!document.getElementById('usermenu-responsive-css')) {
      const style = document.createElement('style')
      style.id = 'usermenu-responsive-css'
      style.textContent = `
        html, body { -webkit-tap-highlight-color: transparent; }
        body { padding-bottom: env(safe-area-inset-bottom, 0px); }
        @media (max-width: 1023px) {
          /* En móvil ocultar sidebar principal y maximizar main */
          aside[data-sidebar], aside.sidebar-principal { display: none !important; }
          main { margin-left: 0 !important; }
          .main-container { padding: 12px !important; }
          /* Ajustar grids a 1 columna */
          .grid-cols-2:not(.keep-cols), .grid-cols-3:not(.keep-cols), .grid-cols-4:not(.keep-cols) {
            grid-template-columns: 1fr !important;
          }
          /* Drawer overlay */
          .usermenu-drawer-overlay {
            position: fixed; inset: 0; z-index: 9998;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease-out;
          }
          .usermenu-drawer {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: min(85vw, 360px); z-index: 9999;
            background: oklch(0.20 0.04 268 / 95%);
            backdrop-filter: blur(20px) saturate(150%);
            border-left: 1px solid oklch(0.35 0.05 275 / 35%);
            box-shadow: -16px 0 48px -12px rgba(0,0,0,0.6);
            transform: translateX(100%);
            animation: slideInRight 0.25s ease-out forwards;
            overflow-y: auto;
            padding-top: env(safe-area-inset-top, 0px);
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        }
        /* Botón flotante responsivo */
        .usermenu-fab {
          position: fixed;
          top: max(12px, env(safe-area-inset-top, 12px));
          right: 12px;
          z-index: 9997;
        }
      `
      document.head.appendChild(style)
    }

    return () => {
      // No removemos el CSS para mantener la responsividad en cambios de vista
    }
  }, [mounted])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Cerrar menús con tecla Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setDrawerOpen(false)
        setConfirmLogout(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = useCallback(() => {
    setConfirmLogout(false)
    setDropdownOpen(false)
    setDrawerOpen(false)
    logout()
  }, [])

  const handleNavigate = (key: string) => {
    setDropdownOpen(false)
    setDrawerOpen(false)
    if (onNavigate) {
      onNavigate(key)
    } else {
      // Si no hay callback, redirigir a la home con el view
      router.push(`/?view=${key}`)
    }
  }

  if (!mounted) return null

  // Para cliente del portal, no mostrar el menú completo
  // Usamos reactiveRol que también intenta decodificar el JWT si
  // user_data está incompleto, evitando el bug de mostrar "Usuario".
  const effectiveRol = reactiveRol || user?.rol || ''
  if (effectiveRol === 'CLIENTE' || user?.esPortalCliente) return null

  const roleLabel = ROLE_LABELS[effectiveRol] || effectiveRol || 'Usuario'
  const roleColor = ROLE_COLORS[effectiveRol] || 'from-indigo-500 to-purple-600'
  const initials = getInitials(user?.nombre)

  // ====== VARIANTE MOBILE: DRAWER ======
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú de navegación"
          className="usermenu-fab flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white border backdrop-blur-md transition-all shadow-lg"
          style={{
            background: 'linear-gradient(135deg, oklch(0.30 0.06 275 / 90%) 0%, oklch(0.25 0.05 268 / 90%) 100%)',
            borderColor: 'oklch(0.40 0.06 275 / 50%)',
          }}
        >
          <Menu className="w-4 h-4" />
          {user ? (
            <span className="hidden xs:inline text-xs opacity-90">{user.nombre?.split(' ')[0]}</span>
          ) : null}
          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${roleColor} flex items-center justify-center text-[10px] font-bold text-white`}>
            {initials}
          </div>
        </button>

        {drawerOpen && (
          <>
            <div
              className="usermenu-drawer-overlay"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="usermenu-drawer" role="dialog" aria-label="Menú de navegación">
              {/* Header del drawer */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl gradient-logo flex items-center justify-center shadow-lg">
                    <Landmark className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Jsadr</h2>
                    <p className="text-[10px] text-white/50">Jo*** Se*** Al*** D** R**</p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Info del usuario */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${roleColor} flex items-center justify-center text-base font-bold text-white shadow-lg`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {user?.nombre || 'Usuario'}
                    </p>
                    <p className="text-xs text-white/60 truncate">@{user?.username}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${roleColor}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navegación agrupada */}
              <nav className="flex-1 p-3 overflow-y-auto">
                {Object.entries(
                  FULL_NAV.reduce((acc, item) => {
                    if (!acc[item.group]) acc[item.group] = []
                    acc[item.group].push(item)
                    return acc
                  }, {} as Record<string, typeof FULL_NAV_ALL>)
                ).map(([group, items]) => (
                  <div key={group} className="mb-4">
                    <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      {group}
                    </p>
                    {items.map((item) => {
                      const Icon = item.icon
                      const active = currentView === item.key
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleNavigate(item.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                            active
                              ? 'text-white bg-gradient-to-r from-indigo-500/30 to-purple-500/20 border border-indigo-400/40'
                              : 'text-white/70 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>

              {/* Footer con logout */}
              <div className="p-3 border-t border-white/10">
                {/* Cambiar de cuenta — SOLO ADMIN */}
                {effectiveRol === 'ADMIN' && (
                  <button
                    onClick={abrirModalCambio}
                    className="w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-lg text-sm font-semibold text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/20 transition-all"
                  >
                    <Repeat className="w-4 h-4" />
                    Cambiar de cuenta
                  </button>
                )}
                {/* Volver a admin — si está impersonando */}
                {adminOriginal && (
                  <button
                    onClick={volverAAdmin}
                    disabled={!!cambiandoA}
                    className="w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-lg text-sm font-semibold text-amber-200 hover:text-white hover:bg-amber-500/20 transition-all disabled:opacity-60"
                  >
                    {cambiandoA === adminOriginal.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="w-4 h-4" />
                    )}
                    Volver a {adminOriginal.nombre.split(' ')[0]}
                  </button>
                )}
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/20 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </aside>

            {/* Confirmación de logout */}
            {confirmLogout && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="glass-card-strong rounded-2xl p-6 max-w-sm w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <LogOut className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">¿Cerrar sesión?</h3>
                  </div>
                  <p className="text-sm text-white/70 mb-5">
                    Vas a salir del sistema. Vas a tener que volver a iniciar sesión para acceder.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmLogout(false)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all shadow-lg"
                    >
                      Sí, salir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de cambio de cuenta (compartido mobile/desktop) */}
        {switchModalOpen && (
          <ModalCambioCuenta
            usuarios={usuariosCambio}
            loading={loadingUsuarios}
            error={switchError}
            cambiandoA={cambiandoA}
            onSelect={ejecutarCambio}
            onClose={() => {
              if (!cambiandoA) setSwitchModalOpen(false)
            }}
          />
        )}
      </>
    )
  }

  // ====== VARIANTE DESKTOP: DROPDOWN ======
  return (
    <div className="usermenu-fab" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="Menú de usuario"
        aria-expanded={dropdownOpen}
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-sm font-semibold text-white border backdrop-blur-md transition-all shadow-lg hover:shadow-xl"
        style={{
          background: dropdownOpen
            ? 'linear-gradient(135deg, oklch(0.34 0.08 280 / 95%) 0%, oklch(0.28 0.06 275 / 95%) 100%)'
            : 'linear-gradient(135deg, oklch(0.26 0.05 268 / 85%) 0%, oklch(0.22 0.04 268 / 85%) 100%)',
          borderColor: dropdownOpen
            ? 'oklch(0.50 0.10 280 / 60%)'
            : 'oklch(0.35 0.05 275 / 40%)',
        }}
      >
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${roleColor} flex items-center justify-center text-[11px] font-bold text-white shadow-md`}>
          {initials}
        </div>
        <span className="hidden lg:inline text-xs opacity-90 max-w-[120px] truncate">
          {user?.nombre?.split(' ')[0] || 'Usuario'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-72 rounded-2xl overflow-hidden border shadow-2xl"
          style={{
            background: 'oklch(0.20 0.04 268 / 95%)',
            backdropFilter: 'blur(20px) saturate(150%)',
            borderColor: 'oklch(0.35 0.05 275 / 35%)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Header del dropdown */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${roleColor} flex items-center justify-center text-base font-bold text-white shadow-lg`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.nombre || 'Usuario'}
                </p>
                <p className="text-xs text-white/60 truncate">@{user?.username}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Navegación rápida */}
          <div className="p-2 border-b border-white/10">
            <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Accesos rápidos
            </p>
            <div className="grid grid-cols-3 gap-1">
              {QUICK_NAV.map((item) => {
                const Icon = item.icon
                const active = currentView === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavigate(item.key)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-[10px] font-medium transition-all ${
                      active
                        ? 'text-white bg-gradient-to-br from-indigo-500/30 to-purple-500/20'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate w-full text-center">{item.label.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer con logout */}
          <div className="p-2">
            {/* Cambiar de cuenta — SOLO ADMIN */}
            {effectiveRol === 'ADMIN' && (
              <button
                onClick={abrirModalCambio}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg text-sm font-semibold text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/20 transition-all"
              >
                <Repeat className="w-4 h-4" />
                Cambiar de cuenta
              </button>
            )}
            {/* Volver a admin — si está impersonando */}
            {adminOriginal && (
              <button
                onClick={volverAAdmin}
                disabled={!!cambiandoA}
                className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg text-sm font-semibold text-amber-200 hover:text-white hover:bg-amber-500/20 transition-all disabled:opacity-60"
              >
                {cambiandoA === adminOriginal.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowLeftRight className="w-4 h-4" />
                )}
                Volver a {adminOriginal.nombre.split(' ')[0]}
              </button>
            )}
            <button
              onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de logout */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card-strong rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-white">¿Cerrar sesión?</h3>
            </div>
            <p className="text-sm text-white/70 mb-5">
              Vas a salir del sistema. Vas a tener que volver a iniciar sesión para acceder.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all shadow-lg"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cambio de cuenta (compartido mobile/desktop) */}
      {switchModalOpen && (
        <ModalCambioCuenta
          usuarios={usuariosCambio}
          loading={loadingUsuarios}
          error={switchError}
          cambiandoA={cambiandoA}
          onSelect={ejecutarCambio}
          onClose={() => {
            if (!cambiandoA) setSwitchModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default UserMenu

// =====================================================
// ModalCambioCuenta — Modal para que el ADMIN seleccione
// a qué usuario interno cambiar sin contraseña.
// =====================================================

interface ModalCambioCuentaProps {
  usuarios: UsuarioCambio[]
  loading: boolean
  error: string | null
  cambiandoA: string | null
  onSelect: (u: UsuarioCambio) => void
  onClose: () => void
}

const ROLE_LABELS_MODAL: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  CONSULTOR: 'Consultor',
}

const ROLE_COLORS_MODAL: Record<string, string> = {
  ADMIN: 'from-fuchsia-500 to-purple-600',
  GESTOR: 'from-indigo-500 to-blue-600',
  CONSULTOR: 'from-cyan-500 to-teal-600',
}

function ModalCambioCuenta({
  usuarios,
  loading,
  error,
  cambiandoA,
  onSelect,
  onClose,
}: ModalCambioCuentaProps) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card-strong rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cambiar de cuenta</h3>
              <p className="text-[11px] text-white/50">
                Solo disponible para el administrador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!cambiandoA}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Descripción */}
        <p className="text-xs text-white/60 mb-3 leading-relaxed">
          Seleccioná el usuario al que querés cambiarte. No vas a necesitar
          contraseña: se emitirá un token de sesión temporal con los permisos
          del rol destino. Para volver a tu cuenta de admin usá el botón
          <b className="text-amber-300"> &quot;Volver a&quot;</b> que aparecerá en este mismo menú.
        </p>

        {/* Lista de usuarios */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-white/60">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Cargando usuarios…</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          {!loading && !error && usuarios.length === 0 && (
            <div className="p-6 text-center text-white/50 text-sm">
              No hay otros usuarios disponibles para impersonar.
            </div>
          )}

          {!loading && !error && usuarios.length > 0 && (
            <div className="space-y-1.5">
              {usuarios.map((u) => {
                const color = ROLE_COLORS_MODAL[u.rol] || 'from-slate-500 to-slate-700'
                const initials = (u.nombre || '?')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()
                const estaCambiando = cambiandoA === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => onSelect(u)}
                    disabled={!!cambiandoA}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-xs font-bold text-white shadow-md shrink-0`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {u.nombre}
                      </p>
                      <p className="text-[11px] text-white/50 truncate">
                        @{u.username} · {ROLE_LABELS_MODAL[u.rol] || u.rol}
                      </p>
                    </div>
                    {estaCambiando ? (
                      <Loader2 className="w-4 h-4 animate-spin text-fuchsia-300 shrink-0" />
                    ) : (
                      <ArrowLeftRight className="w-4 h-4 text-white/40 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={!!cambiandoA}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white/80 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
