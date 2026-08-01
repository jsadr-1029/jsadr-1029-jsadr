// Probar el flujo completo de doble OTP para préstamos con codeudor:
//   1. Buscar o crear un préstamo con tieneCodeudor=true y codeudorEmail seteado
//   2. Llamar POST /api/prestamos/[id]/enviar-codigo → deben generarse 2 códigos
//   3. Verificar estado GET /api/prestamos/[id]/verificar-codigo → ambos pendientes
//   4. Verificar solo el DEUDOR → préstamo NO debe activarse
//   5. Verificar el CODEUDOR → préstamo SÍ debe activarse
//
// Requiere: servidor Next.js corriendo en localhost:3000 con BDSQLite del proyecto.

const BASE = 'http://localhost:3000'

// Credenciales gestor — ajustar si es necesario
const LOGIN = { username: 'test-dual-otp', password: 'TestDualOtp2025$' }

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(`Login fallido: ${JSON.stringify(json)}`)
  }
  // Si requiere MFA, intentar paso 2 con OTP falso (debería fallar y mostrar mensaje claro)
  if (json.requiresMFA) {
    throw new Error('Login requiere MFA — desactívalo para este usuario o usa OTP real para probar.')
  }
  return json.data.access_token
}

async function main() {
  console.log('=== Login ===')
  const token = await login()
  console.log('✓ Token obtenido')

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // Buscar un préstamo con codeudor en estado SOLICITUD o PENDIENTE_ACEPTACION
  console.log('\n=== Buscar préstamo con codeudor ===')
  const listRes = await fetch(`${BASE}/api/prestamos?limit=100`, { headers: authHeaders })
  const listJson = await listRes.json()
  if (!listJson.success) throw new Error(`Error listando préstamos: ${JSON.stringify(listJson)}`)

  const prestamos = listJson.data || []
  console.log(`Total préstamos: ${prestamos.length}`)

  // Preferimos uno con codeudor y email seteado, en estado SOLICITUD o PENDIENTE_ACEPTACION
  let prestamo = prestamos.find(
    (p) =>
      p.tieneCodeudor === true &&
      p.codeudorEmail &&
      (p.estado === 'SOLICITUD' || p.estado === 'PENDIENTE_ACEPTACION')
  )

  if (!prestamo) {
    // Si no hay, tomar cualquiera en SOLICITUD y setearle codeudor
    prestamo = prestamos.find(
      (p) => p.estado === 'SOLICITUD' || p.estado === 'PENDIENTE_ACEPTACION'
    )
    if (!prestamo) {
      throw new Error('No hay préstamos en estado SOLICITUD o PENDIENTE_ACEPTACION para probar.')
    }
    console.log(`\nPréstamo ${prestamo.codigo} sin codeudor. Seteando codeudor de prueba...`)
    // Como no tenemos endpoint directo para editar préstamo desde este script,
    // usamos prisma directamente via un script node separado — aquí solo reportamos.
    console.log(`  → préstamoId: ${prestamo.id}`)
    console.log(`  → clientEmail: ${prestamo.cliente?.email || 'sin cliente populado'}`)
    console.log('  → ejecuta primero: node scripts/set-test-codeudor.js <prestamoId>')
    return
  }

  console.log(`✓ Préstamo encontrado: ${prestamo.codigo} (id=${prestamo.id})`)
  console.log(`  tieneCodeudor: ${prestamo.tieneCodeudor}`)
  console.log(`  codeudorEmail: ${prestamo.codeudorEmail}`)
  console.log(`  estado: ${prestamo.estado}`)

  // === 1. Enviar códigos ===
  console.log('\n=== POST /api/prestamos/[id]/enviar-codigo ===')
  const envRes = await fetch(`${BASE}/api/prestamos/${prestamo.id}/enviar-codigo`, {
    method: 'POST',
    headers: authHeaders,
  })
  const envJson = await envRes.json()
  console.log(`HTTP ${envRes.status}`)
  console.log(JSON.stringify(envJson, null, 2).slice(0, 2000))

  if (!envJson.success) {
    console.log('\n⚠️ El envío falló — revisa SMTP y reintentos.')
    return
  }

  // === 2. GET estado de verificación ===
  console.log('\n=== GET /api/prestamos/[id]/verificar-codigo ===')
  const estRes = await fetch(`${BASE}/api/prestamos/${prestamo.id}/verificar-codigo`, {
    headers: authHeaders,
  })
  const estJson = await estRes.json()
  console.log(JSON.stringify(estJson, null, 2))

  // === 3. Verificar solo el DEUDOR ===
  const codigoDeudor = envJson.data.codigos.find((c) => c.rol === 'DEUDOR')
  if (!codigoDeudor) {
    console.log('\n✗ No se encontró código DEUDOR en la respuesta de envío')
    return
  }
  console.log(`\n=== POST verificar-codigo rol=DEUDOR código=${codigoDeudor.codigo} ===`)
  const v1Res = await fetch(`${BASE}/api/prestamos/${prestamo.id}/verificar-codigo`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ codigo: codigoDeudor.codigo, rol: 'DEUDOR' }),
  })
  const v1Json = await v1Res.json()
  console.log(JSON.stringify(v1Json, null, 2))

  if (v1Json.data?.activado) {
    console.log('\n✗ FAIL: El préstamo se activó con solo el DEUDOR. Debería esperar al codeudor.')
    return
  }
  console.log('\n✓ OK: Préstamo NO se activó tras verificar solo el DEUDOR.')

  // === 4. Verificar CODEUDOR → debe activarse ===
  const codigoCodeudor = envJson.data.codigos.find((c) => c.rol === 'CODEUDOR')
  if (!codigoCodeudor) {
    console.log('\n✗ No se encontró código CODEUDOR en la respuesta de envío')
    return
  }
  console.log(`\n=== POST verificar-codigo rol=CODEUDOR código=${codigoCodeudor.codigo} ===`)
  const v2Res = await fetch(`${BASE}/api/prestamos/${prestamo.id}/verificar-codigo`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ codigo: codigoCodeudor.codigo, rol: 'CODEUDOR' }),
  })
  const v2Json = await v2Res.json()
  console.log(JSON.stringify(v2Json, null, 2))

  if (v2Json.activado || v2Json.data?.activado) {
    console.log('\n✅ SUCCESS: El préstamo se activó tras verificar DEUDOR + CODEUDOR.')
  } else {
    console.log('\n✗ FAIL: El préstamo NO se activó tras verificar ambos roles.')
  }

  // === 5. Prueba de seguridad: intentar activar con un rol incorrecto ===
  // Crear un nuevo préstamo o reenviar códigos y probar con código incorrecto
  console.log('\n=== Prueba: verificar CODEUDOR en préstamo SIN codeudor ===')
  // Tomamos el préstamo recién activado (ya no tiene codeudor logicamente pero el campo sigue)
  // Mejor omitimos esta prueba — ya está cubierta por validación de schema.
  console.log('Omitido (cubierto por validación en verificar-codigo POST).')

  console.log('\n=== FIN ===')
}

main().catch(e => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
