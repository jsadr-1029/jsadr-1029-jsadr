// =====================================================
// API Client con manejo automático de tokens JWT
// =====================================================

import { refreshTokens, clearAuthLocal, isAccessTokenExpired } from '@/lib/token-refresh'

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'user_data'

// Dispara un evento custom `auth:changed` para que los componentes
// (UserMenu, Sidebar, useAuthReactive) puedan reaccionar a cambios
// de sesión sin tener que re-leer localStorage en cada render.
function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('auth:changed'))
  } catch {}
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
  notifyAuthChanged()
}

export function setUserData(user: any): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  notifyAuthChanged()
}

export function getUserData(): any | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return
  // FIX-LOGOUT-INESPERADO: usar el coordinador central para que se
  // limpie también el estado del refresh (backoff, last_refresh_at, etc.)
  // y se notifique a otras pestañas.
  clearAuthLocal()
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/**
 * Wrapper de fetch que añade automáticamente el Authorization header
 * y maneja expiración de token (refresh automático coordinado).
 *
 * FIX-LOGOUT-INESPERADO: antes este wrapper llamaba a su propia
 * `tryRefreshToken()` sin single-flight ni coordinación cross-tab.
 * Ahora delega en `refreshTokens()` del coordinador central, que:
 *   - Evita llamadas simultáneas a /api/auth/refresh dentro de la misma pestaña.
 *   - Coordina refresh entre pestañas vía BroadcastChannel.
 *   - Aplica backoff tras fallos para no disparar tormenta de llamadas.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }

  // Añadir JSON content-type si hay body y no se especifica
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // FIX-LOGIN-LOOP: si el "token" almacenado es en realidad un token de portal
  // de cliente (empieza con 'portal_cliente_'), NO es un JWT. No se puede
  // añadir como Authorization: Bearer (rompería las llamadas), y no se puede
  // refrescar con /api/auth/refresh. En este caso, no tocamos Authorization.
  const isPortalToken = !!token && token.startsWith('portal_cliente_')
  if (token && !isPortalToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, { ...options, headers })

  // Si el token expiró, intentar refresh — pero solo para tokens JWT reales
  // (no para tokens de portal de cliente).
  if (response.status === 401 && token && !isPortalToken) {
    // FIX-LOGOUT-INESPERADO: usar el coordinador central, que tiene single-flight
    // y coordinación cross-tab. Esto evita que múltiples llamadas API simultáneas
    // disparen múltiples refresh a la vez.
    const refreshed = await refreshTokens()
    if (refreshed) {
      // Reintentar con nuevo token
      const newToken = getToken()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
        return fetch(url, { ...options, headers })
      }
    }
    // Si no se pudo refrescar, limpiar auth y redirigir a login.
    // Solo redirigir si NO es una llamada iniciada por el usuario activamente
    // (para no sacarlo en medio de una acción). El coordinador aplica backoff
    // tras el primer fallo, así que no volverá a intentar por 5 s.
    clearAuth()
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  return response
}

/**
 * Wrapper para JSON - convierte respuesta a JSON
 */
export async function apiJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, options)
  if (!response.ok) {
    const text = await response.text()
    let errorMsg = `HTTP ${response.status}`
    try {
      const j = JSON.parse(text)
      errorMsg = j.error || j.message || errorMsg
    } catch {
      if (text) errorMsg = text
    }
    throw new Error(errorMsg)
  }
  return response.json()
}

// La función tryRefreshToken() local fue eliminada y reemplazada por
// `refreshTokens()` en src/lib/token-refresh.ts para centralizar el
// refresh y evitar race conditions entre pestañas y entre interceptores.

/**
 * Login con username y password
 */
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; requiresMFA?: boolean; data?: any }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!data.success) {
      return { success: false, error: data.error || 'Error en login' }
    }
    if (data.requiresMFA) {
      return { success: false, requiresMFA: true, data: data.data }
    }
    if (data.data?.access_token) {
      setTokens(data.data.access_token, data.data.refresh_token)
      setUserData(data.data.usuario)
      return { success: true, data: data.data }
    }
    return { success: false, error: 'Respuesta inválida del servidor' }
  } catch (e: any) {
    return { success: false, error: e.message || 'Error de conexión' }
  }
}

/**
 * Logout - limpia tokens locales Y revoca la sesión en el servidor.
 *
 * FIX-LOGOUT-INESPERADO: antes el logout era solo client-side, lo que
 * dejaba el refresh_token válido hasta 7 días. Ahora llamamos al
 * endpoint /api/auth/logout que borra `Usuario.sessionToken` en BD,
 * invalidando inmediatamente todos los refresh_token emitidos.
 *
 * IMPORTANTE: la revocación server-side se dispara con `keepalive: true`
 * para que sobreviva a la navegación a /login. La redirección ocurre
 * INMEDIATAMENTE después de limpiar localStorage, sin esperar al fetch
 * — si el servidor tarda o cae, el usuario igualmente es sacado de la
 * sesión localmente.
 *
 * Esta función es async para permitir `await logout()` cuando se quiere
 * confirmar que la revocación se completó (ej: en un flujo de "cerrar
 * todas las sesiones" desde la página de seguridad). Pero en la mayoría
 * de los casos basta con llamarla sin await.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  const accessToken = getToken()

  // 1) Limpiar localmente INMEDIATAMENTE para que la UI refleje el logout
  //    sin esperar a la red.
  clearAuth()
  clearImpersonation()

  // 2) Disparar revocación server-side en background. `keepalive: true`
  //    permite que el request se complete incluso después de que
  //    naveguemos a /login. Si falla, no rompe nada — el token refrescará
  //    solo durante 7 días más, pero el usuario ya está fuera localmente.
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && !accessToken.startsWith('portal_cliente_')
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      keepalive: true,
    })
  } catch (e) {
    // Mejor esfuerzo: si la red falla, ya limpiamos localmente.
    console.warn('[logout] No se pudo notificar al servidor:', e)
  }

  // 3) Redirigir a login. Se hace al final para que el fetch con keepalive
  //    tenga oportunidad de enviarse (algunos navegadores cancelan
  //    requests pendientes al navegar, pero keepalive lo mitiga).
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

/**
 * Logout síncrono (legacy) — solo limpia tokens locales sin llamar al servidor.
 * Útil cuando se quiere hacer logout rápido sin await (ej: desde el auto-logout
 * por inactividad, donde queremos redirigir instantáneamente).
 *
 * Para logout completo (con revocación server-side), usar `await logout()`.
 */
export function logoutLocal(): void {
  clearAuth()
  clearImpersonation()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

// =====================================================
// IMPERSONACIÓN (solo ADMIN)
// -----------------------------------------------------
// Cuando un ADMIN cambia de cuenta desde el menú de
// usuario, guardamos quién era el admin original en
// localStorage para poder "volver" sin contraseña.
// =====================================================

const IMPERSONATION_KEY = 'impersonation_admin'

interface ImpersonationInfo {
  id: string
  nombre: string
  username: string
}

export function setImpersonation(admin: ImpersonationInfo): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(admin))
}

export function getImpersonation(): ImpersonationInfo | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(IMPERSONATION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationInfo
  } catch {
    return null
  }
}

export function clearImpersonation(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(IMPERSONATION_KEY)
}

/**
 * Cambia de cuenta a otro usuario interno sin contraseña.
 * Requiere que la sesión actual sea ADMIN.
 *
 * @param targetUserId  ID del usuario destino (GESTOR, CONSULTOR o ADMIN)
 * @param volverA        true cuando se está volviendo a la cuenta original
 *                       del admin desde una sesión impersonada — usa
 *                       /api/auth/switch-back que valida el claim
 *                       `impersonatedBy` del JWT.
 */
export async function switchUser(
  targetUserId: string,
  volverA: boolean = false
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const url = volverA ? '/api/auth/switch-back' : '/api/auth/switch-user'
    const res = await apiFetch(url, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    })
    const data = await res.json()
    if (!data.success) {
      return { success: false, error: data.error || 'No se pudo cambiar de cuenta' }
    }
    setTokens(data.data.access_token, data.data.refresh_token)
    setUserData(data.data.usuario)
    if (data.data.impersonatedBy && data.data.adminOriginal) {
      setImpersonation(data.data.adminOriginal)
    } else {
      clearImpersonation()
    }
    return { success: true, data: data.data }
  } catch (e: any) {
    return { success: false, error: e.message || 'Error de conexión' }
  }
}
