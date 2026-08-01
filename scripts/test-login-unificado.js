// Test de login unificado: verifica que el sistema detecta
// automáticamente el rol de cada usuario (ADMIN, GESTOR, CONSULTOR)
// desde un único punto de acceso.

const BASE = 'http://localhost:3000'

const USUARIOS = [
  { username: 'adm-jsadr', password: process.env.ADMIN_PASS || 'CHANGE_ME', esperado: 'ADMIN' },
  { username: 'gestor-jsadr', password: process.env.GESTOR_PASS || 'CHANGE_ME', esperado: 'GESTOR' },
  { username: 'consultor-jsadr', password: process.env.CONSULTOR_PASS || 'CHANGE_ME', esperado: 'CONSULTOR' },
]

async function testearLogin({ username, password, esperado }) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await r.json()
  const rolDetectado = data?.data?.usuario?.rol
  const ok = data.success && rolDetectado === esperado
  return {
    username,
    esperado,
    detectado: rolDetectado || '—',
    status: r.status,
    ok,
    nombre: data?.data?.usuario?.nombre,
  }
}

;(async () => {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Test: Login Unificado — detección automática de rol')
  console.log('═══════════════════════════════════════════════════\n')

  let todosOk = true
  for (const u of USUARIOS) {
    const r = await testearLogin(u)
    const icon = r.ok ? '✓' : '✗'
    console.log(`${icon} ${r.username.padEnd(20)} → detectado: ${r.detectado.padEnd(10)} (esperado: ${r.esperado.padEnd(10)}) · ${r.nombre}`)
    if (!r.ok) todosOk = false
  }

  console.log('\n───────────────────────────────────────────────────')
  console.log(todosOk ? '✓ TODOS LOS PERFILES FUNCIONAN CORRECTAMENTE' : '✗ ALGÚN PERFIL FALLÓ')
  console.log('───────────────────────────────────────────────────')
  process.exit(todosOk ? 0 : 1)
})().catch((e) => {
  console.error('Error en test:', e)
  process.exit(1)
})
