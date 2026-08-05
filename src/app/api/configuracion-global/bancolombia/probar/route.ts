// =====================================================
// /api/configuracion-global/bancolombia/probar
// -----------------------------------------------------
// POST: prueba la conexión con Bancolombia usando las
// credenciales guardadas (OAuth2 client_credentials).
//
// Recibe opcionalmente credenciales temporales del body
// para probar antes de guardar:
//   { clientId, clientSecret, commerceId, ambiente }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { obtenerAccessToken, type CredencialesBancolombia } from '@/lib/bancolombia'

const TIPO_BANCOLOMBIA = 'BANCOLOMBIA_BOTON_PAGO'

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const clientInfo = getClientInfo(req)

    // Si vienen credenciales temporales en el body, usar esas;
    // si no, leer de la BD.
    let credenciales: CredencialesBancolombia
    let conexionId: string | null = null

    if (body?.clientId && body?.clientSecret && !body.clientSecret.startsWith('••••')) {
      // Prueba con credenciales del body (sin guardar)
      credenciales = {
        clientId: String(body.clientId),
        clientSecret: String(body.clientSecret),
        commerceId: String(body.commerceId || ''),
        ambiente: body.ambiente === 'produccion' ? 'produccion' : 'sandbox',
        redirectUrl: body.redirectUrl || '',
        webhookUrl: body.webhookUrl || '',
      }
    } else {
      // Leer de BD
      const conexion = await db.conexionAPI.findFirst({
        where: { tipo: TIPO_BANCOLOMBIA },
        orderBy: { updatedAt: 'desc' },
      })

      if (!conexion || !conexion.apiKey || !conexion.apiSecret) {
        return NextResponse.json(
          { success: false, error: 'No hay credenciales de Bancolombia configuradas. Guarda las credenciales primero.' },
          { status: 404 }
        )
      }

      let extra: any = {}
      try { extra = JSON.parse(conexion.configuracionExtra || '{}') } catch {}

      conexionId = conexion.id
      credenciales = {
        clientId: decryptSensitive(conexion.apiKey),
        clientSecret: decryptSensitive(conexion.apiSecret),
        commerceId: conexion.accountId || '',
        ambiente: extra.ambiente === 'produccion' ? 'produccion' : 'sandbox',
        redirectUrl: extra.redirectUrl || '',
        webhookUrl: extra.webhookUrl || '',
      }
    }

    // Ejecutar prueba OAuth2
    const resultado = await obtenerAccessToken(credenciales)

    const ok = resultado.success
    const mensaje = ok
      ? `Conexión exitosa a Bancolombia (${credenciales.ambiente}). Access token obtenido.`
      : `Error: ${resultado.error || 'desconocido'}`

    // Actualizar registro de prueba en BD (si se usó credencial guardada)
    if (conexionId) {
      await db.conexionAPI.update({
        where: { id: conexionId },
        data: {
          probada: ok,
          fechaUltimaPrueba: new Date(),
          resultadoUltimaPrueba: ok ? 'OK' : (resultado.error || 'FAIL').slice(0, 200),
        },
      })
    }

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'BANCOLOMBIA_TEST_CONEXION',
      modulo: 'configuracion-global',
      detalles: JSON.stringify({
        ambiente: credenciales.ambiente,
        ok,
        error: ok ? null : resultado.error,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: {
        ok,
        mensaje,
        ambiente: credenciales.ambiente,
        detalle: ok
          ? { tokenPreview: resultado.accessToken!.slice(0, 12) + '...' }
          : resultado.raw,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
