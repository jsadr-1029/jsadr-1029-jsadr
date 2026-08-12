// =====================================================
// Inspecciona el estado del WABA y por qué no permite
// crear plantillas de mensaje.
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA_ID = process.env.WHATSAPP_BUSINESS_ID
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function getField(path: string, fields?: string) {
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

async function main() {
  console.log('=== ESTADO DEL WABA ===\n')

  // 1. Info del WABA
  console.log('--- 1. WABA ---')
  await getField(WABA_ID, 'id,name,verification_status,onboarding_status,message_template_namespace,primary_phone_number,currency_account,account_review_status')

  console.log('\n--- 2. Business (negocio asociado) ---')
  // El WABA está asociado a un Business. Buscamos el business_id.
  const waba = await getField(WABA_ID, 'id,name,owning_business')
  if (waba?.owning_business?.id) {
    await getField(waba.owning_business.id, 'id,name,verification_status')
  }

  console.log('\n--- 3. Phone numbers (detalle) ---')
  const phones = await getField(`${WABA_ID}/phone_numbers`, 'id,verified_name,display_phone_number,code_verification_status,quality_rating,name_status, eligibility_for_api_business_global_search')

  console.log('\n--- 4. Messaging limit tier ---')
  await getField(WABA_ID, 'id,name,messaging_limit_tier')

  console.log('\n--- 5. Permisos del token ---')
  // Verificar permisos del token
  const tokenInfo = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`
  ).then(r => r.json())
  console.log('Token debug:', JSON.stringify(tokenInfo, null, 2))
}

main()
