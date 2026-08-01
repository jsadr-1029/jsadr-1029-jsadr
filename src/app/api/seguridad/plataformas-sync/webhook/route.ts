import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decryptSensitive } from '@/lib/security'
import crypto from 'crypto'

// =====================================================
// Webhook Receiver para GitHub / Vercel / Neon
// Recibe eventos en tiempo real de cada plataforma y los
// registra en PlataformaSync (incrementa contador, actualiza
// último sync, etc.)
//
// URL pública esperada:
//   /api/seguridad/plataformas-sync/webhook?plataforma=GITHUB
//   /api/seguridad/plataformas-sync/webhook?plataforma=VERCEL
//   /api/seguridad/plataformas-sync/webhook?plataforma=NEON
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const plataforma = (url.searchParams.get('plataforma') || '').toUpperCase()

    if (!['GITHUB', 'VERCEL', 'NEON'].includes(plataforma)) {
      return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
    }

    const record = await db.plataformaSync.findUnique({ where: { plataforma } })
    if (!record) {
      return NextResponse.json({ error: `Plataforma ${plataforma} no registrada` }, { status: 404 })
    }

    // Validar firma del webhook si hay secreto configurado
    if (record.webhookSecret) {
      // FIX-SEGURIDAD-CRITICA #9: record.webhookSecret está AES-cifrado en BD.
      // Antes se usaba directamente como HMAC key, lo que hacía que la firma
      // nunca validara correctamente (HMAC sobre el ciphertext en vez del plaintext).
      // Ahora se descifra primero; si falla, se asume que es plaintext (legacy).
      let secret = record.webhookSecret
      try {
        const decrypted = decryptSensitive(record.webhookSecret)
        // decryptSensitive devuelve el original si no estaba cifrado o falla;
        // si el valor descifrado es distinto, usarlo.
        if (decrypted && decrypted !== record.webhookSecret) {
          secret = decrypted
        }
      } catch {
        // si la desencriptación falla, asumir plaintext (registro legacy)
      }
      const body = await req.text()

      let firmaValida = false
      if (plataforma === 'GITHUB') {
        const sig = req.headers.get('x-hub-signature-256') || ''
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
        firmaValida = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      } else if (plataforma === 'VERCEL') {
        const sig = req.headers.get('x-vercel-signature') || ''
        const expected = crypto.createHmac('sha1', secret).update(body).digest('hex')
        firmaValida = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      } else {
        // Neon no envía firma estándar; confiamos en el secreto en query
        const provided = url.searchParams.get('secret')
        firmaValida = provided === secret
      }

      if (!firmaValida) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      }
    }

    // Si la sincronización en tiempo real está desactivada, ignorar
    if (!record.tiempoReal) {
      return NextResponse.json({ ok: false, ignored: true, motivo: 'tiempo_real_desactivado' })
    }

    // Registrar evento
    const updated = await db.plataformaSync.update({
      where: { plataforma },
      data: {
        eventosRecibidos: { increment: 1 },
        ultimoSync: new Date(),
        ultimoEstado: 'OK',
        ultimoError: null,
      },
    })

    // Opcional: almacenar tipo de evento para auditoría
    const eventType =
      plataforma === 'GITHUB' ? req.headers.get('x-github-event') :
      plataforma === 'VERCEL' ? req.headers.get('x-vercel-event') :
      'neon.event'

    // Log simple (puede ampliarse a una tabla WebhookEvento)
    console.log(`[webhook:${plataforma}] event=${eventType} total=${updated.eventosRecibidos}`)

    return NextResponse.json({
      ok: true,
      plataforma,
      evento: eventType,
      totalRecibidos: updated.eventosRecibidos,
    })
  } catch (e) {
    console.error('[webhook plataformas-sync]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    servicio: 'Webhook Receiver - Plataformas de Sincronización',
    endpoints: [
      '/api/seguridad/plataformas-sync/webhook?plataforma=GITHUB',
      '/api/seguridad/plataformas-sync/webhook?plataforma=VERCEL',
      '/api/seguridad/plataformas-sync/webhook?plataforma=NEON&secret=XXX',
    ],
    notas: [
      'Configura la URL pública en cada plataforma:',
      '  GitHub: Settings → Webhooks → Add webhook',
      '  Vercel: Project → Settings → Git → Integrations',
      '  Neon: Project → Integrations → Webhooks',
      'El secreto se valida cuando está configurado en PlataformaSync.webhookSecret.',
    ],
  })
}
