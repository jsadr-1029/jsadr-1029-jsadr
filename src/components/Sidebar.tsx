'use client'

import { useState, useEffect } from 'react'
import { ViewKey } from '@/app/page'
import { cn } from '@/lib/utils'
import { getUserData } from '@/lib/api-client'
import { vistasPermitidas } from '@/lib/permisos'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
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
  Plug,
  Code2,
  BookOpen,
  Bell,
  BarChart3,
  Landmark as CajasIcon,
  Calculator,
  Megaphone,
  LayoutDashboard,
  ChevronDown,
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
// Estructura:
//   - Préstamos agrupa: Cajas, Campañas, Simulador
//   - Seguridad agrupa: Conexiones API, Usuarios, Código Fuente, Manual
const ALL_ITEMS: MenuNode[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs y resumen' },
  {
    key: 'prestamos',
    label: 'Préstamos',
    icon: FileText,
    description: 'Solicitudes y créditos',
    children: [
      { key: 'cajas', label: 'Cajas', icon: CajasIcon, description: 'Cajas menores y movimientos' },
      { key: 'campanas', label: 'Campañas', icon: Megaphone, description: 'Campañas y promociones' },
      { key: 'simulador', label: 'Simulador', icon: Calculator, description: 'Simulador de préstamos' },
    ],
  },
  { key: 'pagos', label: 'Pagos', icon: DollarSign, description: 'Recaudo y registro' },
  { key: 'clientes', label: 'Clientes', icon: Users, description: 'Empleados y clientes' },
  { key: 'juridico', label: 'Jurídico', icon: Scale, description: 'Casos legales' },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes', icon: Inbox, description: 'Solicitudes web del portal' },
  { key: 'portal', label: 'Portal Cliente', icon: Search, description: 'Consulta por cédula' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare, description: 'Chat con clientes' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell, description: 'Centro de avisos' },
  { key: 'automatizacion', label: 'Automatización', icon: Zap, description: 'Reglas y bots' },
  {
    key: 'seguridad',
    label: 'Seguridad',
    icon: Shield,
    description: 'Auditoría y claves',
    children: [
      { key: 'conexiones', label: 'Conexiones API', icon: Plug, description: 'Integraciones externas' },
      { key: 'usuarios', label: 'Usuarios', icon: Users, description: 'Gestión de usuarios y roles' },
      { key: 'codigo-fuente', label: 'Código Fuente', icon: Code2, description: 'Inspección y backup del código' },
      { key: 'manual', label: 'Manual', icon: BookOpen, description: 'Manual del sistema' },
    ],
  },
  { key: 'auditoria', label: 'Auditoría Seguridad', icon: ShieldAlert, description: 'Auditoría técnica de seguridad' },
  { key: 'admin', label: 'Administración', icon: Settings, description: 'Cuentas, categorías, contabilidad' },
  { key: 'portal-admin', label: 'Portal Admin', icon: Crown, description: 'Portal del administrador' },
  { key: 'configuracion', label: 'Configuración Global', icon: Settings2, description: 'Centro de configuración' },
  { key: 'exportar', label: 'Reportes', icon: BarChart3, description: 'Exportación de datos' },
]

export function Sidebar({ view, onChange, forceVisible = false }: SidebarProps) {
  // Hook reactivo: re-lee el rol cuando cambia el estado de auth,
  // evitando que el Sidebar quede con un rol desactualizado tras un
  // switch-user o un refresh-token fallido.
  const { rol: reactiveRol } = useAuthReactive()
  const user = getUserData()
  const rol = reactiveRol || user?.rol || ''

  // Filtrar items según rol usando la matriz centralizada.
  // Para los nodos con hijos: se incluye si el padre está permitido
  // O si al menos un hijo está permitido. Se filtran los hijos que no
  // estén permitidos.
  const menuItems = useMemo(() => {
    const permitidas = vistasPermitidas(rol)
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
  }, [rol])

  // Estado de expansión por grupo
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  return (
    <aside
      data-sidebar
      className={cn(
        'w-64 flex-col h-screen sticky top-0 text-sidebar-foreground border-r border-sidebar-border bg-sidebar backdrop-blur-xl',
        // En modo auto (default): oculto en pantallas < lg, visible en lg+
        // En modo desktop forzado: siempre visible
        forceVisible ? 'flex' : 'hidden lg:flex',
      )}
    >
      <div className="p-6 border-b border-sidebar-border">
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
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
    </aside>
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
