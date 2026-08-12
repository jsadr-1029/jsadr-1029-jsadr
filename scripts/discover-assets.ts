// =====================================================
// Descubre todos los negocios, WABAs y números
// accesibles con el token actual.
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function get(url: string) {
  console.log(`GET ${url}`)
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const data = await resp.json()
  if (!resp.ok) {
    console.error(`  ❌ HTTP ${resp.status}:`, data?.error?.message)
    return null
  }
  console.log('  ✅', JSON.stringify(data, null, 2))
  return data
}

async function main() {
  console.log('=== DESCUBRIR ASSETS DEL TOKEN ===\n')

  // 1. /me
  console.log('--- 1. /me ---')
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/me`)

  // 2. /me/accounts (todas las Pages, Apps, WABAs)
  console.log('\n--- 2. /me/accounts ---')
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,category,platform,tasks`)

  // 3. /me/businesses (negocios)
  console.log('\n--- 3. /me/businesses ---')
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/me/businesses?fields=id,name,verification_status`)

  // 4. /me/business_users
  console.log('\n--- 4. /me/permissions ---')
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/me/permissions`)

  // 5. WABA actual
  console.log('\n--- 5. WABA actual (lo que ya conocemos) ---')
  const wabaId = process.env.WHATSAPP_BUSINESS_ID
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}?fields=id,name,account_review_status,primary_phone_number,onboarding_status,namespace,currency,timezone_id,messaging_limit_tier`)

  // 6. Buscar el owning_business del WABA actual
  console.log('\n--- 6. owning_business del WABA ---')
  await get(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}?fields=owning_business`)

  // 7. Probar /{business_id}/client_whatsapp_business_accounts
  console.log('\n--- 7. Para cada business en /me/businesses, listar WABAs ---')
  const biz = await get(`https://graph.facebook.com/${GRAPH_VERSION}/me/businesses`)
  if (biz?.data) {
    for (const b of biz.data) {
      console.log(`\n   WABAs de ${b.name} (${b.id}):`)
      await get(`https://graph.facebook.com/${GRAPH_VERSION}/${b.id}/owned_whatsapp_business_accounts?fields=id,name,account_review_status`)
    }
  }
}

main()
