'use client'

import { ViewKey } from '@/app/page'
import { cn } from '@/lib/utils'
import { getUserData } from '@/lib/api-client'
import { vistasPermitidas } from '@/lib/permisos'
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
} from 'lucide-react'
import { useMemo } from 'react'

interface SidebarProps {
  view: ViewKey
  onChange: (view: ViewKey) => void
}

// Catálogo completo de items (todos los posibles)
const ALL_ITEMS: { key: ViewKey; label: string; icon: any; description: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs y resumen' },
  { key: 'prestamos', label: 'Préstamos', icon: FileText, description: 'Solicitudes y créditos' },
  { key: 'pagos', label: 'Pagos', icon: DollarSign, description: 'Recaudo y registro' },
  { key: 'clientes', label: 'Clientes', icon: Users, description: 'Empleados y clientes' },
  { key: 'juridico', label: 'Jurídico', icon: Scale, description: 'Casos legales' },
  { key: 'cajas', label: 'Cajas', icon: CajasIcon, description: 'Cajas menores y movimientos' },
  { key: 'campanas', label: 'Campañas', icon: Megaphone, description: 'Campañas y promociones' },
  { key: 'simulador', label: 'Simulador', icon: Calculator, description: 'Simulador de préstamos' },
  { key: 'buzon-solicitudes', label: 'Buzón Solicitudes', icon: Inbox, description: 'Solicitudes web del portal' },
  { key: 'portal', label: 'Portal Cliente', icon: Search, description: 'Consulta por cédula' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: MessageSquare, description: 'Chat con clientes' },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell, description: 'Centro de avisos' },
  { key: 'automatizacion', label: 'Automatización', icon: Zap, description: 'Reglas y bots' },
  { key: 'seguridad', label: 'Seguridad', icon: Shield, description: 'Auditoría y claves' },
  { key: 'auditoria', label: 'Auditoría Seguridad', icon: ShieldAlert, description: 'Auditoría técnica de seguridad' },
  { key: 'usuarios', label: 'Usuarios', icon: Users, description: 'Gestión de usuarios y roles' },
  { key: 'conexiones', label: 'Conexiones API', icon: Plug, description: 'Integraciones externas' },
  { key: 'admin', label: 'Administración', icon: Settings, description: 'Cuentas, categorías, contabilidad' },
  { key: 'portal-admin', label: 'Portal Admin', icon: Crown, description: 'Portal del administrador' },
  { key: 'configuracion', label: 'Configuración Global', icon: Settings2, description: 'Centro de configuración' },
  { key: 'exportar', label: 'Reportes', icon: BarChart3, description: 'Exportación de datos' },
  { key: 'codigo-fuente', label: 'Código Fuente', icon: Code2, description: 'Inspección y backup del código' },
  { key: 'manual', label: 'Manual', icon: BookOpen, description: 'Manual del sistema' },
]

export function Sidebar({ view, onChange }: SidebarProps) {
  const user = getUserData()
  const rol = user?.rol || ''

  // Filtrar items según rol usando la matriz centralizada
  const menuItems = useMemo(() => {
    const permitidas = vistasPermitidas(rol)
    return ALL_ITEMS.filter((item) => permitidas.includes(item.key))
  }, [rol])

  return (
    <aside data-sidebar className="w-64 hidden lg:flex flex-col h-screen sticky top-0 text-sidebar-foreground border-r border-sidebar-border bg-sidebar backdrop-blur-xl">
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
          const Icon = item.icon
          const isActive = view === item.key
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                'group relative isolate w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left',
                isActive
                  ? 'text-white'
                  : 'text-sidebar-foreground/70 hover:text-white hover:bg-white/5'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-1 rounded-r-full bg-white shadow-[0_0_12px_2px_oklch(0.6_0.22_285/0.6)]" />
              )}
              {isActive && (
                <span className="absolute inset-0 z-[-1] rounded-xl gradient-primary opacity-90 shadow-lg" />
              )}
              <Icon
                className={cn(
                  'relative w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-white'
                )}
              />
              <div className="relative flex-1 min-w-0">
                <div className="truncate">{item.label}</div>
                <div
                  className={cn(
                    'text-[10px] truncate transition-colors',
                    isActive ? 'text-white/70' : 'text-sidebar-foreground/45'
                  )}
                >
                  {item.description}
                </div>
              </div>
            </button>
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
