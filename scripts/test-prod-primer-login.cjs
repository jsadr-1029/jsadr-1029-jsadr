// =====================================================
// Test end-to-end contra PRODUCCIÓN (https://jsadr.com.co)
// del flujo v4.13: cambio de clave obligatorio + email.
// =====================================================
const BASE = 'https://jsadr.com.co'
const ADMIN_USER = 'adm-jsadr'
const ADMIN_PASS = 'Js951029*'
const ORIGIN = BASE
const CEDULA_TEST = '99' + Date.now().toString().slice(-8)

function authHeaders(cookie, bearer) {
  const h = { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' }
  if (cookie) h['Cookie'] = cookie
  if (bearer) h['Authorization'] = 'Bearer ' + bearer
  return h
}

async function main() {
  console.log('=== Test PROD: Cambio de clave obligatorio (v4.13) ===\n')

  // 1. Login admin
  console.log('[1] Login admin...')
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  const lj = await lr.json()
  if (lr.status !== 200 || !lj.success) {
    console.error(`❌ Login admin falló: HTTP ${lr.status}`, lj)
    process.exit(1)
  }
  const token = lj.data?.access_token
  if (!token) {
    console.error('❌ Respuesta de login no contiene access_token:', lj)
    process.exit(1)
  }
  console.log('✅ Login admin OK\n')

  // 2. Categorias + Cuentas
  console.log('[2] Obteniendo categoría y cuenta...')
  const cat = await fetch(`${BASE}/api/categorias`, { headers: authHeaders(null, token) })
  const catJ = await cat.json()
  if (!catJ.success || !catJ.data?.length) {
    console.error('❌ No hay categorías:', catJ)
    process.exit(1)
  }
  const categoria = catJ.data[0]
  console.log(`   Categoría: ${categoria.nombre} (${categoria.codigo})`)

  const cue = await fetch(`${BASE}/api/cuentas`, { headers: authHeaders(null, token) })
  const cueJ = await cue.json()
  if (!cueJ.success || !cueJ.data?.length) {
    console.error('❌ No hay cuentas:', cueJ)
    process.exit(1)
  }
  const cuenta = cueJ.data[0]
  console.log(`   Cuenta: ${cuenta.nombre} (${cuenta.codigo})\n`)

  // 3. Crear cliente sin email
  console.log('[3] Creando cliente sin email (clave debe devolverse)...')
  console.log(`    Cédula: ${CEDULA_TEST}`)
  const cr = await fetch(`${BASE}/api/clientes`, {
    method: 'POST',
    headers: authHeaders(null, token),
    body: JSON.stringify({
      nombre: 'Cliente Prueba v4.13 PROD',
      cedula: CEDULA_TEST,
      telefono: '3000000000',
      email: '',
      categoriaId: categoria.id,
      cuentaRecaudoId: cuenta.id,
      preferenciaNotificacion: 'WHATSAPP',
    }),
  })
  const cj = await cr.json()
  console.log(`   HTTP ${cr.status}`)
  console.log(`   success: ${cj.success}`)
  console.log(`   emailEnviado: ${cj.emailEnviado}`)
  console.log(`   claveTemporal: ${cj.claveTemporal || '[ausente]'}`)
  console.log(`   mensaje: ${cj.mensaje || cj.error}`)
  if (!cj.success || !cj.claveTemporal) {
    console.error('❌ No se pudo crear el cliente o no devolvió clave temporal')
    process.exit(1)
  }
  const claveTemporal = cj.claveTemporal
  const clienteId = cj.data?.id
  console.log('✅ Cliente creado con clave temporal generada\n')

  // 4. Login cliente con clave temporal → CAMBIO_CLAVE_OBLIGATORIO
  console.log('[4] Login del cliente con clave temporal...')
  const l1 = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ cedula: CEDULA_TEST, clave: claveTemporal }),
  })
  const l1j = await l1.json()
  console.log(`   HTTP ${l1.status}`)
  console.log(`   success: ${l1j.success}`)
  console.log(`   codigo: ${l1j.codigo}`)
  console.log(`   mensaje: ${l1j.mensaje}`)
  console.log(`   claveTempToken presente: ${!!l1j.claveTempToken}`)
  if (l1j.codigo !== 'CAMBIO_CLAVE_OBLIGATORIO' || !l1j.claveTempToken) {
    console.error('❌ Se esperaba CAMBIO_CLAVE_OBLIGATORIO + claveTempToken')
    process.exit(1)
  }
  const claveTempToken = l1j.claveTempToken
  console.log('✅ Flujo de cambio obligatorio detectado\n')

  // 5. Cambiar clave
  const nuevaClave = 'MiNuevaClave2026!'
  console.log('[5] Cambiando la clave con /api/portal/cambiar-clave-primer-login...')
  const c1 = await fetch(`${BASE}/api/portal/cambiar-clave-primer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ claveTempToken, nuevaClave, confirmarClave: nuevaClave }),
  })
  const c1j = await c1.json()
  console.log(`   HTTP ${c1.status}`)
  console.log(`   success: ${c1j.success}`)
  console.log(`   mensaje: ${c1j.mensaje}`)
  console.log(`   token: ${c1j.token ? '[presente]' : '[ausente]'}`)
  if (!c1j.success || !c1j.token) {
    console.error('❌ El cambio de clave falló')
    process.exit(1)
  }
  console.log('✅ Clave cambiada correctamente, sesión entregada\n')

  // 6. Login con nueva clave
  console.log('[6] Login con la nueva clave (debe ser success)...')
  const l2 = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ cedula: CEDULA_TEST, clave: nuevaClave }),
  })
  const l2j = await l2.json()
  console.log(`   HTTP ${l2.status}, success: ${l2j.success}`)
  if (!l2j.success) {
    console.error('❌ El login con la nueva clave falló')
    process.exit(1)
  }
  console.log('✅ Login con la nueva clave OK\n')

  // 7. Login con clave temporal vieja (debe fallar)
  console.log('[7] Login con la clave temporal vieja (debe fallar)...')
  const l3 = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ cedula: CEDULA_TEST, clave: claveTemporal }),
  })
  const l3j = await l3.json()
  console.log(`   HTTP ${l3.status}, success: ${l3j.success}`)
  if (l3j.success) {
    console.error('❌ El login con la clave vieja debería fallar')
    process.exit(1)
  }
  console.log('✅ Clave vieja correctamente rechazada\n')

  // 8. Reutilizar claveTempToken (debe fallar)
  console.log('[8] Reutilizar claveTempToken (debe fallar)...')
  const c2 = await fetch(`${BASE}/api/portal/cambiar-clave-primer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Referer': BASE + '/' },
    body: JSON.stringify({ claveTempToken, nuevaClave: 'OtraClave456!', confirmarClave: 'OtraClave456!' }),
  })
  const c2j = await c2.json()
  console.log(`   HTTP ${c2.status}, success: ${c2j.success}, error: ${c2j.error}`)
  if (c2j.success) {
    console.error('❌ El token temporal debería ser de un solo uso')
    process.exit(1)
  }
  console.log('✅ Token temporal correctamente invalidado\n')

  // 9. Cleanup
  console.log('[9] Limpieza: desactivando cliente de prueba...')
  const del = await fetch(`${BASE}/api/clientes/${clienteId}`, {
    method: 'PATCH',
    headers: authHeaders(null, token),
    body: JSON.stringify({ activo: false }),
  })
  const delJ = await del.json().catch(() => ({}))
  console.log(`   HTTP ${del.status}, success: ${delJ.success}`)
  console.log(delJ.success ? '✅ Cliente desactivado' : '⚠️  No se pudo desactivar (limpiar manualmente)')

  console.log('\n=== ✅ TODAS LAS PRUEBAS PASARON EN PRODUCCIÓN ===')
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
