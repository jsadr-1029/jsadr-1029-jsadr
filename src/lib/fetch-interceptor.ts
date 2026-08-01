// =====================================================
// Fetch interceptor - añade automáticamente el token JWT
// a todas las peticiones fetch hacia /api/*
// Maneja expiración de token con refresh automático
// =====================================================

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'user_data'

// FIX-LOGIN-LOOP: prefijo que se usa cuando el "access_token" en realidad
// es un token de portal de cliente (no es un JWT). Lo setea /api/portal/login
// en login/page.tsx con: setTokens('portal_cliente_' + token, ...).
// Estos tokens NO son JWT, no se pueden parsear, no se pueden refrescar con
// /api/auth/refresh, y NO deben ser añadidos como Authorization: Bearer.
const PORTAL_TOKEN_PREFIX = 'portal_cliente_'

let interceptorInstalled = false
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

export function installFetchInterceptor() {
  if (interceptorInstalled) return
  if (typeof window === 'undefined') return

  const originalFetch = window.fetch

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const isApiCall = url.includes('/api/') || url.startsWith('/api/')

    // Solo interceptar peticiones a /api/*
    if (!isApiCall) {
      return originalFetch.call(window, input, init)
    }

    // No interceptar login o refresh
    if (url.includes('/api/auth/login') || url.includes('/api/auth/refresh')) {
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

    // Verificar si el token está expirado antes de usarlo
    if (token && isTokenExpired(token)) {
      // Intentar refresh
      const newToken = await tryRefreshToken()
      if (newToken) {
        token = newToken
      } else {
        // No se pudo refrescar, limpiar y redirigir a login
        clearAuth()
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
      const newToken = await tryRefreshToken()
      if (newToken) {
        // Reintentar con nuevo token
        headers.set('Authorization', `Bearer ${newToken}`)
        newInit.headers = headers
        return originalFetch.call(window, input, newInit)
      }
      // Si no se pudo refrescar, limpiar auth y redirigir
      clearAuth()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return response
  }

  interceptorInstalled = true
}

// Verificar si un token JWT está expirado
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(atob(parts[1]))
    if (!payload.exp) return false
    const now = Math.floor(Date.now() / 1000)
    // Considerar expirado si faltan menos de 30 segundos
    return now >= (payload.exp - 30)
  } catch {
    return true
  }
}

// Intentar refrescar el token
async function tryRefreshToken(): Promise<string | null> {
  // Si ya estamos refrescando, esperar a que termine
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return null

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data.success && data.data?.access_token) {
        localStorage.setItem(TOKEN_KEY, data.data.access_token)
        if (data.data.refresh_token) {
          localStorage.setItem(REFRESH_KEY, data.data.refresh_token)
        }
        return data.data.access_token
      }
      return null
    } catch {
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  // FIX-LOGIN-LOOP: limpiar también tokens de portal cliente y jurídico.
  localStorage.removeItem('portal_cliente_token')
  localStorage.removeItem('portal_cliente_id')
  localStorage.removeItem('portal_cliente_nombre')
  localStorage.removeItem('portal_cliente_cedula')
  localStorage.removeItem('juridico_token')
  localStorage.removeItem('juridico_user')
}
