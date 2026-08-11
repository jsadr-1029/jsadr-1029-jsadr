/**
 * Helper centralizado para obtener la URL base pública de la aplicación.
 *
 * PROBLEMA PREVIO:
 *   Varios endpoints usaban `process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'`
 *   y como NEXT_PUBLIC_BASE_URL no estaba configurada en Vercel, los links enviados
 *   a los clientes (firma electrónica, aceptación T&C, pagos, recibos, verificación
 *   de documentos) apuntaban a localhost — inalcanzable desde un teléfono móvil.
 *
 * SOLUCIÓN:
 *   Este helper usa múltiples fuentes con fallback robusto al dominio de producción.
 *   Orden de prioridad:
 *     1. NEXT_PUBLIC_APP_URL  (preferido — nombre canónico)
 *     2. NEXT_PUBLIC_BASE_URL (legacy — mantener compatibilidad)
 *     3. VERCEL_URL           (auto-inyectada por Vercel en previews)
 *     4. https://jsadr.com.co (dominio de producción hardcoded como último recurso)
 *
 *   Cualquier link generado para enviar al cliente (WhatsApp, email, SMS) DEBE
 *   usar esta función. No usar `http://localhost:3000` como fallback NUNCA.
 */
export function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (explicit) {
    // Quitar trailing slash si existe
    return explicit.replace(/\/+$/, '')
  }

  // Fallback final: dominio de producción conocido.
  // NO usar localhost aquí — si llegamos a este punto es porque ninguna variable
  // de entorno está configurada, y localhost es inalcanzable desde un cliente.
  return 'https://jsadr.com.co'
}

/**
 * Construye una URL absoluta a partir de una ruta relativa.
 *
 * @example
 *   buildAbsoluteUrl('/firma/abc123')     → 'https://jsadr.com.co/firma/abc123'
 *   buildAbsoluteUrl('/?tyc=token')        → 'https://jsadr.com.co/?tyc=token'
 *   buildAbsoluteUrl('/api/verificar?c=x') → 'https://jsadr.com.co/api/verificar?c=x'
 */
export function buildAbsoluteUrl(path: string): string {
  const base = getBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}
