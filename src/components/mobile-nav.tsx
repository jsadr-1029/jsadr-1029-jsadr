'use client'

import * as React from 'react'
import { ViewKey } from '@/app/page'
import { cn } from '@/lib/utils'
import { getUserData } from '@/lib/api-client'
import { vistasPermitidas, puedeAcceder } from '@/lib/permisos'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  FileText,
  DollarSign,
  Home,
  Search,
  Menu,
  Scale,
  Zap,
  Shield,
  ShieldAlert,
  Settings,
  Bell,
  BarChart3,
  type LucideIcon,
  Users,
  Plug,
  Code2,
  BookOpen,
  LayoutDashboard,
  Landmark,
  Megaphone,
  Calculator,
  Inbox,
  MessageSquare,
  Crown,
  Settings2,
} from 'lucide-react'

interface MobileNavProps {
  current: ViewKey
  onChange: (view: ViewKey) => void
}

interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
}

// Catálogo completo
const ALL_PRIMARY: NavItem[] = [
  { key: 'prestamos', label: 'Préstamos', icon: FileText },
  { key: 'pagos', label: 'Pagos', icon: DollarSign },
  { key: 'portal', label: 'Portal', icon: Search },
]

const ALL_MORE: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'juridico', label: 'Jurídico', icon: Scale },
  { key: 'cajas', label: 'Cajas', icon: Landmark },
  { key: 'campanas', label: 'Campañas', icon: Megaphone },
  { key: 'simulador', label: 'Simulador', icon: Calculator },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes', icon: Inbox },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { key: 'automatizacion', label: 'Automatización', icon: Zap },
  { key: 'seguridad', label: 'Seguridad', icon: Shield },
  { key: 'auditoria', label: 'Auditoría', icon: ShieldAlert },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'conexiones', label: 'Conexiones', icon: Plug },
  { key: 'admin', label: 'Administración', icon: Settings },
  { key: 'portal-admin', label: 'Portal Admin', icon: Crown },
  { key: 'configuracion', label: 'Configuración', icon: Settings2 },
  { key: 'exportar', label: 'Reportes', icon: BarChart3 },
  { key: 'codigo-fuente', label: 'Código Fuente', icon: Code2 },
  { key: 'manual', label: 'Manual', icon: BookOpen },
]

export function MobileNav({ current, onChange }: MobileNavProps) {
  const [open, setOpen] = React.useState(false)
  const user = getUserData()
  const rol = user?.rol || ''

  // Filtrar por rol
  const permitidas = vistasPermitidas(rol)

  const primaryItems = ALL_PRIMARY.filter((i) => permitidas.includes(i.key))
  const moreItems = ALL_MORE.filter((i) => permitidas.includes(i.key))

  // Asegurar que 'dashboard' esté accesible (botón central) si el rol lo permite
  const hasDashboard = permitidas.includes('dashboard')

  const handleSelect = (view: ViewKey) => {
    onChange(view)
    setOpen(false)
  }

  const isInMore = moreItems.some((item) => item.key === current)
  // Si la vista actual no está permitida, redirigir a la primera disponible
  const currentValid = puedeAcceder(rol, current)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal móvil"
    >
      <div className="grid grid-cols-5 items-center gap-1 px-2 pt-2 pb-2">
        {/* --- Primer botón principal (Préstamos o el primero disponible) --- */}
        {primaryItems[0] && (
          <NavButton
            item={primaryItems[0]}
            active={current === primaryItems[0].key}
            onClick={() => handleSelect(primaryItems[0].key)}
          />
        )}

        {/* --- Segundo botón principal --- */}
        {primaryItems[1] && (
          <NavButton
            item={primaryItems[1]}
            active={current === primaryItems[1].key}
            onClick={() => handleSelect(primaryItems[1].key)}
          />
        )}

        {/* --- Inicio / Dashboard (botón central destacado) --- */}
        {hasDashboard && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => handleSelect('dashboard')}
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
        )}

        {/* --- Tercer botón principal --- */}
        {primaryItems[2] && (
          <NavButton
            item={primaryItems[2]}
            active={current === primaryItems[2].key}
            onClick={() => handleSelect(primaryItems[2].key)}
          />
        )}

        {/* --- Más (abre el Sheet solo si hay items adicionales) --- */}
        {moreItems.length > 0 && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Más módulos"
                aria-current={isInMore ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
                  isInMore || open
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Menu
                  className={cn(
                    'w-5 h-5 transition-transform duration-200',
                    open && 'rotate-90'
                  )}
                />
                <span className="text-[10px] font-medium leading-none">Más</span>
                {isInMore && !open && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_2px_oklch(0.55_0.22_285/0.6)]" />
                )}
              </button>
            </SheetTrigger>

            <SheetContent
              side="bottom"
              className="rounded-t-2xl border-t border-white/10 glass-card-strong p-0"
            >
              <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10">
                <SheetTitle className="text-white text-base">Más módulos</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 p-4 pb-6 max-h-[60vh] overflow-y-auto">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  const active = current === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelect(item.key)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        active
                          ? 'gradient-primary text-white shadow-lg'
                          : 'glass-card border border-white/10 text-foreground hover:bg-white/5'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  )
}

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
