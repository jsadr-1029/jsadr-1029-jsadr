#!/usr/bin/env node
// =====================================================
// test-bancolombia-integration.cjs
// =====================================================
// End-to-end test on Vercel production:
//   1. Login as adm-jsadr
//   2. GET /api/configuracion-global/bancolombia (should return configurada:false)
//   3. POST /api/configuracion-global/bancolombia/probar (should fail since no creds)
//   4. POST test credentials (sandbox) - should save
//   5. GET again - should show configurada:true
// =====================================================

const BASE = process.argv[2] || 'https://jsadr-jsadr.vercel.app'

async function main() {
  console.log(`=== Test Bancolombia Integration on ${BASE} ===\n`)

  // 1) Login
  console.log('--- 1) Login as adm-jsadr ---')
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'Js951029*' }),
  })
  const loginJson = await loginRes.json()
  if (!loginJson.success) {
    console.log('  ❌ Login failed:', loginJson.error)
    process.exit(1)
  }
  const token = loginJson.data.access_token
  console.log('  ✅ Login OK, token obtained')

  // 2) GET current config
  console.log('\n--- 2) GET /api/configuracion-global/bancolombia ---')
  const getRes = await fetch(`${BASE}/api/configuracion-global/bancolombia`, {
    headers: { Authorization: `Bearer ${token}`, Origin: BASE },
  })
  const getJson = await getRes.json()
  console.log(`  HTTP ${getRes.status}`)
  console.log(`  Response:`, JSON.stringify(getJson, null, 2))

  // 3) Try probar without creds (should fail with 404)
  console.log('\n--- 3) POST /api/configuracion-global/bancolombia/probar (no creds) ---')
  const probarRes = await fetch(`${BASE}/api/configuracion-global/bancolombia/probar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: BASE },
    body: JSON.stringify({}),
  })
  const probarJson = await probarRes.json()
  console.log(`  HTTP ${probarRes.status}`)
  console.log(`  Response:`, JSON.stringify(probarJson, null, 2))

  // 4) Save test credentials (sandbox with fake values just to verify save works)
  console.log('\n--- 4) POST save test credentials ---')
  const saveRes = await fetch(`${BASE}/api/configuracion-global/bancolombia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: BASE },
    body: JSON.stringify({
      clientId: 'test-client-id-12345',
      clientSecret: 'test-client-secret-67890',
      commerceId: 'test-commerce-id',
      ambiente: 'sandbox',
      redirectUrl: `${BASE}/api/pagos/bancolombia-redirect`,
      webhookUrl: `${BASE}/api/pagos/bancolombia-webhook`,
      activa: true,
    }),
  })
  const saveJson = await saveRes.json()
  console.log(`  HTTP ${saveRes.status}`)
  console.log(`  Response:`, JSON.stringify(saveJson, null, 2))

  // 5) GET again
  console.log('\n--- 5) GET config (should show configurada:true) ---')
  const getRes2 = await fetch(`${BASE}/api/configuracion-global/bancolombia`, {
    headers: { Authorization: `Bearer ${token}`, Origin: BASE },
  })
  const getJson2 = await getRes2.json()
  console.log(`  HTTP ${getRes2.status}`)
  console.log(`  Response:`, JSON.stringify(getJson2, null, 2))

  // 6) Try probar with the (fake) saved creds - should fail at OAuth2
  console.log('\n--- 6) POST /probar with saved (fake) creds ---')
  const probarRes2 = await fetch(`${BASE}/api/configuracion-global/bancolombia/probar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: BASE },
    body: JSON.stringify({}),
  })
  const probarJson2 = await probarRes2.json()
  console.log(`  HTTP ${probarRes2.status}`)
  console.log(`  Response:`, JSON.stringify(probarJson2, null, 2))

  console.log('\n=== Test completed ===')
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); })
