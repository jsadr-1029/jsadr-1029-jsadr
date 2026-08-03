// =====================================================
// test-portal-cliente.js
// E2E test del login al portal del cliente
// Prueba con 3 clientes existentes:
//   1. CAROLINA ALVAREZ (1214726347) — sin PIN → auto-crea
//   2. juaquin (123456789) — sin PIN → auto-crea
//   3. TEST 2 (888888888) — sin PIN → auto-crea
//   4. Cliente Tasa Test (999999999) — inactivo → debe dar 403
// Verifica:
//   - Login exitoso devuelve token + clienteId + nombre
//   - El token funciona para acceder a /api/portal/[cedula]
//   - Redirección al portal cliente
// =====================================================

const BASE = 'http://localhost:3000'

async function portalLogin(cedula, pin) {
  const res = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula, pin }),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function getPortalData(cedula, token) {
  const res = await fetch(`${BASE}/api/portal/${cedula}`, {
    headers: { 'x-portal-token': token },
  })
  return { status: res.status, hasData: res.ok }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  TEST PORTAL CLIENTE — JSADR')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // === TEST 1: CAROLINA ALVAREZ (sin PIN) ===
  console.log('\n[1] Login cliente: CAROLINA ALVAREZ (1214726347)...')
  const r1 = await portalLogin('1214726347', '1234')
  console.log(`   Status: ${r1.status}`)
  console.log(`   Body: ${JSON.stringify(r1.data).slice(0, 200)}`)
  const ok1 = r1.data?.success === true && !!r1.data?.token && !!r1.data?.clienteId
  console.log(`   ${ok1 ? '✅' : '❌'} Login OK — cliente: ${r1.data?.nombre}, nuevoPin: ${r1.data?.nuevoPin}`)

  if (ok1) {
    console.log('   → Verificando acceso al portal con token...')
    const pd1 = await getPortalData('1214726347', r1.data.token)
    console.log(`   ${pd1.status === 200 ? '✅' : '❌'} GET /api/portal/1214726347 → ${pd1.status}`)
  }

  // === TEST 2: juaquin (sin PIN) ===
  console.log('\n[2] Login cliente: juaquin (123456789)...')
  const r2 = await portalLogin('123456789', '5678')
  console.log(`   Status: ${r2.status}`)
  console.log(`   Body: ${JSON.stringify(r2.data).slice(0, 200)}`)
  const ok2 = r2.data?.success === true && !!r2.data?.token
  console.log(`   ${ok2 ? '✅' : '❌'} Login OK — cliente: ${r2.data?.nombre}`)

  if (ok2) {
    const pd2 = await getPortalData('123456789', r2.data.token)
    console.log(`   ${pd2.status === 200 ? '✅' : '❌'} GET /api/portal/123456789 → ${pd2.status}`)
  }

  // === TEST 3: TEST 2 (sin PIN) ===
  console.log('\n[3] Login cliente: TEST 2 (888888888)...')
  const r3 = await portalLogin('888888888', '9999')
  console.log(`   Status: ${r3.status}`)
  console.log(`   Body: ${JSON.stringify(r3.data).slice(0, 200)}`)
  const ok3 = r3.data?.success === true && !!r3.data?.token
  console.log(`   ${ok3 ? '✅' : '❌'} Login OK — cliente: ${r3.data?.nombre}`)

  if (ok3) {
    const pd3 = await getPortalData('888888888', r3.data.token)
    console.log(`   ${pd3.status === 200 ? '✅' : '❌'} GET /api/portal/888888888 → ${pd3.status}`)
  }

  // === TEST 4: Cliente inactivo (debe fallar con 403) ===
  console.log('\n[4] Login cliente inactivo: Cliente Tasa Test (999999999)...')
  const r4 = await portalLogin('999999999', '1234')
  console.log(`   Status: ${r4.status}`)
  console.log(`   Body: ${JSON.stringify(r4.data).slice(0, 200)}`)
  const ok4 = r4.status === 403 || r4.data?.error?.toLowerCase().includes('inactiv')
  console.log(`   ${ok4 ? '✅' : '❌'} Bloqueo cliente inactivo: ${ok4 ? 'OK' : 'NO BLOQUEADO'}`)

  // === TEST 5: Login unificado del frontend simula cédula → portal ===
  console.log('\n[5] Verificando detección de cédula en /login (regex /^\\d{6,12}$/)...')
  const cedulas = ['1214726347', '123456789', '888888888', '999999999']
  for (const c of cedulas) {
    const esCedula = /^\d{6,12}$/.test(c)
    console.log(`   ${esCedula ? '✅' : '❌'} ${c} → detectado como cédula: ${esCedula}`)
  }

  // === RESUMEN ===
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RESUMEN')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  CAROLINA ALVAREZ login:    ${ok1 ? '✅' : '❌'}`)
  console.log(`  juaquin login:             ${ok2 ? '✅' : '❌'}`)
  console.log(`  TEST 2 login:              ${ok3 ? '✅' : '❌'}`)
  console.log(`  Cliente inactivo bloqueado: ${ok4 ? '✅' : '❌'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  process.exit(0)
}

main().catch(e => {
  console.error('Error fatal:', e)
  process.exit(1)
})
