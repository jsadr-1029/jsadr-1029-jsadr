// =====================================================
// src/proxy.ts — Proxy de Seguridad (Next.js 16+)
// (anteriormente middleware.ts — renombrado por deprecación de la
//  convención "middleware" en Next.js 16; ver https://nextjs.org/docs/messages/middleware)
// Centro único de seguridad perimetral:
//  • CORS estricto con whitelist
//  • CSRF check (Origin/Referer) en mutaciones
//  • Body limit (10 MB)
//  • JWT verification en producción
//  • Rate limiting escalonado por endpoint
//  • Headers de seguridad reforzados (CSP, HSTS, X-Frame-Options, etc.)
//  • Redirect HTTPS en producción
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// === CONFIGURACIÓN DE RATE LIMITING GLOBAL ===
// Límites por IP y por endpoint crítico (escalonados)
const RATE_LIMIT_GENERAL = 100   // 100 req/min por IP en endpoints generales
const RATE_LIMIT_AUTH = 10       // 10 req/min en /api/auth/* y /api/portal/auth
const RATE_LIMIT_OTP = 5         // 5 req/min en /api/chat/otp y /api/prestamos/*/aceptar-tyc-otp
const RATE_LIMIT_EXPORT = 5      // 5 req/min en /api/export, /api/paz-y-salvo, /api/estado-cuenta
const RATE_LIMIT_BACKUP = 3      // 3 req/min en /api/backups/* y /api/snapshots/*
const RATE_LIMIT_PORTAL = 30     // 30 req/min en /api/portal/* (cliente)

// === Rate limiter in-memory (Edge-compatible, sin crypto) ===
interface RateLimitEntry { count: number; resetTime: number }
const rateLimitMap = new Map<string, RateLimitEntry>()
function rateLimit(identifier: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
  }
  entry.count++
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime }
}
// Limpiar entradas expiradas cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, e] of rateLimitMap.entries()) {
      if (now > e.resetTime) rateLimitMap.delete(key)
    }
  }, 5 * 60 * 1000)
}

// === CONFIGURACIÓN CORS ESTRICTA ===
// FIX-LOGIN-LOOP: antes solo se permitía https://localhost:3000, pero el dev
// server usa http://localhost:3000 → el navegador enviaba Origin: http://...
// y el check CSRF bloqueaba el POST /api/auth/login con 403 CSRF_DENIED.
// Añadimos http://localhost en cualquier puerto para dev, además de los
// dominios de preview de z.ai y los dominios de producción Vercel.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,https://localhost:3000,https://preview-*.space-z.ai,https://*.vercel.app')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

// === Límite de cuerpo de petición (10 MB) ===
const MAX_BODY_BYTES = 10 * 1024 * 1024

// === Endpoints públicos: NO requieren JWT ===
function isPublicEndpoint(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/mfa') ||
    pathname.startsWith('/api/auth/refresh') ||
    pathname.startsWith('/api/auth/recuperar-clave') ||
    pathname.startsWith('/api/portal/auth') ||
    pathname.startsWith('/api/portal/') || // portal usa x-portal-token
    pathname.startsWith('/api/admin/portal/auth') || // login del portal administrador (1214731649 / 731649)
    pathname.startsWith('/api/juridico/portal/auth') || // login del portal jurídico (abogados con cédula + clave)
    pathname.startsWith('/api/chat/iniciar') || // inicio de chat con cédula+teléfono (sin token previo)
    pathname.startsWith('/api/chat/otp') || // solicitud/verificación OTP del chat
    pathname === '/api/simulador' // simulador público
  )
}

// === Validación de Origin para prevenir CSRF ===
function isCSRFSafe(req: NextRequest): boolean {
  // Para peticiones GET/HEAD/OPTIONS no se valida Origin (no causan state changes)
  const method = req.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // Si no hay Origin ni Referer, denegar (los navegadores siempre los envían en POST)
  if (!origin && !referer) {
    // Allow same-origin curl/server-to-server (sin headers) en desarrollo
    return process.env.NODE_ENV !== 'production'
  }

  // Validar Origin contra whitelist
  if (origin) {
    return ALLOWED_ORIGINS.some(allowed => {
      if (allowed.startsWith('*.')) {
        return origin.endsWith(allowed.slice(1)) || origin === allowed.slice(2)
      }
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
        return regex.test(origin)
      }
      return origin === allowed
    })
  }

  // Si hay Referer pero no Origin, validar Referer
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return ALLOWED_ORIGINS.some(allowed => {
        if (allowed.startsWith('*.')) {
          return refererUrl.hostname.endsWith(allowed.slice(1))
        }
        if (allowed.includes('*')) {
          const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
          return regex.test(refererUrl.origin)
        }
        return refererUrl.origin === allowed
      })
    } catch {
      return false
    }
  }

  return false
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function getRateLimitForPath(pathname: string): { max: number; key: string } | null {
  // Endpoints de autenticación — límite estricto
  // Incluye login del portal admin y portal jurídico (rutas de login públicas)
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/portal/auth') ||
    pathname.startsWith('/api/admin/portal/auth') ||
    pathname.startsWith('/api/juridico/portal/auth')
  ) {
    return { max: RATE_LIMIT_AUTH, key: `auth:${pathname}` }
  }
  // Endpoints de OTP — límite muy estricto
  // FIX-SEGURIDAD-CRITICA #8: incluir rutas de recuperación de clave (envían
  // credenciales por email/WhatsApp) en el bucket estricto para evitar abuso.
  if (
    pathname.startsWith('/api/chat/otp') ||
    pathname.startsWith('/api/chat/totp') ||
    pathname.includes('/aceptar-tyc-otp') ||
    pathname.startsWith('/api/auth/recuperar-clave') ||
    pathname.startsWith('/api/seguridad/recuperacion-claves')
  ) {
    return { max: RATE_LIMIT_OTP, key: `otp:${pathname}` }
  }
  // Endpoints de exportación — límite estricto
  if (
    pathname.startsWith('/api/export') ||
    pathname.startsWith('/api/paz-y-salvo') ||
    pathname.startsWith('/api/estado-cuenta')
  ) {
    return { max: RATE_LIMIT_EXPORT, key: `export:${pathname}` }
  }
  // Endpoints de backup/snapshot — límite muy estricto (solo admin)
  if (pathname.startsWith('/api/backups') || pathname.startsWith('/api/snapshots')) {
    return { max: RATE_LIMIT_BACKUP, key: `backup:${pathname}` }
  }
  // Portal del cliente — límite medio
  if (pathname.startsWith('/api/portal/')) {
    return { max: RATE_LIMIT_PORTAL, key: `portal:${pathname}` }
  }
  // Otras APIs — límite general
  if (pathname.startsWith('/api/')) {
    return { max: RATE_LIMIT_GENERAL, key: 'general' }
  }
  // No es API — no aplicar rate limit
  return null
}

export async function proxy(req: NextRequest) {
  // === 1. CORS preflight ===
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    const origin = req.headers.get('origin')
    if (origin && ALLOWED_ORIGINS.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
        return regex.test(origin)
      }
      return origin === allowed
    })) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-portal-token')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Max-Age', '86400')
    }
    return response
  }

  const pathname = req.nextUrl.pathname
  const isApiPath = pathname.startsWith('/api/')

  // === 1.4. CSRF CHECK — Validar Origin en mutaciones ===
  if (isApiPath && !isCSRFSafe(req)) {
    return NextResponse.json(
      { success: false, error: 'Origin no permitido (CSRF check)', code: 'CSRF_DENIED' },
      { status: 403 }
    )
  }

  // === 1.5. BODY LIMIT — Rechazar cuerpos > 10 MB ===
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Cuerpo de petición demasiado grande', code: 'BODY_TOO_LARGE', maxBytes: MAX_BODY_BYTES },
      { status: 413 }
    )
  }

  // === 1.6. VERIFICACIÓN JWT EN PRODUCCIÓN (Reforzado) ===
  // En producción, todas las APIs (excepto login/portal) requieren JWT válido.
  // En desarrollo, se mantiene modo compatibilidad (auth-guard maneja el fallback).
  // EXCEPCIÓN: /api/estado-cuenta y /api/paz-y-salvo aceptan ?token= en query string
  // (porque el frontend usa window.open() que no puede setear headers).
  // Estas rutas validan el token internamente contra cliente.tokenSesion.
  const isProductionEnv = process.env.NODE_ENV === 'production'
  const isDocEndpointWithToken =
    (pathname.startsWith('/api/estado-cuenta') || pathname.startsWith('/api/paz-y-salvo')) &&
    !!req.nextUrl.searchParams.get('token')
  if (isProductionEnv && isApiPath && !isPublicEndpoint(pathname) && !isDocEndpointWithToken) {
    const authHeader = req.headers.get('authorization')
    const portalToken = req.headers.get('x-portal-token')
    if (!authHeader && !portalToken) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        jwt.verify(token, process.env.JWT_SECRET!)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Token inválido o expirado', code: 'INVALID_TOKEN' },
          { status: 401 }
        )
      }
    }
    // portalToken se valida en cada API específica con la lógica de sesión del portal
  }

  // === 2. RATE LIMITING GLOBAL (Reforzado) ===
  const limitConfig = getRateLimitForPath(pathname)
  if (limitConfig) {
    const ip = getClientIp(req)
    const identifier = `${ip}:${limitConfig.key}`
    const result = rateLimit(identifier, limitConfig.max, 60 * 1000)
    if (!result.allowed) {
      const retryAfterSec = Math.ceil((result.resetTime - Date.now()) / 1000)
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.',
          code: 'RATE_LIMITED',
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(limitConfig.max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetTime),
          },
        }
      )
    }
  }

  // === 3. Headers de seguridad reforzados ===
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Download-Options', 'noopen')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-RateLimit-Limit', limitConfig ? String(limitConfig.max) : '0')
  // X-Frame-Options y CSP restrictivos solo en producción (en preview z.ai necesita iframe)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';"
    )
  }

  // === 4. HSTS (Reforzado) ===
  const isProduction = process.env.NODE_ENV === 'production'
  const protocol = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  const isHttps = protocol === 'https' || req.headers.get('x-forwarded-ssl') === 'on'
  const vieneDeProxy = !!req.headers.get('x-forwarded-proto') || !!req.headers.get('x-forwarded-host')
  if (isProduction && isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // === 5. Redirect HTTP → HTTPS (solo producción y si NO viene del proxy) ===
  if (isProduction && !isHttps && !vieneDeProxy && !req.nextUrl.pathname.startsWith('/_next/')) {
    const httpsUrl = req.nextUrl.clone()
    httpsUrl.protocol = 'https:'
    const originalHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
    if (originalHost) {
      httpsUrl.host = originalHost
    }
    return NextResponse.redirect(httpsUrl, 301)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|pwa|manifest|sw.js|robots.txt|logo.svg).*)',
  ],
}
