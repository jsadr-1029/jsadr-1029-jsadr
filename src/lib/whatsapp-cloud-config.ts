// =====================================================
// Cargador de credenciales WhatsApp Cloud API
// -----------------------------------------------------
// Lee las credenciales desde la BD (ConexionAPI tipo WHATSAPP_BUSINESS)
// con fallback a variables de entorno.
//
// Esto permite gestionar las credenciales desde el módulo
// CONFIGURACIÓN GLOBAL → INTEGRACIONES en el admin, sin tocar
// las variables de entorno de Vercel.
// =====================================================

import { db } from '@/lib/db'
import { decryptSensitive } from '@/lib/security'

const TIPO_WHATSAPP = 'WHATSAPP_BUSINESS'

export interface CredencialesWhatsAppCloud {
  token: string
  phoneNumberId: string
  businessId?: string
  graphVersion: string
  plantillaOtpNombre?: string
  plantillaOtpIdioma?: string
  telefonoOrigen?: string
  origen: 'BD' | 'ENV'
}

let cacheCredenciales: { data: CredencialesWhatsAppCloud | null; ts: number } = {
  data: null,
  ts: 0,
}
const CACHE_TTL_MS = 30_000 // 30 segundos

/**
 * Obtiene las credenciales activas de WhatsApp Cloud API.
 * Prioridad:
 *   1. BD (ConexionAPI tipo WHATSAPP_BUSINESS, activa=true, con apiKey y accountId)
 *   2. Variables de entorno (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, ...)
 *
 * Usa caché en memoria de 30s para no consultar la BD en cada OTP.
 */
export async function obtenerCredencialesWhatsApp(): Promise<CredencialesWhatsAppCloud | null> {
  // 1. Caché en memoria
  const ahora = Date.now()
  if (cacheCredenciales.data && ahora - cacheCredenciales.ts < CACHE_TTL_MS) {
    return cacheCredenciales.data
  }

  // 2. Intentar leer de BD
  try {
    const conexion = await db.conexionAPI.findFirst({
      where: { tipo: TIPO_WHATSAPP, activa: true },
      orderBy: { updatedAt: 'desc' },
    })

    if (conexion?.apiKey && conexion?.accountId) {
      let extra: any = {}
      try { extra = JSON.parse(conexion.configuracionExtra || '{}') } catch {}

      const cred: CredencialesWhatsAppCloud = {
        token: decryptSensitive(conexion.apiKey),
        phoneNumberId: conexion.accountId,
        businessId: extra.businessId || undefined,
        graphVersion: extra.graphVersion || 'v20.0',
        plantillaOtpNombre: extra.plantillaOtpNombre || 'codigo_otp_jsadr',
        plantillaOtpIdioma: extra.plantillaOtpIdioma || 'es',
        telefonoOrigen: conexion.telefonoOrigen || undefined,
        origen: 'BD',
      }
      cacheCredenciales = { data: cred, ts: ahora }
      return cred
    }
  } catch (e: any) {
    // Si la BD no está disponible, caer a env vars silenciosamente
    console.warn('[WhatsAppCloud] No se pudo leer de BD, usando env vars:', e?.message)
  }

  // 3. Fallback a variables de entorno
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const cred: CredencialesWhatsAppCloud = {
      token: process.env.WHATSAPP_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      businessId: process.env.WHATSAPP_BUSINESS_ID,
      graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0',
      plantillaOtpNombre: process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE || 'codigo_otp_jsadr',
      plantillaOtpIdioma: process.env.WHATSAPP_PLANTILLA_OTP_IDIOMA || 'es',
      telefonoOrigen: process.env.WHATSAPP_FROM_NUMBER,
      origen: 'ENV',
    }
    cacheCredenciales = { data: cred, ts: ahora }
    return cred
  }

  // 4. No hay credenciales
  cacheCredenciales = { data: null, ts: ahora }
  return null
}

/**
 * Invalida el caché en memoria. Llamar después de guardar/probar
 * credenciales nuevas desde la UI de Configuración Global.
 */
export function invalidarCacheCredencialesWhatsApp() {
  cacheCredenciales = { data: null, ts: 0 }
}
