'use client'

// =====================================================
// Header del Portal del Contador
// Selector de empresa + info del usuario + logout
// =====================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, LogOut, Building2, ChevronDown, User } from 'lucide-react'
import { useContadorAuth } from './contador-auth-provider'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function HeaderContador({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, empresas, empresaId, setEmpresaId, logout } = useContadorAuth()
  const router = useRouter()
  const [cerrando, setCerrando] = useState(false)

  const handleLogout = async () => {
    setCerrando(true)
    await logout()
    router.replace('/portal-contador')
    setCerrando(false)
  }

  const empresaActual = empresas.find((e) => e.id === empresaId)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="hidden items-center gap-2 text-sm text-slate-500 md:flex">
        <Building2 className="h-4 w-4 text-sky-600" />
        <span className="font-medium text-slate-700">Empresa:</span>
      </div>

      <div className="w-full max-w-xs">
        {empresas.length === 0 ? (
          <span className="text-sm text-slate-400">Sin empresa seleccionada</span>
        ) : (
          <Select value={empresaId || undefined} onValueChange={(v) => setEmpresaId(v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Seleccionar empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.razonSocial} · NIT {e.nit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {empresaActual && (
        <span className="hidden text-xs text-slate-400 lg:inline">
          {empresaActual.municipio ? `${empresaActual.municipio}` : ''}
          {empresaActual.departamento ? ` · ${empresaActual.departamento}` : ''}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-800">{user?.nombre}</p>
          <p className="text-[11px] text-slate-500">{user?.rol}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
          <User className="h-4 w-4" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={cerrando}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  )
}

export function EmpresaSelectorCompact() {
  const { empresas, empresaId, setEmpresaId } = useContadorAuth()
  if (empresas.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <ChevronDown className="h-3 w-3 text-slate-400" />
      <Select value={empresaId || undefined} onValueChange={(v) => setEmpresaId(v)}>
        <SelectTrigger className="h-8 w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {empresas.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.razonSocial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
