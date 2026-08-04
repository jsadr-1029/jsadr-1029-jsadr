// Test de humo del refuerzo de eliminación.
// 1) Sin clave → 403 CLAVE_ELIMINACION_REQUERIDA
// 2) Con clave incorrecta → 403
// 3) Con clave "Eliminar" pero id inexistente → no 403 (puede ser 404/500, pero la clave pasó)

const BASE = 'http://localhost:3000/api/configuracion-global'

async function post(accion: string, payload: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, payload }),
  })
  return { status: res.status, body: await res.json() }
}

async function main() {
  console.log('=== TEST 1: eliminar_correo SIN clave (esperado: 403) ===')
  const t1 = await post('eliminar_correo', { id: 'inexistente' })
  console.log(`Status: ${t1.status}`)
  console.log(`Body: ${JSON.stringify(t1.body, null, 2)}`)
  console.log(t1.status === 403 && t1.body.codigo === 'CLAVE_ELIMINACION_REQUERIDA' ? '✓ PASS\n' : '✗ FAIL\n')

  console.log('=== TEST 2: eliminar_integracion con clave incorrecta (esperado: 403) ===')
  const t2 = await post('eliminar_integracion', { id: 'inexistente', clave: 'eliminar' }) // minúscula, no coincide
  console.log(`Status: ${t2.status}`)
  console.log(`Body: ${JSON.stringify(t2.body, null, 2)}`)
  console.log(t2.status === 403 ? '✓ PASS (rechazado)\n' : '✗ FAIL\n')

  console.log('=== TEST 3: eliminar_variable con clave "Eliminar" y id inexistente ===')
  console.log('Esperado: NO 403 (la clave pasó la verificación). Puede ser 404 o 500 por P2025 de Prisma.')
  const t3 = await post('eliminar_variable', { id: 'nonexistent-id-test', clave: 'Eliminar' })
  console.log(`Status: ${t3.status}`)
  console.log(`Body: ${JSON.stringify(t3.body, null, 2)}`)
  console.log(t3.status !== 403 ? '✓ PASS (la clave fue aceptada)\n' : '✗ FAIL (la clave fue rechazada incorrectamente)\n')

  console.log('=== TEST 4: eliminar_dominio con clave correcta ===')
  console.log('Esperado: NO 403.')
  const t4 = await post('eliminar_dominio', { id: 'nonexistent-id-test', clave: 'Eliminar' })
  console.log(`Status: ${t4.status}`)
  console.log(`Body: ${JSON.stringify(t4.body, null, 2)}`)
  console.log(t4.status !== 403 ? '✓ PASS (la clave fue aceptada)\n' : '✗ FAIL\n')

  console.log('=== RESUMEN ===')
  const allPass =
    t1.status === 403 &&
    t2.status === 403 &&
    t3.status !== 403 &&
    t4.status !== 403
  console.log(allPass ? '✅ TODOS LOS TESTS PASARON' : '❌ ALGÚN TEST FALLÓ')
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
