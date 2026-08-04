// Test the 3 portal fixes on Vercel production
async function main() {
  const BASE = 'https://jsadr-1029-jsadr.vercel.app'
  const headers = {
    'Content-Type': 'application/json',
    Origin: BASE,
    Referer: BASE + '/',
    'User-Agent': 'Mozilla/5.0 (test)',
  }

  console.log('=== Test 1: Estado de cuenta (con token inválido) ===')
  const r1 = await fetch(`${BASE}/api/estado-cuenta?cedula=1214731649&token=invalid-token-test`, { headers })
  console.log(`HTTP ${r1.status}: ${(await r1.text()).slice(0, 200)}`)
  console.log('  → Esperado: 401 SESSION_EXPIRED (route handler) NO 401 UNAUTHORIZED (proxy)')

  console.log('\n=== Test 2: Chat iniciar (cédula + teléfono correcto) ===')
  const r2 = await fetch(`${BASE}/api/chat/iniciar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cedula: '1214731649', telefono: '9510' }),
  })
  console.log(`HTTP ${r2.status}: ${(await r2.text()).slice(0, 250)}`)
  console.log('  → Esperado: 200 success con sessionId')

  console.log('\n=== Test 3: Chat iniciar (teléfono incorrecto) ===')
  const r3 = await fetch(`${BASE}/api/chat/iniciar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cedula: '1214731649', telefono: '9999' }),
  })
  console.log(`HTTP ${r3.status}: ${(await r3.text()).slice(0, 200)}`)
  console.log('  → Esperado: 401 MISMATCH')

  console.log('\n=== Test 4: Recuperar clave (debería fallar por IP restriction de Brevo) ===')
  const r4 = await fetch(`${BASE}/api/auth/recuperar-clave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ identificador: 'adm-jsadr' }),
  })
  console.log(`HTTP ${r4.status}: ${(await r4.text()).slice(0, 250)}`)
}
main().catch(e => console.error('ERR:', e))
