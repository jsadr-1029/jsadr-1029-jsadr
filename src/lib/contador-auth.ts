// =====================================================
// PORTAL DEL CONTADOR — Auth Helper
// Verifica JWT del header Authorization: Bearer <token>
// Exige rol CONTADOR (o ADMIN). Extrae empresaId del query
// o del body para filtrado multi-empresa estricto.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { rateLimit } from '@/lib/security'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-env-var'

export interface ContadorAuthUser {
  id: string
  username: string
  nombre: string
  rol: string // CONTADOR | ADMIN
}

export interface ContadorContext {
  user: ContadorAuthUser
  empresaId: string | null
}

/**
 * Verifica el JWT y el rol. Retorna el usuario autenticado o un
 * NextResponse de error (401/403). Pensado para usarse como:
 *
 *   const auth = requireContador(req)
 *   if (auth instanceof NextResponse) return auth
 *   const { user } = auth
 */
export function requireContador(req: NextRequest | Request): ContadorAuthUser | NextResponse {
  // Rate limiting básico por IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const rl = rateLimit(`contador-api:${ip}`, 60, 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Intente más tarde.' },
      { status: 429 }
    )
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  const token = authHeader.substring(7)
  let decoded: any
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Sesión inválida o expirada. Inicie sesión nuevamente.', code: 'INVALID_TOKEN' },
      { status: 401 }
    )
  }

  const userId = decoded.id || decoded.userId
  const rol = decoded.rol
  if (!userId || !rol) {
    return NextResponse.json(
      { success: false, error: 'Token inválido.' },
      { status: 401 }
    )
  }

  // Solo CONTADOR o ADMIN pueden acceder al portal contable
  if (rol !== 'CONTADOR' && rol !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Acceso denegado. Rol insuficiente para el Portal del Contador.', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  return {
    id: userId,
    username: decoded.username || 'unknown',
    nombre: decoded.nombre || 'Contador',
    rol,
  }
}

/**
 * Extrae el empresaId de la request (query param o body).
 * Se usa para forzar el filtrado multi-empresa en cada query.
 */
export function extractEmpresaId(req: NextRequest | Request, body?: any): string | null {
  try {
    const url = new URL(req.url)
    const fromQuery = url.searchParams.get('empresaId')
    if (fromQuery) return fromQuery
  } catch {
    // ignore
  }
  if (body && typeof body.empresaId === 'string' && body.empresaId.trim()) {
    return body.empresaId
  }
  return null
}

/**
 * Requiere empresaId. Si no está presente, devuelve 400.
 * Úsalo cuando la operación sea multi-empresa obligatoria.
 */
export function requireEmpresaId(req: NextRequest | Request, body?: any): string | NextResponse {
  const empresaId = extractEmpresaId(req, body)
  if (!empresaId) {
    return NextResponse.json(
      { success: false, error: 'empresaId es obligatorio para esta operación.', code: 'EMPRESA_REQUIRED' },
      { status: 400 }
    )
  }
  return empresaId
}

/**
 * Sanitiza un string de entrada (anti-XSS básico). Recorta y limita longitud.
 */
export function sanitizeString(value: unknown, maxLen = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, maxLen)
  return trimmed || null
}

/**
 * Convierte un valor a número seguro (Float). Retorna 0 si es inválido.
 */
export function toNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return isNaN(n) ? defaultValue : n
  }
  return defaultValue
}

/**
 * Convierte un valor a entero seguro.
 */
export function toInt(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = parseInt(value, 10)
    return isNaN(n) ? defaultValue : n
  }
  return defaultValue
}
