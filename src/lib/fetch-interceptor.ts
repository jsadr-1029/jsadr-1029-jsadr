// =====================================================
// Fetch interceptor - añade automáticamente el token JWT
// a todas las peticiones fetch hacia /api/*
// Maneja expiración de token con refresh automático
// =====================================================
//
// FIX-LOGOUT-INESPERADO: este interceptor ahora delega el refresh en
// el coordinador central `src/lib/token-refresh.ts`, que tiene:
//   - Single-flight local (una sola llamada HTTP a la vez por pestaña)
//   - Coordinación cross-tab vía BroadcastChannel
//   - Backoff tras fallo (no reintenta en 5 s)
// Esto elimina los race conditions que provocaban cierres de sesión
// inesperados cuando múltiples llamadas API recibían 401 a la vez.
// =====================================================

import {
  refreshTokens,
  clearAuthLocal,
  isAccessTokenExpired,
  installCrossTabRefreshListener,
} from '@/lib/token-refresh'

const TOKEN_KEY = 'access_token'
const PORTAL_TOKEN_PREFIX = 'portal_cliente_'

let interceptorInstalled = false

export function installFetchInterceptor() {
  if (interceptorInstalled) return
  if (typeof window === 'undefined') return

  // FIX-LOGOUT-INESPERADO: instalar el listener de coordinación cross-tab
  // para que esta pestaña se sincronice con otras al refrescar tokens.
  installCrossTabRefreshListener()

  const originalFetch = window.fetch

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const isApiCall = url.includes('/api/') || url.startsWith('/api/')

    // Solo interceptar peticiones a /api/*
    if (!isApiCall) {
      return originalFetch.call(window, input, init)
    }

    // No interceptar login, refresh ni logout
    if (
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout')
    ) {
      return originalFetch.call(window, input, init)
    }

    // FIX-LOGIN-LOOP: no interceptar llamadas del portal de cliente.
    // Estas llamadas usan el header `x-portal-token` y NO usan Authorization: Bearer.
    // Si las interceptamos, el intento de añadir Authorization con un token
    // `portal_cliente_...` (que no es JWT) rompe la llamada y dispara refresh
    // fallido → clearAuth() → redirect a /login → bucle.
    const existingHeaders = new Headers(init?.headers || {})
    if (existingHeaders.has('x-portal-token')) {
      return originalFetch.call(window, input, init)
    }

    // FIX-LOGIN-LOOP: tampoco interceptar endpoints del portal de cliente,
    // porque siempre se llaman con x-portal-token (seteado por PortalClienteModal).
    if (url.includes('/api/portal/') || url.startsWith('/api/portal')) {
      return originalFetch.call(window, input, init)
    }

    // Obtener token del localStorage
    let token = localStorage.getItem(TOKEN_KEY)

    // FIX-LOGIN-LOOP: si el "token" almacenado en realidad es un token de portal
    // de cliente (empieza con 'portal_cliente_'), NO es un JWT válido. No se
    // puede parsear, no se puede refrescar, y no se debe añadir como
    // Authorization: Bearer. En este caso, mejor NO tocar la petición.
    const isPortalToken = !!token && token.startsWith(PORTAL_TOKEN_PREFIX)
    if (isPortalToken) {
      // No añadir Authorization, no intentar refresh, no redirigir.
      // Simplemente pasar la petición tal cual al backend.
      const newInit: RequestInit = { ...init }
      const headers = new Headers(init?.headers || {})
      if (init?.body && !headers.has('Content-Type') && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json')
      }
      newInit.headers = headers
      return originalFetch.call(window, input, newInit)
    }

    // Verificar si el token está expirado antes de usarlo.
    // FIX-LOGOUT-INESPERADO: usar el helper del coordinador central para
    // mantener consistencia con apiFetch.
    if (token && isAccessTokenExpired(token)) {
      // Intentar refresh (con single-flight + coordinación cross-tab)
      const refreshed = await refreshTokens()
      if (refreshed) {
        token = localStorage.getItem(TOKEN_KEY)
      } else {
        // No se pudo refrescar, limpiar y redirigir a login
        clearAuthLocal()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return originalFetch.call(window, input, init)
      }
    }

    // Clonar init y headers
    const newInit: RequestInit = { ...init }
    const headers = new Headers(init?.headers || {})

    // Añadir Content-Type si hay body y no se especificó
    if (init?.body && !headers.has('Content-Type')) {
      if (typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json')
      }
    }

    // Añadir Authorization header si hay token
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    newInit.headers = headers

    // Hacer la petición
    const response = await originalFetch.call(window, input, newInit)

    // Si el token expiró (401), intentar refresh y reintentar
    if (response.status === 401 && token) {
      // FIX-LOGOUT-INESPERADO: usar el coordinador central (single-flight +
      // cross-tab) en vez del tryRefreshToken local que estaba aquí antes.
      const refreshed = await refreshTokens()
      if (refreshed) {
        const newToken = localStorage.getItem(TOKEN_KEY)
        if (newToken) {
          // Reintentar con nuevo token
          headers.set('Authorization', `Bearer ${newToken}`)
          newInit.headers = headers
          return originalFetch.call(window, input, newInit)
        }
      }
      // Si no se pudo refrescar, limpiar auth y redirigir
      clearAuthLocal()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return response
  }

  interceptorInstalled = true
}
