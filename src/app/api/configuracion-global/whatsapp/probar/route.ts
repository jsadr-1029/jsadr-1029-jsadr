// =====================================================
// /api/configuracion-global/whatsapp/probar
// -----------------------------------------------------
// POST: prueba la conexión con WhatsApp Cloud API enviando
// un mensaje de texto de prueba al teléfono indicado.
//
// Recibe:
//   - telefonoDestino (string, obligatorio): número al que enviar el mensaje de prueba
//   - Credenciales temporales opcionales en el body:
//     { token, phoneNumberId, graphVersion }
//   - Si no vienen credenciales en el body, usa las guardadas en BD.
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

const TIPO_WHATSAPP = 'WHATSAPP_BUSINESS'

function limpiarTelefono(t: string): string {
  let l = (t || '').replace(/[^\d]/g, '')
  if (l.length === 10) l = '57' + l // Colombia por defecto
  if (l.length < 7 || l.length > 15) throw new Error('Teléfono inválido (7-15 dígitos)')
  return l
}

interface CredencialesWhatsApp {
  token: string
  phoneNumberId: string
  graphVersion: string
  plantillaOtpNombre?: string
  plantillaOtpIdioma?: string
  telefonoOrigen?: string
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const clientInfo = getClientInfo(req)

    const telefonoDestino = body?.telefonoDestino
    if (!telefonoDestino || typeof telefonoDestino !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Debe indicar telefonoDestino para enviar el mensaje de prueba.' },
        { status: 400 }
      )
    }

    let credenciales: CredencialesWhatsApp
    let conexionId: string | null = null

    // Si vienen credenciales temporales en el body (token sin máscara), usar esas
    if (body?.token && !body.token.startsWith('••••') && body?.phoneNumberId) {
      credenciales = {
        token: String(body.token),
        phoneNumberId: String(body.phoneNumberId),
        graphVersion: body.graphVersion || 'v20.0',
        plantillaOtpNombre: body.plantillaOtpNombre,
        plantillaOtpIdioma: body.plantillaOtpIdioma,
        telefonoOrigen: body.telefonoOrigen,
      }
    } else {
      // Leer de BD
      const conexion = await db.conexionAPI.findFirst({
        where: { tipo: TIPO_WHATSAPP },
        orderBy: { updatedAt: 'desc' },
      })

      if (!conexion || !conexion.apiKey || !conexion.accountId) {
        return NextResponse.json(
          { success: false, error: 'No hay credenciales de WhatsApp configuradas. Guarda las credenciales primero.' },
          { status: 404 }
        )
      }

      let extra: any = {}
      try { extra = JSON.parse(conexion.configuracionExtra || '{}') } catch {}

      conexionId = conexion.id
      credenciales = {
        token: decryptSensitive(conexion.apiKey),
        phoneNumberId: conexion.accountId,
        graphVersion: extra.graphVersion || 'v20.0',
        plantillaOtpNombre: extra.plantillaOtpNombre,
        plantillaOtpIdioma: extra.plantillaOtpIdioma,
        telefonoOrigen: conexion.telefonoOrigen || undefined,
      }
    }

    // Enviar mensaje de prueba (texto libre)
    const telefonoLimpio = limpiarTelefono(telefonoDestino)
    const url = `https://graph.facebook.com/${credenciales.graphVersion}/${credenciales.phoneNumberId}/messages`
    const mensajePrueba = `🧪 *TEST JSADR* — WhatsApp Cloud API conectada correctamente.\n\nSi recibes este mensaje, la integración OTP está lista.\n\nHora: ${new Date().toISOString()}`

    const bodyReq = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefonoLimpio,
      type: 'text',
      text: { body: mensajePrueba, preview_url: false },
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credenciales.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyReq),
    })

    const data = await resp.json()

    const ok = resp.ok && !!data?.messages?.[0]?.id
    const mensaje = ok
      ? `Mensaje de prueba enviado correctamente a +${telefonoLimpio}. wamid: ${data.messages[0].id}`
      : `Error: ${data?.error?.message || `HTTP ${resp.status}`}`

    // Actualizar registro de prueba en BD (si se usó credencial guardada)
    if (conexionId) {
      await db.conexionAPI.update({
        where: { id: conexionId },
        data: {
          probada: ok,
          fechaUltimaPrueba: new Date(),
          resultadoUltimaPrueba: ok ? 'OK' : (data?.error?.message || `HTTP ${resp.status}`).slice(0, 200),
        },
      })
    }

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'WHATSAPP_TEST_CONEXION',
      modulo: 'configuracion-global',
      detalles: JSON.stringify({
        telefonoDestino: telefonoLimpio,
        ok,
        error: ok ? null : (data?.error?.message || `HTTP ${resp.status}`),
        errorCode: data?.error?.code,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        ok,
        mensaje,
        telefonoDestino: telefonoLimpio,
        detalle: ok
          ? { wamid: data.messages[0].id }
          : { errorCode: data?.error?.code, raw: data },
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
