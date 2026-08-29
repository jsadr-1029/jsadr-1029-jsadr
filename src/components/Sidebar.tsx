'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ViewKey } from '@/app/page'
import { cn } from '@/lib/utils'
import { getUserData, logout, switchUser, getImpersonation, apiJson } from '@/lib/api-client'
import { vistasPermitidasUsuario } from '@/lib/permisos'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  DollarSign,
  Scale,
  Search,
  Zap,
  Shield,
  Settings,
  Landmark,
  ShieldAlert,
  MessageSquare,
  Settings2,
  Inbox,
  Crown,
  Users,
  Bell,
  LayoutDashboard,
  ChevronDown,
  LogOut,
  Repeat,
  ArrowLeftRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'

interface SidebarProps {
  view: ViewKey
  onChange: (view: ViewKey) => void
  /**
   * Cuando es true, fuerza la visibilidad del Sidebar sin importar
   * el ancho del dispositivo. Se usa en modo "PC" del toggle responsivo
   * para mostrar el sidebar incluso en pantallas pequeñas.
   */
  forceVisible?: boolean
  /**
   * Estado controlado del drawer móvil.
   * Si se pasa, el Sidebar se comporta también como drawer en mobile.
   */
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

// ---------- Tipos ----------
type LeafItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
  description: string
}

type MenuNode = LeafItem & {
  children?: LeafItem[]
}

// ---------- Catálogo completo con jerarquía ----------
// Estructura (simplificada — los submódulos son internos a cada vista):
//   - Solicitudes: tiene internamente Clientes, Cajas, Campañas, Simulador, Documentos, etc.
//     (solo "Clientes" se mantiene como acceso rápido en el menú)
//   - Seguridad: tiene internamente Conexiones API, Usuarios, Código Fuente, Manual,
//     Auditoría Seguridad y Exportar Base de Datos. NO se muestran como submenú.
const ALL_ITEMS: MenuNode[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs y resumen' },
  {
    key: 'prestamos',
    label: 'Solicitudes',
    icon: FileText,
    description: 'Solicitudes y créditos',
    children: [
      { key: 'clientes', label: 'Clientes', icon: Users, description: 'Empleados y clientes' },
    ],
  },
  { key: 'pagos', label: 'Pagos', icon: DollarSign, description: 'Recaudo y registro' },
  { key: 'juridico', label: 'Jurídico', icon: Scale, description: 'Casos legales' },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes', icon: Inbox, description: 'Solicitudes web del portal' },
  { key: 'portal', label: 'Portal Cliente', icon: Search, description: 'Consulta por cédula' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare, description: 'Chat con clientes' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell, description: 'Centro de avisos' },
  { key: 'automatizacion', label: 'Automatización', icon: Zap, description: 'Reglas y bots' },
  // Seguridad: ahora incluye internamente Conexiones API, Usuarios, Código Fuente,
  // Manual, Auditoría Seguridad y Exportar Base de Datos. No se muestran como submenú.
  { key: 'seguridad', label: 'Seguridad', icon: Shield, description: 'Auditoría, conexiones, usuarios y BD' },
  { key: 'admin', label: 'Administración', icon: Settings, description: 'Cuentas, categorías, contabilidad' },
  { key: 'portal-admin', label: 'Portal Admin', icon: Crown, description: 'Portal del administrador' },
  { key: 'configuracion', label: 'Configuración Global', icon: Settings2, description: 'Centro de configuración' },
]

export function Sidebar({ view, onChange, forceVisible = false, mobileOpen = false, onMobileOpenChange }: SidebarProps) {
  // Hook reactivo: re-lee el rol cuando cambia el estado de auth,
  // evitando que el Sidebar quede con un rol desactualizado tras un
  // switch-user o un refresh-token fallido.
  const { rol: reactiveRol } = useAuthReactive()
  const user = getUserData()
  const rol = reactiveRol || user?.rol || ''
  const username = user?.username

  // Filtrar items según rol/usuario usando la matriz centralizada.
  // Para los nodos con hijos: se incluye si el padre está permitido
  // O si al menos un hijo está permitido. Se filtran los hijos que no
  // estén permitidos.
  // Considera el bloqueo por usuario (P_jsadr → solo 'portal-admin').
  const menuItems = useMemo(() => {
    const permitidas = vistasPermitidasUsuario(username, rol)
    return ALL_ITEMS.map((item) => {
      if (item.children) {
        const hijosPermitidos = item.children.filter((c) => permitidas.includes(c.key))
        const padrePermitido = permitidas.includes(item.key)
        // Si ni el padre ni ningún hijo están permitidos, se descarta
        if (!padrePermitido && hijosPermitidos.length === 0) return null
        return { ...item, children: hijosPermitidos }
      }
      return permitidas.includes(item.key) ? item : null
    }).filter((x): x is MenuNode => x !== null)
  }, [rol, username])

  // Estado de expansión por grupo
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // v4.15 (QA M12 TC-UI-013): Estado de carga — mostrar Skeleton mientras
  // se obtiene el rol del usuario (evita flasheo de menú vacío en mobile/desktop).
  const [loading, setLoading] = useState(!rol)
  useEffect(() => {
    if (rol) setLoading(false)
  }, [rol])

  // Auto-expandir el grupo que contiene la vista activa
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const item of menuItems) {
        if (item.children && item.children.some((c) => c.key === view)) {
          next[item.key] = true
        }
      }
      return next
    })
  }, [view, menuItems])

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Wrapper que cierra el drawer móvil al seleccionar un item
  const handleSelect = (v: ViewKey) => {
    onChange(v)
    if (onMobileOpenChange) onMobileOpenChange(false)
  }

  return (
    <>
      {/* === Desktop Sidebar === */}
      <aside
        data-sidebar
        className={cn(
          'w-64 flex-col h-screen sticky top-0 text-sidebar-foreground border-r border-sidebar-border bg-sidebar backdrop-blur-xl',
          // En modo auto (default): oculto en pantallas < lg, visible en lg+
          // En modo desktop forzado: siempre visible
          forceVisible ? 'flex' : 'hidden lg:flex',
        )}
      >
        {loading ? (
          // v4.15 (QA M12 TC-UI-013): Skeleton loaders mientras se obtiene el rol
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="w-24 h-3" />
                <Skeleton className="w-16 h-2.5" />
              </div>
            </div>
            <Skeleton className="w-full h-9 rounded-lg" />
            <Skeleton className="w-full h-9 rounded-lg" />
            <Skeleton className="w-3/4 h-9 rounded-lg" />
            <Skeleton className="w-full h-9 rounded-lg" />
            <Skeleton className="w-2/3 h-9 rounded-lg" />
            <Skeleton className="w-full h-9 rounded-lg" />
            <Skeleton className="w-1/2 h-9 rounded-lg" />
          </div>
        ) : (
          <SidebarContent
            menuItems={menuItems}
            view={view}
            expanded={expanded}
            toggleGroup={toggleGroup}
            onChange={onChange}
            rol={rol}
          />
        )}
      </aside>

      {/* === Mobile Drawer === */}
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 lg:hidden"
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
        />
      )}
      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-[71] w-72 max-w-[85vw] flex flex-col text-sidebar-foreground border-r border-sidebar-border bg-sidebar backdrop-blur-xl lg:hidden transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!mobileOpen}
      >
        <SidebarContent
          menuItems={menuItems}
          view={view}
          expanded={expanded}
          toggleGroup={toggleGroup}
          onChange={handleSelect}
          onClose={() => onMobileOpenChange?.(false)}
          rol={rol}
        />
      </aside>
    </>
  )
}

// === Contenido compartido entre Desktop y Mobile ===
interface SidebarContentProps {
  menuItems: MenuNode[]
  view: ViewKey
  expanded: Record<string, boolean>
  toggleGroup: (key: string) => void
  onChange: (v: ViewKey) => void
  onClose?: () => void
  rol?: string
}

// =====================================================
// DrawerFooterAcciones — Botones de "Cambiar de cuenta"
// y "Cerrar sesión" que se muestran al final del drawer
// móvil. En desktop NO se muestran (el UserMenu superior
// derecho ya los tiene).
// =====================================================
interface UsuarioCambio {
  id: string
  nombre: string
  username: string
  email: string | null
  rol: string
  activo: boolean
}

function DrawerFooterAcciones({ onClose }: { onClose?: () => void }) {
  const { rol } = useAuthReactive()
  const user = getUserData()
  const effectiveRol = rol || user?.rol || ''
  const adminOriginal = getImpersonation()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [usuariosCambio, setUsuariosCambio] = useState<UsuarioCambio[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [cambiandoA, setCambiandoA] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const abrirModalCambio = useCallback(async () => {
    setSwitchError(null)
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

  const handleLogout = useCallback(() => {
    setConfirmLogout(false)
    logout()
  }, [])

  return (
    <>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {/* Info compacta del usuario */}
        {user && (
          <div className="px-3 py-2 mb-1 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs font-semibold text-white truncate">{user.nombre || 'Usuario'}</p>
            <p className="text-[10px] text-white/50 truncate">@{user.username} · {effectiveRol}</p>
          </div>
        )}

        {/* Cambiar de cuenta — SOLO ADMIN */}
        {effectiveRol === 'ADMIN' && (
          <button
            type="button"
            onClick={abrirModalCambio}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/20 transition-all"
          >
            <Repeat className="w-4 h-4" />
            Cambiar de cuenta
          </button>
        )}

        {/* Volver a admin — si está impersonando */}
        {adminOriginal && (
          <button
            type="button"
            onClick={volverAAdmin}
            disabled={!!cambiandoA}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-amber-200 hover:text-white hover:bg-amber-500/20 transition-all disabled:opacity-60"
          >
            {cambiandoA === adminOriginal.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="w-4 h-4" />
            )}
            Volver a {adminOriginal.nombre.split(' ')[0]}
          </button>
        )}

        {/* Cerrar sesión */}
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

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

      {/* Modal de cambio de cuenta */}
      {switchModalOpen && (
        <ModalCambioCuentaDrawer
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

// =====================================================
// ModalCambioCuentaDrawer — Modal para impersonar usuarios
// =====================================================
interface ModalCambioCuentaDrawerProps {
  usuarios: UsuarioCambio[]
  loading: boolean
  error: string | null
  cambiandoA: string | null
  onSelect: (u: UsuarioCambio) => void
  onClose: () => void
}

const ROLE_LABELS_M: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  CONSULTOR: 'Consultor',
}

const ROLE_COLORS_M: Record<string, string> = {
  ADMIN: 'from-fuchsia-500 to-purple-600',
  GESTOR: 'from-indigo-500 to-blue-600',
  CONSULTOR: 'from-cyan-500 to-teal-600',
}

function ModalCambioCuentaDrawer({
  usuarios,
  loading,
  error,
  cambiandoA,
  onSelect,
  onClose,
}: ModalCambioCuentaDrawerProps) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card-strong rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cambiar de cuenta</h3>
              <p className="text-[11px] text-white/50">Solo disponible para el administrador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!cambiandoA}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-white/60 mb-3 leading-relaxed">
          Seleccioná el usuario al que querés cambiarte. No vas a necesitar contraseña.
        </p>

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
              No hay otros usuarios disponibles.
            </div>
          )}

          {!loading && !error && usuarios.length > 0 && (
            <div className="space-y-1.5">
              {usuarios.map((u) => {
                const color = ROLE_COLORS_M[u.rol] || 'from-slate-500 to-slate-700'
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
                      <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                      <p className="text-[11px] text-white/50 truncate">
                        @{u.username} · {ROLE_LABELS_M[u.rol] || u.rol}
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

function SidebarContent({ menuItems, view, expanded, toggleGroup, onChange, onClose, rol }: SidebarContentProps) {
  return (
    <>
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl gradient-logo flex items-center justify-center shadow-lg glow-primary">
            <Landmark className="w-6 h-6 text-white" />
            <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white tracking-tight">
              Jsadr
            </h1>
            <p className="text-[11px] text-sidebar-foreground/60 font-medium">
              Sistema v3.6
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* === BOTÓN "REGRESAR AL INICIO" ===
            Acceso rápido al dashboard desde el drawer móvil.
            Solo visible en móvil (lg:hidden) ya que en desktop el dashboard
            ya está como primer item del menú. */}
        {onClose && (
          <button
            type="button"
            onClick={() => {
              onChange('dashboard' as ViewKey)
              onClose()
            }}
            className="lg:hidden w-full mb-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left text-white bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="truncate">Regresar al Inicio</div>
              <div className="text-[10px] text-sidebar-foreground/50">Volver al dashboard</div>
            </div>
          </button>
        )}

        {menuItems.map((item) => {
          // Si no tiene hijos → item plano original
          if (!item.children || item.children.length === 0) {
            return (
              <SidebarLeafButton
                key={item.key}
                item={item}
                active={view === item.key}
                onClick={() => onChange(item.key)}
              />
            )
          }

          // Grupo colapsable
          const isParentActive = view === item.key
          const isChildActive = item.children.some((c) => c.key === view)
          const isOpen = expanded[item.key] || isParentActive || isChildActive

          return (
            <div key={item.key} className="space-y-0.5">
              {/* Fila del grupo */}
              <div
                className={cn(
                  'group relative isolate w-full flex items-center gap-2 rounded-xl text-sm font-medium transition-all duration-200',
                  isParentActive && 'text-white',
                  !isParentActive && 'text-sidebar-foreground/70 hover:text-white hover:bg-white/5'
                )}
              >
                {/* Click en el cuerpo → ir al módulo padre */}
                <button
                  type="button"
                  onClick={() => onChange(item.key)}
                  className={cn(
                    'relative flex-1 flex items-center gap-3 px-3 py-2.5 rounded-l-xl text-left transition-all',
                    isParentActive && 'text-white'
                  )}
                >
                  {isParentActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-1 rounded-r-full bg-white shadow-[0_0_12px_2px_oklch(0.6_0.22_285/0.6)]" />
                  )}
                  {isParentActive && (
                    <span className="absolute inset-0 z-[-1] rounded-xl gradient-primary opacity-90 shadow-lg" />
                  )}
                  <item.icon
                    className={cn(
                      'relative w-4 h-4 shrink-0 transition-colors',
                      isParentActive
                        ? 'text-white'
                        : 'text-sidebar-foreground/60 group-hover:text-white'
                    )}
                  />
                  <div className="relative flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div
                      className={cn(
                        'text-[10px] truncate transition-colors',
                        isParentActive ? 'text-white/70' : 'text-sidebar-foreground/45'
                      )}
                    >
                      {item.description}
                    </div>
                  </div>
                </button>

                {/* Botón chevron → expandir/colapsar */}
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  aria-label={isOpen ? 'Contraer' : 'Expandir'}
                  className="shrink-0 px-2 py-2.5 text-sidebar-foreground/50 hover:text-white transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
              </div>

              {/* Hijos del grupo */}
              {isOpen && (
                <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5">
                  {item.children.map((child) => {
                    const childActive = view === child.key
                    const Icon = child.icon
                    return (
                      <button
                        key={child.key}
                        onClick={() => onChange(child.key)}
                        className={cn(
                          'group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 text-left',
                          childActive
                            ? 'text-white bg-white/10'
                            : 'text-sidebar-foreground/65 hover:text-white hover:bg-white/5'
                        )}
                      >
                        {childActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-white/80" />
                        )}
                        <Icon
                          className={cn(
                            'w-3.5 h-3.5 shrink-0 transition-colors',
                            childActive
                              ? 'text-white'
                              : 'text-sidebar-foreground/50 group-hover:text-white'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{child.label}</div>
                          <div
                            className={cn(
                              'text-[9px] truncate',
                              childActive ? 'text-white/70' : 'text-sidebar-foreground/40'
                            )}
                          >
                            {child.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {menuItems.length === 0 && (
          <div className="p-4 text-xs text-sidebar-foreground/50">
            No tienes módulos disponibles para tu rol ({rol}).
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50">
        <p className="font-semibold text-sidebar-foreground/70">Jsadr v3.6</p>
        <p className="mt-1">Interés fijo · Mora compuesta</p>
        <p className="mt-1">© {new Date().getFullYear()}</p>
      </div>

      {/* === ACCIONES DE USUARIO (solo móvil/drawer) ===
          Botones de "Cambiar de cuenta" y "Cerrar sesión" que se muestran
          al final del drawer móvil. En desktop NO se muestran (el UserMenu
          superior derecho ya los tiene). */}
      {onClose && <DrawerFooterAcciones onClose={onClose} />}
    </>
  )
}

// ---------- Sub-componente para item hoja ----------
interface SidebarLeafButtonProps {
  item: LeafItem
  active: boolean
  onClick: () => void
}

function SidebarLeafButton({ item, active, onClick }: SidebarLeafButtonProps) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative isolate w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left',
        active
          ? 'text-white'
          : 'text-sidebar-foreground/70 hover:text-white hover:bg-white/5'
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-1 rounded-r-full bg-white shadow-[0_0_12px_2px_oklch(0.6_0.22_285/0.6)]" />
      )}
      {active && (
        <span className="absolute inset-0 z-[-1] rounded-xl gradient-primary opacity-90 shadow-lg" />
      )}
      <Icon
        className={cn(
          'relative w-4 h-4 shrink-0 transition-colors',
          active ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-white'
        )}
      />
      <div className="relative flex-1 min-w-0">
        <div className="truncate">{item.label}</div>
        <div
          className={cn(
            'text-[10px] truncate transition-colors',
            active ? 'text-white/70' : 'text-sidebar-foreground/45'
          )}
        >
          {item.description}
        </div>
      </div>
    </button>
  )
}
