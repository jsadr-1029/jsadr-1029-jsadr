// =====================================================
// Inspecciona el Business Manager para ver todos los
// WABAs y números asociados, y verifica si se puede
// crear un WABA nuevo desde la API.
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const BUSINESS_ID = '13704296878635168' // JSADR Business Manager
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function get(path: string, fields?: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}${fields ? `?fields=${fields}` : ''}`
  console.log(`GET ${url}`)
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const data = await resp.json()
  if (!resp.ok) {
    console.error(`  ❌ HTTP ${resp.status}:`, data?.error?.message || JSON.stringify(data))
    return null
  }
  console.log('  ✅', JSON.stringify(data, null, 2))
  return data
}

async function post(path: string, body: any) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
  console.log(`POST ${url}`)
  console.log('  Body:', JSON.stringify(body, null, 2))
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
    console.error(`  ❌ HTTP ${resp.status}:`, JSON.stringify(data, null, 2))
    return null
  }
  console.log('  ✅', JSON.stringify(data, null, 2))
  return data
}

async function main() {
  console.log('=== BUSINESS MANAGER ===\n')

  // 1. Info del Business
  console.log('--- 1. Business Manager ---')
  await get(BUSINESS_ID, 'id,name,verification_status')

  // 2. WABAs del Business
  console.log('\n--- 2. Owned WhatsApp Business Accounts ---')
  await get(`${BUSINESS_ID}/owned_whatsapp_business_accounts`, 'id,name,account_review_status,verification_status,timezone_id,currency,primary_phone_number')

  // 3. Intentar crear un nuevo WABA
  console.log('\n--- 3. Crear nuevo WABA ---')
  await post(`${BUSINESS_ID}/owned_whatsapp_business_accounts`, {
    name: 'JSADR Produccion',
    timezone: 'America/Bogota',
    currency: 'COP',
  })

  // 4. Volver a listar WABAs
  console.log('\n--- 4. WABAs después de intentar crear ---')
  await get(`${BUSINESS_ID}/owned_whatsapp_business_accounts`, 'id,name,account_review_status,verification_status')
}

main()
