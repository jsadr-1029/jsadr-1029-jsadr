'use client'

import * as React from 'react'
import { ViewKey } from '@/app/page'
import { cn } from '@/lib/utils'
import { getUserData } from '@/lib/api-client'
import { puedeAccederUsuario } from '@/lib/permisos'
import {
  FileText,
  DollarSign,
  Home,
  Search,
  Menu,
  Scale,
  Zap,
  Shield,
  Settings,
  Bell,
  ChevronDown,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface MobileNavProps {
  current: ViewKey
  onChange: (view: ViewKey) => void
  /**
   * Cuando es true, fuerza la visibilidad del MobileNav sin importar
   * el ancho del dispositivo. Se usa en modo "Móvil"/"Tablet" del
   * toggle responsivo para mostrar la barra inferior incluso en
   * pantallas grandes.
   */
  forceVisible?: boolean
}

interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
  children?: NavItem[]
}

/**
 * Botones principales del bottom nav (ordenados de izquierda a derecha).
 * El botón central (Inicio/Dashboard) se renderiza aparte con estilo destacado.
 */
const primaryItems: NavItem[] = [
  { key: 'prestamos', label: 'Préstamos', icon: FileText },
  { key: 'pagos', label: 'Pagos', icon: DollarSign },
  { key: 'portal', label: 'Portal', icon: Search },
]

// Nota: El botón "Más" fue eliminado del bottom nav porque abría un Sheet
// en la mitad de la pantalla que bloqueaba la navegación móvil.
// Ahora TODOS los módulos se acceden desde el botón hamburguesa superior-izquierdo
// que abre el Sidebar como drawer. (2026-08-05)

/**
 * Módulos adicionales que se muestran dentro del Sheet "Más".
 * Estructura simplificada — los submódulos son internos a cada vista:
 *   - Préstamos: Clientes, Cajas, Campañas, Simulador son internos (tabs)
 *   - Seguridad: Conexiones API, Usuarios, Código Fuente, Manual,
 *     Auditoría Seguridad y Exportar Base de Datos son internos.
 */
const moreItems: NavItem[] = [
  { key: 'juridico', label: 'Jurídico', icon: Scale },
  { key: 'automatizacion', label: 'Automatización', icon: Zap },
  { key: 'seguridad', label: 'Seguridad', icon: Shield },
  { key: 'admin', label: 'Administración', icon: Settings },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
]

/**
 * Grupo de módulos de Préstamos que se muestra como desplegable en el Sheet.
 * Solo "Clientes" — los demás (cajas, campañas, simulador) son internos
 * a la vista de Préstamos.
 */
const prestamosGroup: NavItem = {
  key: 'prestamos',
  label: 'Préstamos (más)',
  icon: FileText,
  children: [
    { key: 'clientes', label: 'Clientes', icon: Users },
  ],
}

/**
 * Barra de navegación inferior fija para dispositivos móviles.
 *
 * - Visible solo en móvil (`md:hidden`).
 * - Posicionada de forma fija en la parte inferior con glassmorphism.
 * - 5 accesos rápidos: Préstamos · Pagos · Inicio (central) · Portal · Más.
 * - El botón "Más" abre un `Sheet` con el resto de módulos.
 * - Respeta la safe area de iOS (`env(safe-area-inset-bottom)`).
 */
export function MobileNav({ current, onChange, forceVisible = false }: MobileNavProps) {
  const [open, setOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  // === Permisos por usuario ===
  // Verifica si el usuario actual puede acceder a cada vista.
  // Esto permite que P_jsadr (bloqueado a portal-admin) NO vea los botones
  // de Préstamos/Pagos/Portal que no puede usar.
  const user = getUserData()
  const puedeAcceder = (v: ViewKey) => puedeAccederUsuario(user?.username, user?.rol, v)

  const handleSelect = (view: ViewKey) => {
    onChange(view)
    setOpen(false)
  }

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Determinar si la vista actual está dentro de "Más"
  const isInMore = moreItems.some((item) => {
    if (item.key === current) return true
    if (item.children?.some((c) => c.key === current)) return true
    return false
  })

  // Auto-expandir el grupo que contiene la vista activa
  React.useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev }
      if (prestamosGroup.children?.some((c) => c.key === current)) {
        next[prestamosGroup.key] = true
      }
      for (const item of moreItems) {
        if (item.children?.some((c) => c.key === current)) {
          next[item.key] = true
        }
      }
      return next
    })
  }, [current])

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10',
        // FIX (2026-08-05): En modo auto, oculto en lg+ (no md+).
        //
        // Antes: `md:hidden` ocultaba el MobileNav en pantallas ≥ 768px.
        // Pero el Sidebar usa `hidden lg:flex` (visible solo en ≥ 1024px).
        // Eso dejaba un gap en tablets (768–1023px) donde NO había ni
        // Sidebar ni MobileNav → el usuario no podía navegar.
        //
        // Ahora: `lg:hidden` hace que el MobileNav se mantenga visible en
        // tablets (768–1023px) en modo auto, coincidiendo con el
        // breakpoint del Sidebar. En lg+ (≥ 1024px) se oculta porque el
        // Sidebar ya está visible.
        //
        // En modo móvil/tablet forzado: siempre visible (flex).
        forceVisible ? 'flex' : 'lg:hidden',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal móvil"
    >
      <div className="grid grid-cols-4 items-center gap-1 px-2 pt-2 pb-2">
        {/* --- Préstamos (solo si el usuario tiene acceso) --- */}
        {puedeAcceder('prestamos') ? (
          <NavButton
            item={primaryItems[0]}
            active={current === primaryItems[0].key}
            onClick={() => handleSelect(primaryItems[0].key)}
          />
        ) : (
          <div />
        )}

        {/* --- Pagos (solo si el usuario tiene acceso) --- */}
        {puedeAcceder('pagos') ? (
          <NavButton
            item={primaryItems[1]}
            active={current === primaryItems[1].key}
            onClick={() => handleSelect(primaryItems[1].key)}
          />
        ) : (
          <div />
        )}

        {/* --- Inicio / Dashboard (botón central destacado) ---
            Si el usuario no tiene dashboard (ej: P_jsadr), mostrar el portal
            dedicado al que sí tiene acceso. */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => handleSelect(puedeAcceder('dashboard') ? 'dashboard' : (current !== 'dashboard' ? current : 'dashboard'))}
            aria-label="Inicio"
            aria-current={current === 'dashboard' ? 'page' : undefined}
            className={cn(
              'relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-all',
              'gradient-primary glow-primary',
              current === 'dashboard' && 'ring-2 ring-white/40 scale-105'
            )}
          >
            <Home className="w-5 h-5 text-white" />
            <span className="text-[9px] font-semibold text-white leading-none mt-0.5">
              Inicio
            </span>
          </button>
        </div>

        {/* --- Portal (solo si el usuario tiene acceso) --- */}
        {puedeAcceder('portal') ? (
          <NavButton
            item={primaryItems[2]}
            active={current === primaryItems[2].key}
            onClick={() => handleSelect(primaryItems[2].key)}
          />
        ) : (
          <div />
        )}

        {/* El botón "Más" fue eliminado.
            Ahora TODOS los módulos están en el botón hamburguesa superior-izquierdo
            que abre el Sidebar como drawer. Esto evita el menú en la mitad de la pantalla. */}
      </div>
    </nav>
  )
}

// ---------- Sub-componentes ----------
interface NavButtonProps {
  item: NavItem
  active: boolean
  onClick: () => void
}

function NavButton({ item, active, onClick }: NavButtonProps) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
        active
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'w-5 h-5 transition-transform duration-200',
          active && 'scale-110'
        )}
      />
      <span className="text-[10px] font-medium leading-none">{item.label}</span>
      {active && (
        <span className="mt-0.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_2px_oklch(0.55_0.22_285/0.6)]" />
      )}
    </button>
  )
}

interface MobileLeafButtonProps {
  item: NavItem
  active: boolean
  onClick: () => void
}

function MobileLeafButton({ item, active, onClick }: MobileLeafButtonProps) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-left',
        active
          ? 'gradient-primary text-white shadow-lg'
          : 'glass-card border border-white/10 text-foreground hover:bg-white/5'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}

interface MobileGroupProps {
  item: NavItem
  current: ViewKey
  expanded: boolean
  onToggle: () => void
  onSelect: (view: ViewKey) => void
}

function MobileGroup({ item, current, expanded, onToggle, onSelect }: MobileGroupProps) {
  const isParentActive = current === item.key
  const isChildActive = !!item.children?.some((c) => c.key === current)
  const isOpen = expanded || isChildActive

  return (
    <div className="space-y-1">
      <div className="flex items-stretch gap-1">
        {/* Cuerpo del grupo → navegación al módulo padre */}
        <button
          type="button"
          onClick={() => onSelect(item.key)}
          className={cn(
            'flex-1 flex items-center gap-3 px-3 py-3 rounded-l-xl text-sm font-medium transition-all text-left',
            isParentActive
              ? 'gradient-primary text-white shadow-lg'
              : 'glass-card border border-white/10 text-foreground hover:bg-white/5'
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </button>
        {/* Chevron → expandir/colapsar */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? 'Contraer' : 'Expandir'}
          className={cn(
            'px-3 rounded-r-xl border border-l-0 border-white/10 transition-colors',
            isParentActive
              ? 'gradient-primary text-white shadow-lg'
              : 'glass-card text-muted-foreground hover:text-foreground hover:bg-white/5'
          )}
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {isOpen && item.children && (
        <div className="ml-4 pl-3 border-l border-white/10 space-y-1">
          {item.children.map((child) => {
            const childActive = current === child.key
            const Icon = child.icon
            return (
              <button
                key={child.key}
                type="button"
                onClick={() => onSelect(child.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all text-left',
                  childActive
                    ? 'bg-white/10 text-white'
                    : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{child.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
