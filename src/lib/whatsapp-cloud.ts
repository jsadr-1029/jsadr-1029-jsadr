// =====================================================
// WhatsApp Cloud API (Meta) - v4.13
// =====================================================
// Integración con WhatsApp Business Cloud API de Meta para envío automático.
// Si WHATSAPP_TOKEN no está configurado, las funciones retornan { exito: false }
// para que el llamador pueda caer al fallback wa.me link o email.
//
// Modos soportados:
//   1. Texto libre (envío normal) — cualquier mensaje entre líneas de 24h.
//   2. Plantilla de Autenticación (OTP) — `codigo_otp_jsadr` aprobada por Meta,
//      permite enviar OTP incluso fuera de ventana de 24h (recomendado en producción).
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
//       https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
// =====================================================

interface WhatsAppCloudResult {
  exito: boolean
  wamid?: string
  error?: string
  respuesta?: any
  modo?: 'TEXTO' | 'PLANTILLA_OTP'
}

// Versión de la Graph API. v20.0 es estable a 2025.
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

// Nombre de la plantilla de Autenticación aprobada en WhatsApp Manager.
// Si no está configurada, se usa texto libre.
const PLANTILLA_OTP_NOMBRE = process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE || 'codigo_otp_jsadr'

// Idioma de la plantilla (debe coincidir con el creado en WhatsApp Manager).
const PLANTILLA_OTP_IDIOMA = process.env.WHATSAPP_PLANTILLA_OTP_IDIOMA || 'es'

/**
 * Verifica si la integración con WhatsApp Cloud API está configurada.
 */
export function whatsappCloudConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Verifica si la plantilla OTP está habilitada (nombre configurado y Cloud API activa).
 */
export function plantillaOtpConfigurada(): boolean {
  return whatsappCloudConfigurado() && !!process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE
}

/**
 * Limpia el número al formato internacional sin "+" (ej: 573001234567).
 */
function limpiarTelefono(telefono: string): string {
  let limpio = telefono.replace(/[^\d]/g, '')
  if (limpio.length === 10) limpio = '57' + limpio  // Colombia por defecto
  if (limpio.length < 7 || limpio.length > 15) {
    throw new Error('Teléfono inválido: longitud fuera de rango (7-15)')
  }
  return limpio
}

/**
 * Llamada interna común al endpoint /messages de la Cloud API.
 */
async function llamarCloudAPI(phoneNumberId: string, token: string, bodyObj: any): Promise<WhatsAppCloudResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`
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
 * Solo funciona si el destinatario escribió primero en las últimas 24h
 * (ventana de servicio al cliente). Para OTP fuera de ventana usar plantilla.
 *
 * Requiere en .env:
 *   WHATSAPP_TOKEN=<token-permanente-de-meta>
 *   WHATSAPP_PHONE_NUMBER_ID=<phone-number-id-asignado-por-meta>
 */
export async function enviarWhatsAppCloudAPI(
  telefonoDestino: string,
  mensaje: string
): Promise<WhatsAppCloudResult> {
  if (!whatsappCloudConfigurado()) {
    return {
      exito: false,
      error: 'WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurado',
    }
  }
  try {
    const telefonoLimpio = limpiarTelefono(telefonoDestino)
    const token = process.env.WHATSAPP_TOKEN!
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'text',
      text: {
        body: mensaje,
        preview_url: false,
      },
    }
    const result = await llamarCloudAPI(phoneNumberId, token, body)
    return result.exito ? { ...result, modo: 'TEXTO' } : result
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
 * La plantilla `codigo_otp_jsadr` debe estar creada y aprobada en WhatsApp Manager
 * con categoría "Autenticación" y un body con {{1}} como placeholder del código.
 *
 * Requiere en .env:
 *   WHATSAPP_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_PLANTILLA_OTP_NOMBRE=codigo_otp_jsadr   (opcional, por defecto ese)
 *   WHATSAPP_PLANTILLA_OTP_IDIOMA=es                  (opcional, por defecto 'es')
 */
export async function enviarOTPPorPlantilla(
  telefonoDestino: string,
  codigoOtp: string
): Promise<WhatsAppCloudResult> {
  if (!plantillaOtpConfigurada()) {
    return {
      exito: false,
      error: 'Plantilla OTP no configurada. Configure WHATSAPP_PLANTILLA_OTP_NOMBRE o use texto libre.',
    }
  }
  try {
    const telefonoLimpio = limpiarTelefono(telefonoDestino)
    const token = process.env.WHATSAPP_TOKEN!
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!

    // Formato oficial de plantilla de Autenticación.
    // Body: 1 parámetro (el código). Buttons: opcional "copiar código" autogenerado por Meta.
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'template',
      template: {
        name: PLANTILLA_OTP_NOMBRE,
        language: { code: PLANTILLA_OTP_IDIOMA },
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
    const result = await llamarCloudAPI(phoneNumberId, token, body)
    return result.exito ? { ...result, modo: 'PLANTILLA_OTP' } : result
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
  // 1. Si la plantilla está configurada, intentar primero con ella.
  if (plantillaOtpConfigurada()) {
    const r = await enviarOTPPorPlantilla(telefonoDestino, codigoOtp)
    if (r.exito) return r
    // Detectar errores típicos de plantilla: no aprobada, no existe, idioma inválido, etc.
    // Meta error codes: 132000 (template not found), 132015 (template not approved),
    // 132080 (template language mismatch), 132012 (template param mismatch)
    const errLower = (r.error || '').toLowerCase()
    const esErrorPlantilla =
      errLower.includes('template') ||
      errLower.includes('plantilla') ||
      errLower.includes('1320')
    if (!esErrorPlantilla) {
      // Falló por otra razón (token, cuota, número inválido) — no reintentar con texto.
      return r
    }
    console.warn('[WhatsAppCloud] Plantilla OTP falló, fallback a texto libre:', r.error)
  }

  // 2. Fallback: texto libre (requiere ventana de 24h abierta).
  const r2 = await enviarWhatsAppCloudAPI(telefonoDestino, mensajeTextoLibre)
  return r2.exito ? { ...r2, modo: 'TEXTO' } : r2
}
