// =====================================================
// ACCESO PORTAL HELPER v3.0
// Registra accesos del cliente al portal público para
// trazabilidad y reportes de auditoría.
// =====================================================

import { db } from '@/lib/db'

export interface AccesoPortalParams {
  clienteId?: string | null
  clienteCedula?: string | null
  clienteNombre?: string | null
  ipOrigen?: string | null
  userAgent?: string | null
  accion:
    | 'LOGIN'
    | 'CONSULTA'
    | 'INTENTO_FALLIDO'
    | 'LOGOUT'
    | 'CAMBIO_PIN'
    | 'VERIFICAR_CEDULA'
    | 'CREAR_PIN'
    | 'PIN_EXPIRADO'
    | 'CLAVE_EXPIRADA'
    | 'INTENTO_FALLIDO_CLAVE'
    | 'CAMBIO_CLAVE'
    | 'VERIFICAR_CEDULA_CLAVE'
  exito?: boolean
  detalle?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Registra un acceso al portal del cliente.
 * No lanza errores: si falla, solo loguea y continúa.
 */
export async function registrarAccesoPortal(params: AccesoPortalParams): Promise<void> {
  try {
    await db.accesoPortal.create({
      data: {
        clienteId: params.clienteId ?? undefined,
        clienteCedula: params.clienteCedula || null,
        clienteNombre: params.clienteNombre || null,
        ipOrigen: params.ipOrigen || null,
        userAgent: params.userAgent || null,
        accion: params.accion,
        exito: params.exito ?? true,
        detalle: params.detalle || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })
  } catch (e) {
    console.error('[AccesoPortal] Error registrando acceso:', e)
  }
}

/**
 * Obtiene la IP y el User-Agent desde un Request.
 */
export function getPortalClientInfo(request: Request): {
  ip: string
  userAgent: string
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return { ip, userAgent }
}
