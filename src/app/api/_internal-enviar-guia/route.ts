// Endpoint TEMPORAL — eliminar después de enviar la guía (token en query string)
// POST /api/_internal-enviar-guia?token=XXX
// Body: { to, subject, html, attachments: [{filename, contentBase64, contentType}] }
// Usa el transporter interno (que sabe desencriptar credenciales)

import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/email'

const TEMP_TOKEN = 'guia-jsadr-2026-aug18-temp-only-delete'

export async function POST(req: NextRequest) {
  // Verificar token
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (token !== TEMP_TOKEN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { to, subject, html } = body

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    // Usar enviarEmail del lib — no soporta attachments, así que solo enviamos texto
    // y subimos los archivos a /public temporalmente
    const result = await enviarEmail({
      to,
      subject,
      html: html + `
        <p style="margin-top: 24px; padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; color: #1e40af; font-size: 13px;">
          <strong>Nota:</strong> Los archivos PDF y DOCX de la guía están disponibles para descarga directa en:<br>
          <a href="https://jsadr-1029-jsadr.vercel.app/guia/Guia_Registro_Cliente_JSADR.pdf" style="color: #2563eb;">Descargar PDF</a><br>
          <a href="https://jsadr-1029-jsadr.vercel.app/guia/Guia_Registro_Cliente_JSADR.docx" style="color: #2563eb;">Descargar Word editable</a>
        </p>
      `,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
