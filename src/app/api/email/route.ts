import { NextRequest, NextResponse } from 'next/server'
import { haySmtpConfigurado, probarSmtp, enviarEmail } from '@/lib/email'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

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
      return NextResponse.json({ success: resultado.success, message: resultado.message, config: resultado.config })
    }

    if (accion === 'enviar-prueba') {
      if (!to) {
        return NextResponse.json(
          { success: false, error: 'Especifica el destinatario en "to"' },
          { status: 400 }
        )
      }
      const resultado = await enviarEmail({
        to,
        subject: 'Correo de prueba - Sistema de Préstamos',
        text: 'Este es un correo de prueba enviado desde el Sistema de Gestión de Préstamos.',
        html: `
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h2 style="color: #1e40af;">Correo de prueba ✅</h2>
  <p>Este es un correo de prueba enviado desde el Sistema de Gestión de Préstamos.</p>
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
