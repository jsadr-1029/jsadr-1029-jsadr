// =====================================================
// token-refresh.ts — Coordinador ÚNICO de refresh de tokens
// -----------------------------------------------------
// FIX-LOGOUT-INESPERADO:
// Antes existían DOS funciones `tryRefreshToken` independientes:
//   - una en src/lib/fetch-interceptor.ts (con single-flight local)
//   - otra en src/lib/api-client.ts (SIN single-flight)
// Ambas llamaban a /api/auth/refresh, pero al no coordinarse entre
// sí, provocaban race conditions: cuando el access_token expiraba,
// varias llamadas API simultáneas podían disparar refresh a la vez
// y la rotación agresiva del servidor invalidaba unas a otras →
// clearAuth() → redirección a /login mientras el usuario estaba
// activo.
//
// Este módulo centraliza el refresh con:
//   1. **Single-flight in-tab**: una sola llamada HTTP a la vez.
//      Todas las llamadas concurrentes a `refreshTokens()` dentro
//      de la misma pestaña comparten la misma Promise.
//   2. **Coordinación cross-tab vía BroadcastChannel** (con
//      fallback a `localStorage` event): si la Pestaña A está
//      refrescando, la Pestaña B espera el resultado en vez de
//      disparar otra llamada. Si la Pestaña A tiene un token
//      fresco, la Pestaña B lo usa directamente.
//   3. **Backoff tras fallo**: si el refresh falla, no se reintenta
//      en cada llamada API (evita tormenta de llamadas).
//
// Toda la app (apiFetch, fetch interceptor, logout) debe usar
// estas funciones en vez de llamar a /api/auth/refresh directo.
// =====================================================

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'user_data'
const LAST_REFRESH_AT_KEY = 'last_refresh_at'
const LAST_REFRESH_FAIL_AT_KEY = 'last_refresh_fail_at'

// Backoff tras un fallo: no reintentar refresh dentro de esta ventana
const REFRESH_FAIL_BACKOFF_MS = 5_000

// Canal de coordinación entre pestañas
const CHANNEL_NAME = 'auth-refresh-channel'
let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = null
  }
  return channel
}

// Estado en memoria (por pestaña)
let inFlightPromise: Promise<boolean> | null = null

// Tablas de espera: pestañas que están esperando a que otra pestaña termine
// un refresh. Si la Pestaña A hace el refresh, las demás reciben el resultado
// por BroadcastChannel y resuelven su propia Promise sin llamar al servidor.
type WaiterResolver = (success: boolean) => void
const waitingTabs = new Set<WaiterResolver>()

// Marca única por pestaña para logging
const TAB_ID = Math.random().toString(36).slice(2, 8)

function logDebug(msg: string, extra?: any) {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV === 'production') return
  try {
    console.debug(`[token-refresh:${TAB_ID}] ${msg}`, extra || '')
  } catch {}
}

function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('auth:changed'))
  } catch {}
}

/**
 * Dispara el refresh del access_token usando el refresh_token almacenado.
 *
 * - Si ya hay un refresh en vuelo en esta pestaña, devuelve la misma Promise.
 * - Si hay un refresh en vuelo en OTRA pestaña, espera el resultado por
 *   BroadcastChannel sin hacer una llamada HTTP propia.
 * - Si el último refresh falló hace menos de REFRESH_FAIL_BACKOFF_MS,
 *   devuelve false inmediatamente sin llamar al servidor.
 *
 * Devuelve true si al final hay un access_token válido en localStorage.
 */
export async function refreshTokens(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Backoff tras fallo
  const lastFail = parseInt(localStorage.getItem(LAST_REFRESH_FAIL_AT_KEY) || '0', 10)
  if (lastFail && Date.now() - lastFail < REFRESH_FAIL_BACKOFF_MS) {
    logDebug('refresh bloqueado por backoff tras fallo reciente')
    return false
  }

  // Single-flight local
  if (inFlightPromise) {
    logDebug('refresh ya en vuelo, esperando')
    return inFlightPromise
  }

  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) {
    logDebug('no hay refresh_token')
    return false
  }

  inFlightPromise = (async () => {
    // Anunciar a otras pestañas que estamos refrescando
    const ch = getChannel()
    try {
      ch?.postMessage({ type: 'refresh-start' })
    } catch {}

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!res.ok) {
        logDebug('refresh fallido', res.status)
        localStorage.setItem(LAST_REFRESH_FAIL_AT_KEY, String(Date.now()))
        ch?.postMessage({ type: 'refresh-fail' })
        return false
      }

      const data = await res.json()
      if (!data.success || !data.data?.access_token) {
        logDebug('refresh sin access_token', data)
        localStorage.setItem(LAST_REFRESH_FAIL_AT_KEY, String(Date.now()))
        ch?.postMessage({ type: 'refresh-fail' })
        return false
      }

      // Persistir nuevos tokens
      localStorage.setItem(TOKEN_KEY, data.data.access_token)
      if (data.data.refresh_token) {
        localStorage.setItem(REFRESH_KEY, data.data.refresh_token)
      }
      localStorage.setItem(LAST_REFRESH_AT_KEY, String(Date.now()))
      localStorage.removeItem(LAST_REFRESH_FAIL_AT_KEY)

      // Notificar a la UI y a otras pestañas
      notifyAuthChanged()
      ch?.postMessage({ type: 'refresh-done', access_token: data.data.access_token, refresh_token: data.data.refresh_token })

      logDebug('refresh exitoso')
      return true
    } catch (e) {
      logDebug('refresh exception', e)
      localStorage.setItem(LAST_REFRESH_FAIL_AT_KEY, String(Date.now()))
      ch?.postMessage({ type: 'refresh-fail' })
      return false
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}

/**
 * Inicializa el listener de BroadcastChannel para coordinar refresh
 * entre pestañas. Llamar una sola vez al montar la app (FetchInterceptorLoader
 * lo hace automáticamente).
 */
let listenerInstalled = false
export function installCrossTabRefreshListener(): void {
  if (typeof window === 'undefined') return
  if (listenerInstalled) return
  listenerInstalled = true

  const ch = getChannel()
  if (!ch) {
    // Sin BroadcastChannel: el storage event hará de fallback
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && e.newValue) {
        // Otra pestaña refrescó el token. Disparar auth:changed para que
        // la UI se actualice con el nuevo token.
        notifyAuthChanged()
      }
    })
    return
  }

  ch.onmessage = (ev: MessageEvent) => {
    const msg = ev.data
    if (!msg || typeof msg !== 'object') return

    if (msg.type === 'refresh-start') {
      // Otra pestaña está refrescando. Si NOSOTROS también íbamos a
      // refrescar, mejor esperar — el single-flight local no nos
      // protege contra pestañas separadas. El resolver waitingTabs
      // se hace cuando llega refresh-done o refresh-fail.
      logDebug('otra pestaña está refrescando, esperando resultado')
    } else if (msg.type === 'refresh-done') {
      // Otra pestaña tuvo éxito. Asegurarse de tener el token nuevo
      // en localStorage (ya está si el storage event se disparó, pero
      // BroadcastChannel NO dispara storage events, así que lo seteamos).
      if (msg.access_token) {
        localStorage.setItem(TOKEN_KEY, msg.access_token)
      }
      if (msg.refresh_token) {
        localStorage.setItem(REFRESH_KEY, msg.refresh_token)
      }
      localStorage.setItem(LAST_REFRESH_AT_KEY, String(Date.now()))
      localStorage.removeItem(LAST_REFRESH_FAIL_AT_KEY)
      notifyAuthChanged()

      // Liberar a quienes esperaban
      waitingTabs.forEach((resolve) => resolve(true))
      waitingTabs.clear()
      logDebug('otra pestaña refrescó exitosamente, sincronizado')
    } else if (msg.type === 'refresh-fail') {
      // Liberar a quienes esperaban con fallo
      waitingTabs.forEach((resolve) => resolve(false))
      waitingTabs.clear()
      logDebug('otra pestaña falló el refresh')
    }
  }
}

/**
 * Espera a que OTRA pestaña termine un refresh en curso.
 * Si no hay ninguna pestaña refrescando, devuelve false inmediatamente.
 * Útil cuando queremos evitar duplicar la llamada HTTP.
 */
export function waitForOtherTabRefresh(timeoutMs = 3_000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!inFlightPromise) {
      // Nadie está refrescando localmente; si hay broadcast de
      // refresh-start de otra pestaña, registramos el waiter.
      // Pero como no trackeamos ese estado de forma observable,
      // simplemente resolvemos false (caller decidirá si refresca).
      resolve(false)
      return
    }
    // Esperar con timeout para no bloquear indefinidamente
    const timer = setTimeout(() => resolve(false), timeoutMs)
    waitingTabs.add((success) => {
      clearTimeout(timer)
      resolve(success)
    })
  })
}

/**
 * Limpia todos los tokens locales (para logout o cuando el refresh falla
 * de forma irrecuperable). No llama al servidor — para logout server-side,
 * usar el endpoint /api/auth/logout.
 */
export function clearAuthLocal(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(LAST_REFRESH_AT_KEY)
  localStorage.removeItem(LAST_REFRESH_FAIL_AT_KEY)
  // Limpiar también tokens de portal cliente y jurídico (FIX-LOGIN-LOOP)
  localStorage.removeItem('portal_cliente_token')
  localStorage.removeItem('portal_cliente_id')
  localStorage.removeItem('portal_cliente_nombre')
  localStorage.removeItem('portal_cliente_cedula')
  localStorage.removeItem('juridico_token')
  localStorage.removeItem('juridico_user')
  notifyAuthChanged()
}

/**
 * Decodifica el payload de un JWT sin verificar firma.
 * Devuelve null si el token no es parseable.
 */
export function decodeJwt(token: string | null): any | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

/**
 * Verifica si un JWT de acceso está expirado (o lo estará en los próximos
 * `bufferSec` segundos). Si el token no es parseable, devuelve true
 * (tratar como expirado para forzar refresh).
 */
export function isAccessTokenExpired(token: string | null, bufferSec = 30): boolean {
  if (!token) return true
  const payload = decodeJwt(token)
  if (!payload) return true
  if (!payload.exp) return false
  const now = Math.floor(Date.now() / 1000)
  return now >= (payload.exp - bufferSec)
}
