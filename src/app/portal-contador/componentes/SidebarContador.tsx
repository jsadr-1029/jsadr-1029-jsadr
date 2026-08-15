'use client'

// =====================================================
// Sidebar profesional del Portal del Contador
// Menú jerárquico con secciones. Navy + blanco.
// =====================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Building2,
  Users,
  BookOpen,
  FileText,
  Wallet,
  Landmark,
  Briefcase,
  Truck,
  BadgeDollarSign,
  Boxes,
  Banknote,
  Scale,
  Target,
  FolderKanban,
  CalendarDays,
  Library,
  ShieldCheck,
  Eye,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  Brain,
  ScanLine,
  CheckSquare,
  FolderArchive,
  Calculator,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  soon?: boolean
}

interface NavSection {
  titulo: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    titulo: 'Principal',
    items: [{ label: 'Dashboard', href: '/portal-contador/dashboard', icon: LayoutDashboard }],
  },
  {
    titulo: 'Maestros',
    items: [
      { label: 'Empresas', href: '/portal-contador/empresas', icon: Building2 },
      { label: 'Terceros', href: '/portal-contador/terceros', icon: Users },
      { label: 'PUC / Catálogo', href: '/portal-contador/puc', icon: BookOpen },
      { label: 'Centros de Costo', href: '/portal-contador/centros-costo', icon: Target, soon: true },
    ],
  },
  {
    titulo: 'Contabilidad',
    items: [
      { label: 'Comprobantes', href: '/portal-contador/contabilidad', icon: FileText },
      { label: 'Períodos', href: '/portal-contador/periodos', icon: CalendarDays },
      { label: 'Bancos', href: '/portal-contador/bancos', icon: Landmark, soon: true },
      { label: 'Cartera', href: '/portal-contador/cartera', icon: Wallet, soon: true },
      { label: 'Proveedores', href: '/portal-contador/proveedores', icon: Truck, soon: true },
      { label: 'Nómina', href: '/portal-contador/nomina', icon: BadgeDollarSign, soon: true },
      { label: 'Activos', href: '/portal-contador/activos', icon: Boxes, soon: true },
      { label: 'Inventarios', href: '/portal-contador/inventarios', icon: Briefcase, soon: true },
      { label: 'Patrimonio', href: '/portal-contador/patrimonio', icon: Banknote, soon: true },
      { label: 'Proyectos', href: '/portal-contador/proyectos', icon: FolderKanban, soon: true },
    ],
  },
  {
    titulo: 'Tributario',
    items: [
      { label: 'Declaraciones', href: '/portal-contador/declaraciones', icon: FileText },
      { label: 'Impuestos', href: '/portal-contador/impuestos', icon: Calculator, soon: true },
      { label: 'Calendario Tributario', href: '/portal-contador/calendario-tributario', icon: CalendarDays, soon: true },
      { label: 'Centro Normativo', href: '/portal-contador/centro-normativo', icon: Library, soon: true },
    ],
  },
  {
    titulo: 'Control',
    items: [
      { label: 'Auditoría', href: '/portal-contador/auditoria', icon: ShieldCheck, soon: true },
      { label: 'Revisoría Fiscal', href: '/portal-contador/revisoria', icon: Eye, soon: true },
      { label: 'Riesgos', href: '/portal-contador/riesgos', icon: AlertTriangle, soon: true },
      { label: 'Antifraude', href: '/portal-contador/antifraude', icon: ShieldAlert, soon: true },
    ],
  },
  {
    titulo: 'Inteligencia',
    items: [
      { label: 'Reportes', href: '/portal-contador/reportes', icon: BarChart3, soon: true },
      { label: 'IA Contable', href: '/portal-contador/ia-contable', icon: Brain, soon: true },
      { label: 'OCR', href: '/portal-contador/ocr', icon: ScanLine, soon: true },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Tareas', href: '/portal-contador/tareas', icon: CheckSquare, soon: true },
      { label: 'Documentos', href: '/portal-contador/documentos', icon: FolderArchive, soon: true },
    ],
  },
]

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-sky-500/15 text-sky-200'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-sky-300' : 'text-slate-400 group-hover:text-sky-300')} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.soon && (
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
          Próx.
        </span>
      )}
    </Link>
  )
}

function NavSectionBlock({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
      >
        <span>{section.titulo}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <nav className="mt-1 space-y-0.5">
          {section.items.map((it) => (
            <NavLink key={it.href} item={it} onNavigate={onNavigate} />
          ))}
        </nav>
      )}
    </div>
  )
}

export function SidebarContador({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-500 text-white">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Portal del Contador</p>
          <p className="text-[11px] text-slate-400">JSADR · Contabilidad</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'thin' }}>
        {NAV.map((s) => (
          <NavSectionBlock key={s.titulo} section={s} onNavigate={onNavigate} />
        ))}
        <div className="px-5 py-4">
          <Link
            href="/"
            className="text-[11px] text-slate-500 hover:text-slate-300"
            onClick={onNavigate}
          >
            ← Volver a la plataforma
          </Link>
        </div>
      </div>
    </aside>
  )
}
