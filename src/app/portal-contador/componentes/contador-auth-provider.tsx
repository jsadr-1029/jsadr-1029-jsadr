'use client'

// =====================================================
// PORTAL DEL CONTADOR — Auth Provider + API client
// Gestiona token JWT, usuario, empresa seleccionada y
// helpers de peticiones autenticadas.
// =====================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

const TOKEN_KEY = 'contador_token'
const REFRESH_KEY = 'contador_refresh'
const EMPRESA_KEY = 'contador_empresa_id'

export interface ContadorUsuario {
  id: string
  username: string
  nombre: string
  email: string
  rol: string
  mustChangePassword: boolean
}

export interface ContadorEmpresa {
  id: string
  razonSocial: string
  nit: string
  municipio?: string | null
  departamento?: string | null
}

interface ContadorAuthContextValue {
  user: ContadorUsuario | null
  empresas: ContadorEmpresa[]
  empresaId: string | null
  token: string | null
  loading: boolean
  setEmpresaId: (id: string | null) => void
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>
  cambiarPassword: (actual: string, nueva: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const ContadorAuthContext = createContext<ContadorAuthContextValue | null>(null)

export function useContadorAuth(): ContadorAuthContextValue {
  const ctx = useContext(ContadorAuthContext)
  if (!ctx) {
    throw new Error('useContadorAuth debe usarse dentro de <ContadorAuthProvider>')
  }
  return ctx
}

// === API client autenticado ===
export async function apiContador(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(path, { ...options, headers })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: data?.error || `Error HTTP ${res.status}` }
    }
    return { ok: true, status: res.status, data }
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || 'Error de red' }
  }
}

export function ContadorAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ContadorUsuario | null>(null)
  const [empresas, setEmpresas] = useState<ContadorEmpresa[]>([])
  const [empresaId, setEmpresaIdState] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      setUser(null)
      setEmpresas([])
      setLoading(false)
      return
    }
    setToken(t)
    const r = await apiContador('/api/portal-contador/auth/me')
    if (r.ok && r.data?.data?.usuario) {
      setUser(r.data.data.usuario)
      setEmpresas(r.data.data.empresas || [])
      // Restaurar empresa seleccionada
      const saved = localStorage.getItem(EMPRESA_KEY)
      if (saved && (r.data.data.empresas || []).some((e: ContadorEmpresa) => e.id === saved)) {
        setEmpresaIdState(saved)
      } else if ((r.data.data.empresas || []).length > 0) {
        setEmpresaIdState(r.data.data.empresas[0].id)
      }
    } else {
      // Token inválido → limpiar
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      setUser(null)
      setEmpresas([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const setEmpresaId = useCallback((id: string | null) => {
    setEmpresaIdState(id)
    if (id) localStorage.setItem(EMPRESA_KEY, id)
    else localStorage.removeItem(EMPRESA_KEY)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await apiContador('/api/portal-contador/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (!r.ok) {
        return { ok: false, error: r.error || 'No se pudo iniciar sesión.' }
      }
      const data = r.data?.data
      if (!data?.access_token) {
        return { ok: false, error: 'Respuesta inválida del servidor.' }
      }
      localStorage.setItem(TOKEN_KEY, data.access_token)
      if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
      setToken(data.access_token)
      setUser(data.usuario)
      // Cargar empresas
      const me = await apiContador('/api/portal-contador/auth/me')
      if (me.ok && me.data?.data) {
        setEmpresas(me.data.data.empresas || [])
        if ((me.data.data.empresas || []).length > 0) {
          const saved = localStorage.getItem(EMPRESA_KEY)
          if (saved && (me.data.data.empresas || []).some((e: ContadorEmpresa) => e.id === saved)) {
            setEmpresaIdState(saved)
          } else {
            setEmpresaIdState(me.data.data.empresas[0].id)
            localStorage.setItem(EMPRESA_KEY, me.data.data.empresas[0].id)
          }
        }
      }
      return { ok: true, mustChangePassword: data.usuario?.mustChangePassword }
    },
    []
  )

  const cambiarPassword = useCallback(
    async (actual: string, nueva: string) => {
      const r = await apiContador('/api/portal-contador/auth/cambiar-password', {
        method: 'POST',
        body: JSON.stringify({ passwordActual: actual, nuevaPassword: nueva }),
      })
      if (!r.ok) {
        return { ok: false, error: r.error || 'No se pudo cambiar la contraseña.' }
      }
      const data = r.data?.data
      if (data?.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token)
        if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
        setToken(data.access_token)
      }
      if (data?.usuario) {
        setUser(data.usuario)
      }
      return { ok: true }
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      await apiContador('/api/portal-contador/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setToken(null)
    setUser(null)
    setEmpresas([])
    setEmpresaIdState(null)
  }, [])

  const value: ContadorAuthContextValue = {
    user,
    empresas,
    empresaId,
    token,
    loading,
    setEmpresaId,
    login,
    cambiarPassword,
    logout,
    refreshUser,
  }

  return <ContadorAuthContext.Provider value={value}>{children}</ContadorAuthContext.Provider>
}
