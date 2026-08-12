// =====================================================
// Lista los números de teléfono disponibles en el WABA
// para entender cuál debemos usar como PHONE_NUMBER_ID.
// =====================================================
// Uso:
//   npx tsx scripts/list-whatsapp-numbers.ts
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA_ID = process.env.WHATSAPP_BUSINESS_ID
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function main() {
  console.log('=== WHATSAPP BUSINESS ACCOUNT - NUMEROS ===')
  console.log('WABA_ID:', WABA_ID)
  console.log('TOKEN:', TOKEN ? `${TOKEN.slice(0, 12)}...${TOKEN.slice(-6)}` : '(vacío)')
  console.log('')

  if (!TOKEN || !WABA_ID) {
    console.error('Faltan variables WHATSAPP_TOKEN o WHATSAPP_BUSINESS_ID')
    process.exit(1)
  }

  // Listar phone numbers del WABA
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/phone_numbers`
  console.log('GET', url)
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const data = await resp.json()
    if (!resp.ok) {
      console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
      process.exit(1)
    }
    console.log('✅ Numeros en el WABA:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Para cada phone number, obtener detalles
    if (data?.data) {
      for (const num of data.data) {
        console.log(`--- Detalles de ${num.id} ---`)
        const url2 = `https://graph.facebook.com/${GRAPH_VERSION}/${num.id}`
        const resp2 = await fetch(url2, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data2 = await resp2.json()
        console.log(JSON.stringify(data2, null, 2))
        console.log('')
      }
    }
  } catch (e: any) {
    console.error('❌ Excepción:', e?.message || e)
  }
}

main()
