// =====================================================
// WhatsApp Cloud API (Meta) - v4.14
// =====================================================
// Integración con WhatsApp Business Cloud API de Meta para envío automático.
//
// Credenciales se leen desde:
//   1. BD (ConexionAPI tipo WHATSAPP_BUSINESS) — gestionable desde
//      CONFIGURACIÓN GLOBAL → INTEGRACIONES en el admin.
//   2. Variables de entorno (fallback).
//
// Modos soportados:
//   1. Texto libre — cualquier mensaje, requiere ventana 24h abierta.
//   2. Plantilla de Autenticación (OTP) — `codigo_otp_jsadr` aprobada por Meta,
//      permite enviar OTP fuera de ventana de 24h (recomendado en producción).
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
//       https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
// =====================================================

import {
  obtenerCredencialesWhatsApp,
  type CredencialesWhatsAppCloud,
} from './whatsapp-cloud-config'

interface WhatsAppCloudResult {
  exito: boolean
  wamid?: string
  error?: string
  respuesta?: any
  modo?: 'TEXTO' | 'PLANTILLA_OTP'
  origenCredenciales?: 'BD' | 'ENV'
}

/**
 * Verifica si la integración con WhatsApp Cloud API está configurada.
 * NOTA: esta función es síncrona y solo verifica variables de entorno.
 * Para verificar también la BD, usar `whatsappCloudConfiguradoAsync`.
 */
export function whatsappCloudConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Versión asíncrona que consulta también la BD.
 * Devuelve true si hay credenciales activas (BD o env vars).
 */
export async function whatsappCloudConfiguradoAsync(): Promise<boolean> {
  const cred = await obtenerCredencialesWhatsApp()
  return !!cred
}

/**
 * Verifica si la plantilla OTP está habilitada.
 */
export async function plantillaOtpConfiguradaAsync(): Promise<boolean> {
  const cred = await obtenerCredencialesWhatsApp()
  return !!cred && !!cred.plantillaOtpNombre
}

/**
 * Limpia el número al formato internacional sin "+" (ej: 573001234567).
 */
function limpiarTelefono(telefono: string): string {
  let limpio = telefono.replace(/[^\d]/g, '')
  if (limpio.length === 10) limpio = '57' + limpio // Colombia por defecto
  if (limpio.length < 7 || limpio.length > 15) {
    throw new Error('Teléfono inválido: longitud fuera de rango (7-15)')
  }
  return limpio
}

/**
 * Llamada interna común al endpoint /messages de la Cloud API.
 */
async function llamarCloudAPI(
  phoneNumberId: string,
  token: string,
  graphVersion: string,
  bodyObj: any
): Promise<WhatsAppCloudResult> {
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyObj),
    })
    const data = await resp.json()

    if (!resp.ok) {
      const errorMsg = data?.error?.message || `HTTP ${resp.status}`
      const errorCode = data?.error?.code
      const errorSubcode = data?.error?.error_subcode
      console.error('[WhatsAppCloud] Error API Meta:', { errorMsg, errorCode, errorSubcode, data })
      return {
        exito: false,
        error: `Meta API: ${errorMsg}${errorCode ? ` (code ${errorCode}${errorSubcode ? '/' + errorSubcode : ''})` : ''}`,
        respuesta: data,
      }
    }

    const wamid = data?.messages?.[0]?.id
    if (!wamid) {
      return {
        exito: false,
        error: 'Meta API no devolvió wamid',
        respuesta: data,
      }
    }
    return { exito: true, wamid, respuesta: data }
  } catch (error: any) {
    console.error('[WhatsAppCloud] Exception:', error?.message || error)
    return {
      exito: false,
      error: error?.message || 'Error desconocido en WhatsApp Cloud API',
    }
  }
}

/**
 * Envía un mensaje de TEXTO LIBRE vía WhatsApp Cloud API de Meta.
 * Solo funciona si el destinatario escribió primero en las últimas 24h.
 *
 * Lee credenciales de BD (gestionables desde la UI) con fallback a env vars.
 *
 * @returns { exito, wamid } si se envió correctamente.
 *          { exito: false, error } si falló o no está configurado.
 */
export async function enviarWhatsAppCloudAPI(
  telefonoDestino: string,
  mensaje: string
): Promise<WhatsAppCloudResult> {
  const cred = await obtenerCredencialesWhatsApp()
  if (!cred) {
    return {
      exito: false,
      error: 'WhatsApp Cloud API no configurada. Configúrala en Configuración Global → Integraciones, o define WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en variables de entorno.',
    }
  }
  try {
    const telefonoLimpio = limpiarTelefono(telefonoDestino)
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'text',
      text: { body: mensaje, preview_url: false },
    }
    const result = await llamarCloudAPI(cred.phoneNumberId, cred.token, cred.graphVersion, body)
    return result.exito ? { ...result, modo: 'TEXTO', origenCredenciales: cred.origen } : result
  } catch (error: any) {
    console.error('[WhatsAppCloud] enviarWhatsAppCloudAPI exception:', error?.message || error)
    return {
      exito: false,
      error: error?.message || 'Error desconocido en WhatsApp Cloud API',
    }
  }
}

/**
 * Envía un código OTP usando la plantilla de Autenticación aprobada por Meta.
 * Permite enviar OTP fuera de la ventana de 24h (necesario en producción).
 *
 * La plantilla (por defecto `codigo_otp_jsadr`) debe estar creada y aprobada
 * en WhatsApp Manager con categoría "Autenticación" y un body con {{1}} como
 * placeholder del código.
 */
export async function enviarOTPPorPlantilla(
  telefonoDestino: string,
  codigoOtp: string
): Promise<WhatsAppCloudResult> {
  const cred = await obtenerCredencialesWhatsApp()
  if (!cred) {
    return {
      exito: false,
      error: 'WhatsApp Cloud API no configurada. Configúrala en Configuración Global → Integraciones.',
    }
  }
  if (!cred.plantillaOtpNombre) {
    return {
      exito: false,
      error: 'Plantilla OTP no configurada. Define plantillaOtpNombre en la configuración.',
    }
  }
  try {
    const telefonoLimpio = limpiarTelefono(telefonoDestino)
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'template',
      template: {
        name: cred.plantillaOtpNombre,
        language: { code: cred.plantillaOtpIdioma || 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: codigoOtp,
              },
            ],
          },
        ],
      },
    }
    const result = await llamarCloudAPI(cred.phoneNumberId, cred.token, cred.graphVersion, body)
    return result.exito ? { ...result, modo: 'PLANTILLA_OTP', origenCredenciales: cred.origen } : result
  } catch (error: any) {
    console.error('[WhatsAppCloud] enviarOTPPorPlantilla exception:', error?.message || error)
    return {
      exito: false,
      error: error?.message || 'Error desconocido en envío de OTP por plantilla',
    }
  }
}

/**
 * Envío inteligente de OTP: intenta primero plantilla (si está configurada y aprobada),
 * si falla con error de plantilla (código 132000+ de Meta), cae a texto libre.
 * Si la plantilla no está configurada, va directo a texto libre.
 */
export async function enviarOTPSmart(
  telefonoDestino: string,
  codigoOtp: string,
  mensajeTextoLibre: string
): Promise<WhatsAppCloudResult> {
  const cred = await obtenerCredencialesWhatsApp()
  if (!cred) {
    return {
      exito: false,
      error: 'WhatsApp Cloud API no configurada. Configúrala en Configuración Global → Integraciones.',
    }
  }

  // 1. Si la plantilla está configurada, intentar primero con ella.
  if (cred.plantillaOtpNombre) {
    const r = await enviarOTPPorPlantilla(telefonoDestino, codigoOtp)
    if (r.exito) return r
    // Detectar errores típicos de plantilla: no aprobada, no existe, idioma inválido, etc.
    const errLower = (r.error || '').toLowerCase()
    const esErrorPlantilla =
      errLower.includes('template') ||
      errLower.includes('plantilla') ||
      errLower.includes('1320')
    if (!esErrorPlantilla) {
      return r
    }
    console.warn('[WhatsAppCloud] Plantilla OTP falló, fallback a texto libre:', r.error)
  }

  // 2. Fallback: texto libre (requiere ventana de 24h abierta).
  const r2 = await enviarWhatsAppCloudAPI(telefonoDestino, mensajeTextoLibre)
  return r2.exito ? { ...r2, modo: 'TEXTO', origenCredenciales: cred.origen } : r2
}

// =====================================================
// Backward-compat: funciones síncronas que ahora delegan a env vars
// =====================================================
// Estas funciones mantienen la firma síncrona del v4.13 para no romper
// imports existentes. Solo usan env vars. Para usar credenciales de BD,
// usar las versiones async (enviarWhatsAppCloudAPI, enviarOTPSmart).

/** @deprecated usar whatsappCloudConfiguradoAsync */
export function plantillaOtpConfigurada(): boolean {
  return whatsappCloudConfigurado() && !!process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE
}
