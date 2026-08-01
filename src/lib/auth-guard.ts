// =====================================================
// Auth Guard v3.7.0 — RBAC estricto + separación de portales
// -----------------------------------------------------
// CAMBIOS v3.7.0 (auditoría de permisos JSADR):
//  • El header `x-portal-token` (clientes del portal) YA NO devuelve
//    un AuthUser interno. Antes se le asignaba rol:'CONSULTOR' y eso
//    permitía a los clientes acceder a todas las APIs internas
//    (/api/clientes, /api/prestamos, /api/usuarios, etc.).
//  • Las APIs internas (todo lo que no sea /api/portal/* o
//    /api/juridico/portal/*) ahora rechazan a los clientes del portal.
//  • Las APIs del portal cliente deben usar `getPortalCliente(req)`
//    para validar el token del cliente y obtener SU identidad.
//  • Las APIs del portal abogado deben usar `getPortalAbogado(req)`.
//  • Agregado rol ABOGADO al tipo AuthUser.
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
  rol: 'ADMIN' | 'GESTOR' | 'CONSULTOR' | 'ABOGADO'
  username: string
  nombre: string
}

/**
 * Identidad de un cliente del portal cliente.
 * Se obtiene validando `x-portal-token` contra la BD.
 * Los clientes SOLO pueden acceder a /api/portal/* — ninguna API interna.
 */
export interface PortalClienteAuth {
  id: string
  cedula: string
  nombre: string
  email: string | null
  telefono: string
  esPortalCliente: true
}

/**
 * Identidad de un abogado en el portal jurídico.
 * Se obtiene validando el token de sesión del portal abogado contra la BD.
 */
export interface PortalAbogadoAuth {
  id: string
  cedula: string
  nombre: string
  username: string
  rol: 'ABOGADO'
  esPortalAbogado: true
}

/**
 * Extrae el usuario INTERNO autenticado del request.
 * Lee el header Authorization: Bearer <JWT> y verifica el token.
 *
 * IMPORTANTE: Este función NO reconoce el `x-portal-token` de los clientes
 * del portal. Los clientes del portal NO son usuarios internos y deben
 * usar `getPortalCliente()` en su lugar. Esto evita que un cliente del
 * portal acceda a APIs internas (/api/clientes, /api/prestamos, etc.).
 *
 * @returns AuthUser | null  — null si no hay JWT interno válido.
 */
export function getAuthUser(req: NextRequest | Request): AuthUser | null {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
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
    return null
  } catch (error) {
    return null
  }
}

/**
 * Valida el `x-portal-token` de un cliente del portal contra la BD.
 * Para usar en APIs bajo /api/portal/* (NO en APIs internas).
 *
 * @returns PortalClienteAuth | null — null si el token no existe o expiró.
 */
export async function getPortalCliente(req: NextRequest | Request): Promise<PortalClienteAuth | null> {
  try {
    const token = req.headers.get('x-portal-token')
    if (!token) return null

    // Import dinámico para evitar circular dependency con db en el cliente
    const { db } = await import('@/lib/db')
    const cliente = await db.cliente.findFirst({
      where: { tokenSesion: token },
    })
    if (!cliente) return null
    if (!cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) return null
    if (!cliente.activo) return null

    return {
      id: cliente.id,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      esPortalCliente: true,
    }
  } catch {
    return null
  }
}

/**
 * Requiere que el request venga de un cliente del portal autenticado.
 * Para usar en APIs bajo /api/portal/*.
 *
 * @returns PortalClienteAuth | NextResponse(401)
 */
export async function requirePortalCliente(req: NextRequest | Request): Promise<PortalClienteAuth | NextResponse> {
  const cliente = await getPortalCliente(req)
  if (!cliente) {
    return NextResponse.json(
      { success: false, error: 'Sesión del portal inválida o expirada.', code: 'PORTAL_UNAUTHORIZED' },
      { status: 401 }
    )
  }
  return cliente
}

/**
 * Valida el token de sesión del portal jurídico (abogado).
 * Para usar en APIs bajo /api/juridico/portal/*.
 */
export async function getPortalAbogado(req: NextRequest | Request): Promise<PortalAbogadoAuth | null> {
  try {
    // El portal abogado usa query param ?token= o header x-portal-abogado-token
    let token: string | null = null
    const headerToken = req.headers.get('x-portal-abogado-token')
    if (headerToken) {
      token = headerToken
    } else if (req instanceof NextRequest) {
      token = req.nextUrl.searchParams.get('token')
    } else if (req.url) {
      try {
        const u = new URL(req.url)
        token = u.searchParams.get('token')
      } catch {}
    }
    if (!token) return null

    const { db } = await import('@/lib/db')
    const usuario = await db.usuario.findFirst({
      where: { tokenSesion: token, rol: 'ABOGADO' },
    })
    if (!usuario) return null
    if (!usuario.tokenExpira || new Date(usuario.tokenExpira) < new Date()) return null
    if (!usuario.activo) return null

    return {
      id: usuario.id,
      cedula: usuario.cedula || '',
      nombre: usuario.nombre,
      username: usuario.username,
      rol: 'ABOGADO',
      esPortalAbogado: true,
    }
  } catch {
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
 * Verifica si el usuario es ABOGADO (acceso solo al portal jurídico).
 * NO tiene acceso al panel interno principal.
 */
export function isAbogado(user: AuthUser): boolean {
  return user?.rol === 'ABOGADO'
}

/**
 * Verifica si el usuario es GESTOR o superior (incluye ADMIN).
 */
export function isGestor(user: AuthUser): boolean {
  return user?.rol === 'ADMIN' || user?.rol === 'GESTOR'
}

/**
 * Verifica si el usuario es CONSULTOR o superior (ADMIN, GESTOR, CONSULTOR).
 * ABOGADO NO está incluido — el abogado usa el portal aparte.
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
