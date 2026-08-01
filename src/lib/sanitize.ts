// =====================================================
// LIBRERÍA DE SANITIZACIÓN PURA (CLIENT-SAFE) v1.0
// =====================================================
// Este módulo NO importa nada que dependa de Prisma, JWT o Node crypto.
// Es seguro para ser importado desde componentes del cliente ('use client').
//
// Razón: src/lib/security.ts importa `db` (Prisma), y Prisma no puede
// ejecutarse en el navegador. Antes, los componentes cliente que importaban
// sanitizeHtmlForHighlight desde @/lib/security provocaban el error:
//   "PrismaClient is unable to run in this browser environment"
// porque el bundler arrastraba toda la cadena db.ts → security.ts → cliente.
//
// Solución: extraer las funciones puras a este archivo independiente.
// =====================================================

/**
 * Sanitiza texto plano eliminando tags HTML y handlers peligrosos.
 */
export function sanitizeString(input: string): string {
  if (!input) return ''
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/**
 * Escapa caracteres HTML especiales para prevenir XSS.
 * Convierte < > & " ' en entidades HTML.
 * USO: <div>{escapeHtml(userInput)}</div>
 */
export function escapeHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitiza HTML para uso en resaltado de sintaxis (CodigoFuenteView).
 * Elimina tags peligrosos pero permite span/div con class para resaltado.
 * USO: <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlForHighlight(html) }} />
 */
export function sanitizeHtmlForHighlight(html: string): string {
  if (!html) return ''
  return html
    // Eliminar scripts completamente
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    // Eliminar event handlers on* (onclick, onerror, etc.)
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // Eliminar javascript: en href/src
    .replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*javascript:[^\s>]*/gi, '$1="#"')
    // Eliminar data: URIs peligrosos
    .replace(/(href|src)\s*=\s*["']data:text\/html[^"']*["']/gi, '$1="#"')
    // Eliminar style con expression() o javascript:
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/expression\s*\(/gi, '')
    // Eliminar comentarios HTML condicionales (IE)
    .replace(/<!--\[if[\s\S]*?\]>/gi, '')
}

/**
 * Sanitiza texto plano que se mostrará dentro de React (no necesita escape HTML
 * porque React escapa automáticamente, pero útil para inputs que se usan en
 * atributos o URLs).
 */
export function sanitizeForReactAttribute(input: string): string {
  if (!input) return ''
  return input
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Valida que un string sea seguro para usar como URL (href, src).
 * Bloquea javascript:, data: (excepto imágenes), vbscript:.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()
  // Bloquear esquemas peligrosos
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) {
    return false
  }
  if (trimmed.startsWith('data:') && !trimmed.startsWith('data:image/')) {
    return false
  }
  // Permitir http, https, mailto, tel, rutas relativas, anchors
  return /^(https?:|mailto:|tel:|\/|#|\.)/i.test(trimmed) || !trimmed.includes(':')
}

/**
 * CSP (Content Security Policy) recomendada para la aplicación.
 * Aplicar como header en middleware de producción.
 */
export const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requiere unsafe-eval en dev
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "frame-ancestors 'self' https://*.z.ai", // permitir iframe de z.ai preview
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePhone(phone: string): boolean {
  const re = /^\d{7,15}$/
  return re.test(phone.replace(/\D/g, ''))
}

export function validateCedula(cedula: string): boolean {
  const re = /^\d{6,12}$/
  return re.test(cedula.replace(/\D/g, ''))
}
