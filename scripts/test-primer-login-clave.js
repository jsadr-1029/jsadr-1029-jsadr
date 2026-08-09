// =====================================================
// test-primer-login-clave.js
// Prueba end-to-end del flujo de cambio de clave obligatorio en el primer ingreso (v4.13)
//
// Pasos:
//   1. Login admin
//   2. Crear cliente de prueba (sin email → la clave temporal se devuelve en la respuesta)
//   3. Login del cliente con la clave temporal → debe devolver codigo='CAMBIO_CLAVE_OBLIGATORIO'
//   4. Cambiar la clave usando /api/portal/cambiar-clave-primer-login → debe devolver success:true + token
//   5. Login del cliente con la nueva clave → debe devolver success:true (sin código especial)
//   6. Login del cliente con la clave temporal vieja → debe fallar
//   7. Limpiar (desactivar el cliente de prueba)
// =====================================================

const BASE = process.env.BASE || 'http://localhost:3000'
const ADMIN_USER = 'adm-jsadr'
const ADMIN_PASS = 'Js951029*'

// Generar cédula única para la prueba (10 dígitos empezando en 99 para no chocar con cédulas reales)
const CEDULA_TEST = '99' + Date.now().toString().slice(-8)

async function adminLogin() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  const token = r.headers.get('set-cookie')?.split(';')[0] || ''
  return { cookie: token, status: r.status }
}

async function main() {
  console.log('=== Test: Cambio de clave obligatorio en primer ingreso (v4.13) ===\n')

  // === 1. Login admin ===
  console.log('[1] Login admin...')
  const { cookie, status: loginStatus } = await adminLogin()
  if (loginStatus !== 200) {
    console.error(`❌ Login admin falló: HTTP ${loginStatus}`)
    process.exit(1)
  }
  console.log('✅ Login admin OK\n')

  // Primero obtener categoría y cuenta disponibles
  console.log('[2] Obteniendo categoría y cuenta de recaudo...')
  const catRes = await fetch(`${BASE}/api/categorias`, {
    headers: { Cookie: cookie },
  })
  const catJson = await catRes.json()
  if (!catJson.success || !catJson.data?.length) {
    console.error('❌ No hay categorías disponibles para la prueba')
    process.exit(1)
  }
  const categoria = catJson.data[0]
  console.log(`   Categoría: ${categoria.nombre} (${categoria.codigo})`)

  const cueRes = await fetch(`${BASE}/api/cuentas`, {
    headers: { Cookie: cookie },
  })
  const cueJson = await cueRes.json()
  if (!cueJson.success || !cueJson.data?.length) {
    console.error('❌ No hay cuentas de recaudo disponibles para la prueba')
    process.exit(1)
  }
  const cuenta = cueJson.data[0]
  console.log(`   Cuenta: ${cuenta.nombre} (${cuenta.codigo})\n`)

  // === 3. Crear cliente de prueba (sin email) ===
  console.log('[3] Creando cliente de prueba (sin email)...')
  console.log(`    Cédula: ${CEDULA_TEST}`)
  const crearRes = await fetch(`${BASE}/api/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      nombre: 'Cliente Prueba v4.13',
      cedula: CEDULA_TEST,
      telefono: '3000000000',
      email: '', // email vacío (el schema lo acepta)
      categoriaId: categoria.id,
      cuentaRecaudoId: cuenta.id,
      preferenciaNotificacion: 'WHATSAPP',
    }),
  })
  const crearJson = await crearRes.json()
  if (!crearJson.success) {
    console.error('❌ No se pudo crear el cliente:', crearJson.error)
    process.exit(1)
  }
  console.log('✅ Cliente creado')
  console.log(`   - emailEnviado: ${crearJson.emailEnviado}`)
  console.log(`   - claveTemporal: ${crearJson.claveTemporal}`)
  console.log(`   - mensaje: ${crearJson.mensaje}\n`)

  if (!crearJson.claveTemporal) {
    console.error('❌ El backend no devolvió la clave temporal (debería, porque el cliente no tiene email)')
    process.exit(1)
  }

  const claveTemporal = crearJson.claveTemporal
  const clienteId = crearJson.data.id

  // === 4. Login del cliente con la clave temporal ===
  console.log('[4] Login del cliente con clave temporal (debe devolver CAMBIO_CLAVE_OBLIGATORIO)...')
  const login1Res = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cedula: CEDULA_TEST,
      clave: claveTemporal,
    }),
  })
  const login1Json = await login1Res.json()
  console.log(`   HTTP ${login1Res.status}`)
  console.log(`   success: ${login1Json.success}`)
  console.log(`   codigo: ${login1Json.codigo}`)
  console.log(`   mensaje: ${login1Json.mensaje}`)
  console.log(`   claveTempToken presente: ${!!login1Json.claveTempToken}`)

  if (login1Json.codigo !== 'CAMBIO_CLAVE_OBLIGATORIO') {
    console.error('❌ Se esperaba codigo="CAMBIO_CLAVE_OBLIGATORIO" pero se obtuvo:', login1Json.codigo)
    process.exit(1)
  }
  if (!login1Json.claveTempToken) {
    console.error('❌ No se devolvió claveTempToken')
    process.exit(1)
  }
  console.log('✅ Flujo de cambio obligatorio detectado correctamente\n')

  const claveTempToken = login1Json.claveTempToken
  const nuevaClave = 'MiNuevaClave2026!'

  // === 5. Cambiar la clave ===
  console.log('[5] Cambiando la clave con /api/portal/cambiar-clave-primer-login...')
  const cambioRes = await fetch(`${BASE}/api/portal/cambiar-clave-primer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claveTempToken,
      nuevaClave,
      confirmarClave: nuevaClave,
    }),
  })
  const cambioJson = await cambioRes.json()
  console.log(`   HTTP ${cambioRes.status}`)
  console.log(`   success: ${cambioJson.success}`)
  console.log(`   mensaje: ${cambioJson.mensaje}`)
  console.log(`   token: ${cambioJson.token ? '[presente]' : '[ausente]'}`)
  console.log(`   nombre: ${cambioJson.nombre}`)

  if (!cambioJson.success || !cambioJson.token) {
    console.error('❌ El cambio de clave falló')
    process.exit(1)
  }
  console.log('✅ Clave cambiada correctamente, sesión iniciada\n')

  // === 6. Login del cliente con la nueva clave (debe ser exitoso) ===
  console.log('[6] Login del cliente con la nueva clave (debe ser success:true)...')
  const login2Res = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cedula: CEDULA_TEST,
      clave: nuevaClave,
    }),
  })
  const login2Json = await login2Res.json()
  console.log(`   HTTP ${login2Res.status}`)
  console.log(`   success: ${login2Json.success}`)
  console.log(`   codigo: ${login2Json.codigo || 'N/A'}`)

  if (!login2Json.success) {
    console.error('❌ El login con la nueva clave falló:', login2Json.error)
    process.exit(1)
  }
  console.log('✅ Login con la nueva clave OK\n')

  // === 7. Login con la clave temporal vieja (debe fallar) ===
  console.log('[7] Login con la clave temporal vieja (debe fallar)...')
  const login3Res = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cedula: CEDULA_TEST,
      clave: claveTemporal,
    }),
  })
  const login3Json = await login3Res.json()
  console.log(`   HTTP ${login3Res.status}`)
  console.log(`   success: ${login3Json.success}`)
  console.log(`   codigo: ${login3Json.codigo}`)

  if (login3Json.success) {
    console.error('❌ El login con la clave temporal vieja debería fallar pero tuvo éxito')
    process.exit(1)
  }
  console.log('✅ Login con la clave vieja correctamente rechazado\n')

  // === 8. Intentar reutilizar el claveTempToken (debe fallar) ===
  console.log('[8] Intentar reutilizar el claveTempToken (debe fallar)...')
  const cambio2Res = await fetch(`${BASE}/api/portal/cambiar-clave-primer-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claveTempToken,
      nuevaClave: 'OtraClave456!',
      confirmarClave: 'OtraClave456!',
    }),
  })
  const cambio2Json = await cambio2Res.json()
  console.log(`   HTTP ${cambio2Res.status}`)
  console.log(`   success: ${cambio2Json.success}`)
  console.log(`   error: ${cambio2Json.error}`)
  if (cambio2Json.success) {
    console.error('❌ El claveTempToken debería ser de un solo uso pero se pudo reutilizar')
    process.exit(1)
  }
  console.log('✅ Token temporal correctamente invalidado\n')

  // === 9. Limpieza: desactivar el cliente de prueba ===
  console.log('[9] Limpieza: desactivando el cliente de prueba...')
  const cleanupRes = await fetch(`${BASE}/api/clientes/${clienteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activo: false }),
  })
  const cleanupJson = await cleanupRes.json()
  if (cleanupJson.success) {
    console.log('✅ Cliente de prueba desactivado')
  } else {
    console.warn('⚠️  No se pudo desactivar el cliente de prueba:', cleanupJson.error)
  }

  console.log('\n=== ✅ TODAS LAS PRUEBAS PASARON ===')
  console.log('\nResumen del flujo v4.13:')
  console.log('  1. Admin crea cliente → clave temporal generada automáticamente')
  console.log('  2. Si el cliente tiene email → la clave se envía por correo')
  console.log('  3. Si no tiene email → la clave se devuelve al admin para comunicarla')
  console.log('  4. Cliente ingresa con cédula + clave temporal')
  console.log('  5. Backend detecta debeCambiarClave=true → devuelve CAMBIO_CLAVE_OBLIGATORIO')
  console.log('  6. Cliente define nueva clave (token temporal de un solo uso)')
  console.log('  7. Sistema apaga debeCambiarClave y entrega sesión completa')
  console.log('  8. Login siguiente con la nueva clave funciona normalmente')
  console.log('  9. La clave temporal vieja ya no funciona')
}

main().catch((e) => {
  console.error('Error inesperado:', e)
  process.exit(1)
})
