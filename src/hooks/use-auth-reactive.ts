// =====================================================
// useAuthReactive — Hook reactivo de sesión de usuario
// -----------------------------------------------------
// SOLUCIONA: el UserMenu y el Sidebar a veces mostraban
// "Usuario" en lugar de "Administrador" porque solo leían
// getUserData() una vez al montar. Si el localStorage se
// limpiaba después (por un 401 fallido en el interceptor,
// por un switch-user, o por logout en otra pestaña), la UI
// no se enteraba.
//
// Este hook:
//   1. Lee getUserData() inicialmente.
//   2. Se suscribe a un evento custom `auth:changed` que
//      debe dispararse cada vez que se modifica el estado
//      de auth (login, logout, switch-user, refresh-user).
//   3. También escucha el evento nativo `storage` para
//      sincronizar entre pestañas.
//   4. Re-lee getUserData() cuando el usuario vuelve a
//      enfocar la pestaña (por si cambió en otra ventana).
// =====================================================

'use client'

import { useEffect, useState } from 'react'
import { getUserData, getToken } from '@/lib/api-client'

export interface ReactiveUser {
  id?: string
  nombre?: string
  username?: string
  email?: string
  rol?: string
  cedula?: string
  esPortalCliente?: boolean
  [k: string]: any
}

export const AUTH_CHANGED_EVENT = 'auth:changed'

/**
 * Dispara el evento `auth:changed` en la ventana actual.
 * Llamar después de cualquier setUserData / clearAuth para
 * que la UI se sincronice inmediatamente (sin esperar al
 * storage event, que solo dispara en OTRAS pestañas).
 */
export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

/**
 * Decodifica el payload de un JWT sin verificarlo (solo
 * para extraer el rol como fallback cuando user_data no
 * está disponible). NO usar para validar autenticidad.
 */
export function decodeJwtRol(token: string | null): string | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload?.rol || null
  } catch {
    return null
  }
}

export function useAuthReactive(): {
  user: ReactiveUser | null
  rol: string
  isAuthenticated: boolean
  /** Forzar una re-lectura del localStorage */
  refresh: () => void
} {
  const [user, setUser] = useState<ReactiveUser | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const refresh = () => {
    setUser(getUserData() as ReactiveUser | null)
    setToken(getToken())
  }

  useEffect(() => {
    refresh()

    // Suscripción a eventos custom (misma pestaña)
    const onAuthChanged = () => refresh()
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    // Suscripción a storage event (otras pestañas)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user_data' || e.key === 'access_token' || e.key === null) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)

    // Re-leer al volver a enfocar la pestaña
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const isAuthenticated = !!token
  // Si el user_data no tiene rol, intentar decodificar el JWT
  const rol = user?.rol || decodeJwtRol(token) || ''

  return { user, rol, isAuthenticated, refresh }
}
