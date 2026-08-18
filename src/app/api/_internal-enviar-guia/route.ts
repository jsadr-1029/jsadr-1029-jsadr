// Endpoint TEMPORAL — eliminar después de enviar la guía (token en query string)
// GET /api/_internal-enviar-guia?token=XXX
// Usa el transporter interno (que sabe desencriptar credenciales)
// Envía un email con enlaces de descarga (no attachments, porque Brevo API no soporta
// attachments vía enviarEmail() y no podemos alcanzar la apiKey real desde fuera).

import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/email'

const TEMP_TOKEN = 'guia-jsadr-2026-aug18-temp-only-delete'

export async function GET(req: NextRequest) {
  // Verificar token
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (token !== TEMP_TOKEN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const to = 'jsa@jsadr.com.co'
    const subject = 'Guía de Registro de Cliente — Plataforma JSADR'
    const html = `
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Guía de Registro de Cliente</h1>
          <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">Plataforma JSADR — Versión 2.0</p>
        </div>
        <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 12px; color: #111827; font-size: 15px;">Hola,</p>
          <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
            Adjunto encontrarás la <strong>guía paso a paso con imágenes</strong> para que los clientes nuevos puedan registrarse en la plataforma JSADR.
          </p>
          <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">La guía incluye:</p>
          <ul style="margin: 0 0 12px; padding-left: 24px; color: #374151; font-size: 14px; line-height: 1.7;">
            <li>Acceso al formulario de registro (jsadr.com.co/register)</li>
            <li>Los 6 pasos del formulario con capturas de pantalla reales de cada paso</li>
            <li>El nuevo paso de <strong>datos bancarios obligatorios</strong> (banco, tipo de cuenta, número de cuenta)</li>
            <li>Instrucciones para las 3 fotos de verificación de identidad</li>
            <li>Cómo usar el código de seguimiento SNC-XXXXX</li>
            <li>Primer ingreso al portal y cambio de contraseña</li>
            <li>Preguntas frecuentes y canales de contacto</li>
          </ul>
          <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
            Descarga los archivos en los siguientes enlaces (disponibles mientras este endpoint temporal esté activo):
          </p>
          <div style="margin: 16px 0; padding: 16px; background: #dbeafe; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 8px; color: #1e3a8a; font-size: 14px; font-weight: 600;">Descargas:</p>
            <p style="margin: 0 0 4px;"><a href="https://jsadr-1029-jsadr.vercel.app/guia/Guia_Registro_Cliente_JSADR.pdf" style="color: #1d4ed8; font-size: 14px; font-weight: 600;">Descargar Guía en PDF (con imágenes, 896 KB)</a></p>
            <p style="margin: 0;"><a href="https://jsadr-1029-jsadr.vercel.app/guia/Guia_Registro_Cliente_JSADR.docx" style="color: #1d4ed8; font-size: 14px; font-weight: 600;">Descargar Guía en Word editable (1.1 MB)</a></p>
          </div>
          <div style="padding: 12px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">Recordatorio</p>
            <p style="margin: 6px 0 0; color: #78350f; font-size: 12px; line-height: 1.5;">
              Recuerda que el paso de "Crédito solicitado" fue eliminado del formulario de registro. Los clientes ahora se registran únicamente con sus datos personales, ubicación, datos bancarios y fotos. El monto del crédito lo manejan desde el módulo Simulaciones dentro del portal del cliente.
            </p>
          </div>
          <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">Saludos,<br><strong>Sistema JSADR</strong></p>
        </div>
      </body>
      </html>
    `

    const result = await enviarEmail({ to, subject, html })

    if (!result.success) {
      return NextResponse.json({ error: result.error, raw: result }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId, result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}

// POST alias para compatibilidad
export async function POST(req: NextRequest) {
  return GET(req)
}

