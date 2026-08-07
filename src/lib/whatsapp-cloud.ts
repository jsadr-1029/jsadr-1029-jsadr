// =====================================================
// WhatsApp Cloud API (Meta) - v4.12
// =====================================================
// Integración con WhatsApp Business Cloud API de Meta para envío automático.
// Si WHATSAPP_TOKEN no está configurado, las funciones retornan { exito: false }
// para que el llamador pueda caer al fallback wa.me link o email.
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
// =====================================================

interface WhatsAppCloudResult {
  exito: boolean
  wamid?: string
  error?: string
  respuesta?: any
}

/**
 * Verifica si la integración con WhatsApp Cloud API está configurada.
 */
export function whatsappCloudConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
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
 * Envía un mensaje de texto vía WhatsApp Cloud API de Meta.
 *
 * Requiere en .env:
 *   WHATSAPP_TOKEN=<token-permanente-de-meta>
 *   WHATSAPP_PHONE_NUMBER_ID=<phone-number-id-asignado-por-meta>
 *
 * @returns { exito, wamid } si se envió correctamente.
 *          { exito: false, error } si falló o no está configurado.
 */
export async function enviarWhatsAppCloudAPI(
  telefonoDestino: string,
  mensaje: string
): Promise<WhatsAppCloudResult> {
  // 1. Verificar configuración
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
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

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

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await resp.json()

    if (!resp.ok) {
      const errorMsg = data?.error?.message || `HTTP ${resp.status}`
      console.error('[WhatsAppCloud] Error API Meta:', errorMsg, data)
      return {
        exito: false,
        error: `Meta API: ${errorMsg}`,
        respuesta: data,
      }
    }

    // Meta retorna: { messaging_product: "whatsapp", contacts: [...], messages: [{ id: "wamid.HBgL..." }] }
    const wamid = data?.messages?.[0]?.id
    if (!wamid) {
      return {
        exito: false,
        error: 'Meta API no devolvió wamid',
        respuesta: data,
      }
    }

    return {
      exito: true,
      wamid,
      respuesta: data,
    }
  } catch (error: any) {
    console.error('[WhatsAppCloud] Exception:', error?.message || error)
    return {
      exito: false,
      error: error?.message || 'Error desconocido en WhatsApp Cloud API',
    }
  }
}
