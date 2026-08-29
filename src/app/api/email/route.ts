import { NextRequest, NextResponse } from 'next/server'
import { haySmtpConfigurado, probarSmtp, enviarEmail, verificarCuentaBrevo } from '@/lib/email'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { db } from '@/lib/db'

// GET - saber si hay SMTP configurado
export async function GET(req: NextRequest) {
  // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede consultar estado de SMTP
  const authResult = requireRole(req, ['ADMIN'])
  if (authResult instanceof NextResponse) return authResult
  const configurado = await haySmtpConfigurado()
  return NextResponse.json({
    success: true,
    smtpConfigurado: configurado,
    message: configurado
      ? 'SMTP configurado y activo. Los correos se enviarán realmente.'
      : 'Sin SMTP configurado. Se usará Ethereal Email (modo de prueba).',
  })
}

// POST - probar la conexión SMTP / enviar correo de prueba
export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede probar/enviar correos desde la config
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const { accion, to } = body

    if (accion === 'probar') {
      const resultado = await probarSmtp()
      // v4.14 (QA M11 TC-INT-001): además de probar SMTP, verificar HTTPS API de Brevo
      // (/v3/account) y actualizar ConexionAPI.probada + fechaUltimaPrueba + resultadoUltimaPrueba
      let brevoAccount: { success?: boolean; message?: string; cuenta?: unknown } | null = null
      try {
        brevoAccount = await verificarCuentaBrevo()
      } catch (e) {
        // No fallar el test de SMTP si la verificación HTTPS falla — solo reportarlo
        brevoAccount = { success: false, message: (e as Error).message }
      }

      // Determinar éxito global: SMTP ok O Brevo HTTPS ok (al menos uno)
      const okGlobal = resultado.success || !!brevoAccount?.success

      // Actualizar ConexionAPI.EMAIL_SMTP con el resultado de la prueba
      try {
        const conexion = await db.conexionAPI.findFirst({
          where: { tipo: 'EMAIL_SMTP', activa: true },
          select: { id: true },
        })
        if (conexion) {
          await db.conexionAPI.update({
            where: { id: conexion.id },
            data: {
              probada: okGlobal,
              fechaUltimaPrueba: new Date(),
              resultadoUltimaPrueba: okGlobal
                ? 'OK'
                : (resultado.codigo || brevoAccount?.message || 'FAIL').slice(0, 200),
            },
          })
        }
      } catch (e) {
        // No fallar la respuesta si la BD no está disponible
        console.error('[email][probar] Error actualizando ConexionAPI:', e)
      }

      return NextResponse.json({
        success: okGlobal,
        message: okGlobal
          ? resultado.message
          : `${resultado.message} | Brevo HTTPS: ${brevoAccount?.message || 'N/A'}`,
        codigo: resultado.codigo, // v4.8: codigo sanitizado (SMTP_AUTH_FAILED, SMTP_CONN_ERROR, etc.)
        config: resultado.config,
        brevoHttps: brevoAccount, // v4.14: resultado de /v3/account
      })
    }

    if (accion === 'enviar-prueba') {
      if (!to) {
        return NextResponse.json(
          { success: false, error: 'Especifica el destinatario en "to"', codigo: 'TO_REQUERIDO' },
          { status: 400 }
        )
      }

      // === v4.8 (QA M05 TC-MAIL-010): validar formato de email del destinatario ===
      // Antes: solo se validaba `!to` (truthy), permitiendo strings como "no-es-email".
      // enviarEmail() sí validaba el formato pero retornaba success:false (HTTP 200),
      // lo cual era confuso para el cliente (parecía exitoso pero no enviaba).
      // Ahora: validación previa con regex en la API route → HTTP 400 EMAIL_INVALIDO.
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(to).trim())) {
        return NextResponse.json(
          {
            success: false,
            error: `El email del destinatario no tiene un formato válido. Recibido: "${to}"`,
            codigo: 'EMAIL_INVALIDO',
          },
          { status: 400 }
        )
      }

      const resultado = await enviarEmail({
        to,
        subject: 'Correo de prueba - Sistema de Solicitudes',
        text: 'Este es un correo de prueba enviado desde el Sistema de Gestión de Solicitudes.',
        html: `
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h2 style="color: #1e40af;">Correo de prueba ✅</h2>
  <p>Este es un correo de prueba enviado desde el Sistema de Gestión de Solicitudes.</p>
  <p>Si lo recibiste, la configuración SMTP funciona correctamente.</p>
</div>`,
      })

      return NextResponse.json({
        success: resultado.success,
        isEthereal: resultado.isEthereal,
        configUsada: resultado.configUsada,
        messageId: resultado.messageId,
        previewUrl: resultado.previewUrl,
        error: resultado.error,
        fromEmail: resultado.fromEmail,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida. Usa "probar" o "enviar-prueba".' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
