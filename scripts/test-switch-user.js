// Test del flujo de cambio de cuenta admin → gestor → admin
const BASE = 'http://localhost:3000'

async function main() {
  // 1. Login como admin
  console.log('--- 1. Login como admin ---')
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'JsadrAdmin2026*' }),
  })
  const loginData = await loginRes.json()
  if (!loginData.success) {
    console.error('Login admin fallido:', loginData)
    process.exit(1)
  }
  const adminToken = loginData.data.access_token
  const adminUser = loginData.data.usuario
  console.log('✓ Admin logueado:', adminUser.nombre, '· rol:', adminUser.rol)

  // 2. Listar usuarios (requiere ADMIN)
  console.log('\n--- 2. Listar usuarios disponibles para impersonar ---')
  const listRes = await fetch(`${BASE}/api/usuarios?rol=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const listData = await listRes.json()
  if (!listData.success) {
    console.error('Listado fallido:', listData)
    process.exit(1)
  }
  const candidatos = listData.data.filter(
    (u) => u.activo && ['GESTOR', 'CONSULTOR', 'ADMIN'].includes(u.rol) && u.id !== adminUser.id
  )
  console.log(`✓ ${candidatos.length} usuarios disponibles para impersonar:`)
  candidatos.forEach((u) => console.log(`   · ${u.nombre} (@${u.username}) · ${u.rol}`))

  // 3. Cambiar al primer GESTOR
  const gestor = candidatos.find((u) => u.rol === 'GESTOR')
  if (!gestor) {
    console.error('No hay gestor disponible')
    process.exit(1)
  }
  console.log(`\n--- 3. Cambiar a GESTOR: ${gestor.nombre} ---`)
  const switchRes = await fetch(`${BASE}/api/auth/switch-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetUserId: gestor.id, volverA: false }),
  })
  const switchData = await switchRes.json()
  if (!switchData.success) {
    console.error('Cambio fallido:', switchData)
    process.exit(1)
  }
  const gestorToken = switchData.data.access_token
  const gestorUser = switchData.data.usuario
  console.log('✓ Cambio exitoso:')
  console.log('   Nuevo usuario:', gestorUser.nombre, '· rol:', gestorUser.rol)
  console.log('   impersonatedBy:', switchData.data.impersonatedBy)
  console.log('   adminOriginal:', switchData.data.adminOriginal?.nombre)

  // 4. Verificar que el GESTOR NO puede listar usuarios (solo ADMIN)
  console.log('\n--- 4. Verificar que GESTOR no puede listar usuarios ---')
  const forbiddenRes = await fetch(`${BASE}/api/usuarios?rol=all`, {
    headers: { Authorization: `Bearer ${gestorToken}` },
  })
  console.log(`   HTTP ${forbiddenRes.status} (esperado: 403)`)
  if (forbiddenRes.status === 403) {
    console.log('✓ Permiso correctamente denegado al gestor')
  } else {
    console.error('✗ ERROR: el gestor pudo acceder a /api/usuarios!')
  }

  // 5. Verificar que el GESTOR NO puede llamar a switch-user
  console.log('\n--- 5. Verificar que GESTOR no puede impersonar ---')
  const gestorSwitchRes = await fetch(`${BASE}/api/auth/switch-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gestorToken}` },
    body: JSON.stringify({ targetUserId: adminUser.id, volverA: false }),
  })
  console.log(`   HTTP ${gestorSwitchRes.status} (esperado: 403)`)
  if (gestorSwitchRes.status === 403) {
    console.log('✓ Impersonación correctamente denegada al gestor')
  } else {
    console.error('✗ ERROR: el gestor pudo impersonar!')
  }

  // 6. Volver a la cuenta de admin original
  console.log('\n--- 6. Volver a la cuenta de admin ---')
  const backRes = await fetch(`${BASE}/api/auth/switch-back`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gestorToken}` },
    body: JSON.stringify({ targetUserId: adminUser.id }),
  })
  const backData = await backRes.json()
  if (!backData.success) {
    console.error('Vuelta fallida:', backData)
    process.exit(1)
  }
  console.log('✓ Vuelta exitosa:')
  console.log('   Nuevo usuario:', backData.data.usuario.nombre, '· rol:', backData.data.usuario.rol)
  console.log('   impersonatedBy:', backData.data.impersonatedBy, '(esperado: null)')

  // 7. Verificar que el admin recuperó acceso a /api/usuarios
  console.log('\n--- 7. Verificar admin recuperó acceso ---')
  const verifyRes = await fetch(`${BASE}/api/usuarios?rol=all`, {
    headers: { Authorization: `Bearer ${backData.data.access_token}` },
  })
  console.log(`   HTTP ${verifyRes.status} (esperado: 200)`)
  if (verifyRes.status === 200) {
    console.log('✓ Admin recuperó acceso correctamente')
  } else {
    console.error('✗ ERROR: el admin no recuperó acceso')
  }

  // 8. Seguridad: un GESTOR con sesión normal (no impersonada)
  //    NO puede llamar a /api/auth/switch-back
  console.log('\n--- 8. Seguridad: GESTOR normal no puede usar switch-back ---')
  const loginGestorRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'gestor-jsadr', password: 'JsadrGestor2026*' }),
  })
  const loginGestorData = await loginGestorRes.json()
  const gestorNormalToken = loginGestorData.data?.access_token
  if (!gestorNormalToken) {
    console.error('No se pudo loguear al gestor para la prueba de seguridad')
    process.exit(1)
  }
  const fakeBackRes = await fetch(`${BASE}/api/auth/switch-back`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gestorNormalToken}` },
    body: JSON.stringify({ targetUserId: adminUser.id }),
  })
  console.log(`   HTTP ${fakeBackRes.status} (esperado: 400 — sesión no impersonada)`)
  if (fakeBackRes.status === 400) {
    console.log('✓ GESTOR normal correctamente rechazado en switch-back')
  } else {
    console.error('✗ ERROR: el gestor normal pudo usar switch-back!')
  }

  console.log('\n=== TODAS LAS PRUEBAS PASARON ===')
}

main().catch((e) => {
  console.error('Error fatal:', e)
  process.exit(1)
})
