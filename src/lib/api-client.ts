// =====================================================
// API Client con manejo automático de tokens JWT
// =====================================================

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'user_data'

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
}

export function setUserData(user: any): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
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
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  // FIX-LOGIN-LOOP: limpiar también tokens de portal cliente y jurídico,
  // que antes quedaban huérfanos y provocaban bucles de redirección.
  localStorage.removeItem('portal_cliente_token')
  localStorage.removeItem('portal_cliente_id')
  localStorage.removeItem('portal_cliente_nombre')
  localStorage.removeItem('juridico_token')
  localStorage.removeItem('juridico_user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/**
 * Wrapper de fetch que añade automáticamente el Authorization header
 * y maneja expiración de token (refresh automático)
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

  // Añadir Authorization header si hay token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, { ...options, headers })

  // Si el token expiró, intentar refresh
  if (response.status === 401 && token) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // Reintentar con nuevo token
      const newToken = getToken()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
        return fetch(url, { ...options, headers })
      }
    }
    // Si no se pudo refrescar, limpiar auth y redirigir a login
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

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.success && data.data?.access_token) {
      localStorage.setItem(TOKEN_KEY, data.data.access_token)
      if (data.data.refresh_token) {
        localStorage.setItem(REFRESH_KEY, data.data.refresh_token)
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

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
 * Logout - limpia tokens y redirige a login
 */
export function logout(): void {
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
