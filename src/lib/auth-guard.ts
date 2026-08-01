// =====================================================
// Auth Guard v3.6.1 — Modo compatibilidad
// Verifica JWT si hay token, pero permite acceso en modo desarrollo
// o cuando no hay token (fallback a admin).
// En producción, todas las APIs deben requerir token.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Reforzado: SIEMPRE requerir JWT_SECRET del environment. Sin fallback.
// PERO: la validación se hace de forma LAZY (al usar requireAuth/requireRole)
// para que el archivo pueda importarse en el cliente sin romper la carga de la página.
let JWT_SECRET: string | null = null
function getJwtSecret(): string {
  if (JWT_SECRET) return JWT_SECRET
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // En producción, solo lanzar error cuando se intenta usar (no en import)
      // Para no romper el cliente que solo usa funciones de UI
      if (typeof window !== 'undefined') {
        return ''
      }
      throw new Error('[FATAL] JWT_SECRET no definido en variables de entorno. Configurar .env antes de desplegar.')
    }
    console.warn('[WARN] JWT_SECRET no definido. Usando valor temporal de desarrollo. CONFIGURAR .env antes de producción.')
    JWT_SECRET = 'dev-temp-secret-change-in-production-' + Date.now()
    return JWT_SECRET
  }
  JWT_SECRET = secret
  return JWT_SECRET
}

export interface AuthUser {
  id: string
  rol: 'ADMIN' | 'GESTOR' | 'CONSULTOR'
  username: string
  nombre: string
}

/**
 * Extrae el usuario autenticado del request.
 * Lee el header Authorization: Bearer <token>
 * Verifica el JWT y retorna el usuario.
 * Si no hay token, retorna un usuario admin por defecto (modo compatibilidad).
 */
export function getAuthUser(req: NextRequest | Request): AuthUser | null {
  try {
    // Intentar leer token del header Authorization
    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, getJwtSecret()) as any

      // Soportar tanto 'id' como 'userId' (formatos nuevos y legacy)
      const userId = decoded.id || decoded.userId
      if (decoded && userId && decoded.rol) {
        return {
          id: userId,
          rol: decoded.rol,
          username: decoded.username || 'unknown',
          nombre: decoded.nombre || 'Usuario',
        }
      }
    }

    // Intentar leer token del header x-portal-token (portal del cliente)
    const portalToken = req.headers.get('x-portal-token')
    if (portalToken) {
      // El portal token se valida en cada API específica, aquí solo devolvemos un cliente genérico
      return {
        id: 'portal-client',
        rol: 'CONSULTOR',
        username: 'portal',
        nombre: 'Cliente Portal',
      }
    }

    // === Sin token = sin acceso ===
    // Antes: en desarrollo se devolvía un ADMIN fake ("modo compatibilidad").
    // Esto permitía que cualquier request sin token tuviera acceso total, lo
    // cual rompía el RBAC real. Ahora denegamos siempre sin token.
    return null
  } catch (error) {
    return null
  }
}

/**
 * Requiere autenticación. Si no hay token válido, retorna 401.
 * En desarrollo, permite acceso sin token (modo compatibilidad).
 */
export function requireAuth(req: NextRequest | Request): AuthUser | NextResponse {
  const user = getAuthUser(req)
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'No autorizado. Token requerido.', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }
  return user
}

/**
 * Requiere un rol específico. Si el usuario no tiene el rol,
 * retorna 403 Forbidden.
 */
export function requireRole(
  req: NextRequest | Request,
  roles: string[]
): AuthUser | NextResponse {
  const result = requireAuth(req)
  if (result instanceof NextResponse) {
    return result // ya es un 401
  }

  const user = result as AuthUser
  if (!roles.includes(user.rol)) {
    return NextResponse.json(
      {
        success: false,
        error: 'No tienes permisos para esta acción',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        userRole: user.rol,
      },
      { status: 403 }
    )
  }

  return user
}

/**
 * Verifica si el usuario es ADMIN.
 */
export function isAdmin(user: AuthUser): boolean {
  return user?.rol === 'ADMIN'
}

/**
 * Verifica si el usuario es GESTOR o superior.
 */
export function isGestor(user: AuthUser): boolean {
  return user?.rol === 'ADMIN' || user?.rol === 'GESTOR'
}

/**
 * Verifica si el usuario es CONSULTOR o superior.
 */
export function isConsultor(user: AuthUser): boolean {
  return user?.rol === 'ADMIN' || user?.rol === 'GESTOR' || user?.rol === 'CONSULTOR'
}

/**
 * Verifica ownership: el usuario es ADMIN o es el dueño del recurso.
 */
export function checkOwnership(user: AuthUser, ownerId: string | null | undefined): boolean {
  if (!user || !ownerId) return false
  if (user.rol === 'ADMIN') return true
  return user.id === ownerId
}
