// =====================================================
// Test directo de WhatsApp Cloud API (sin BD, sin servidor)
// Verifica que las credenciales funcionan enviando un mensaje
// de prueba al número indicado.
// =====================================================
// Uso:
//   npx tsx scripts/test-whatsapp-cloud.ts <telefono_destino>
//   npx tsx scripts/test-whatsapp-cloud.ts 573103674546
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

const destino = process.argv[2] || '573103674546'

function limpiar(t: string): string {
  let l = t.replace(/[^\d]/g, '')
  if (l.length === 10) l = '57' + l
  return l
}

async function main() {
  console.log('=== TEST WHATSAPP CLOUD API ===')
  console.log('PHONE_NUMBER_ID:', PHONE_NUMBER_ID)
  console.log('TOKEN:', TOKEN ? `${TOKEN.slice(0, 12)}...${TOKEN.slice(-6)}` : '(vacío)')
  console.log('GRAPH_VERSION:', GRAPH_VERSION)
  console.log('Destino:', destino, '→', limpiar(destino))
  console.log('')

  if (!TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ Faltan variables WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el entorno.')
    process.exit(1)
  }

  // === Prueba 1: mensaje texto libre ===
  console.log('--- Prueba 1: texto libre ---')
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: limpiar(destino),
    type: 'text',
    text: {
      body: `🧪 *TEST JSADR* — WhatsApp Cloud API conectada correctamente.\n\nSi recibes este mensaje, la integración OTP está lista.\n\nHora: ${new Date().toISOString()}`,
      preview_url: false,
    },
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await resp.json()
    if (!resp.ok) {
      console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
      console.error('  → Mensaje de error Meta:', data?.error?.message)
      console.error('  → Código:', data?.error?.code, '/', data?.error?.error_subcode)
    } else {
      const wamid = data?.messages?.[0]?.id
      console.log('✅ ÉXITO — wamid:', wamid)
      console.log('   Respuesta completa:', JSON.stringify(data, null, 2))
    }
  } catch (e: any) {
    console.error('❌ Excepción:', e?.message || e)
  }

  console.log('')

  // === Prueba 2: plantilla OTP (si está configurada) ===
  const PLANTILLA = process.env.WHATSAPP_PLANTILLA_OTP_NOMBRE || 'codigo_otp_jsadr'
  const IDIOMA = process.env.WHATSAPP_PLANTILLA_OTP_IDIOMA || 'es'
  console.log('--- Prueba 2: plantilla OTP ---')
  console.log('Plantilla:', PLANTILLA, '| Idioma:', IDIOMA)
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const bodyTpl = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: limpiar(destino),
    type: 'template',
    template: {
      name: PLANTILLA,
      language: { code: IDIOMA },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: otp },
          ],
        },
      ],
    },
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyTpl),
    })
    const data = await resp.json()
    if (!resp.ok) {
      console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
      console.error('  → Mensaje de error Meta:', data?.error?.message)
      console.error('  → Código:', data?.error?.code, '/', data?.error?.error_subcode)
      console.error('  → Si el código es 1320xx, la plantilla aún no está aprobada o el nombre/idioma es incorrecto.')
    } else {
      const wamid = data?.messages?.[0]?.id
      console.log('✅ ÉXITO — wamid:', wamid)
      console.log('   Respuesta completa:', JSON.stringify(data, null, 2))
    }
  } catch (e: any) {
    console.error('❌ Excepción:', e?.message || e)
  }
}

main()
