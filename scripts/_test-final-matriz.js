// Test final: matriz de permisos completa
const BASE = 'http://localhost:3000'

async function tryLogin(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  return await r.json()
}

async function testEndpoint(token, url, expectedStatus, label) {
  const r = await fetch(`${BASE}${url}`, { headers: { 'Authorization': `Bearer ${token}` } })
  const ok = r.status === expectedStatus
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${r.status} (esperado ${expectedStatus})`)
  return ok
}

async function main() {
  console.log('=== MATRIZ DE PERMISOS FINAL ===\n')

  const admin = await tryLogin('adm-jsadr', 'JsadrAdmin2026*')
  const gestor = await tryLogin('gestor-jsadr', 'JsadrGestor2026*')
  const consultor = await tryLogin('consultor-jsadr', 'JsadrConsultor2026*')

  if (!admin.success || !gestor.success || !consultor.success) {
    console.log('❌ Login falló')
    return
  }

  const tokens = {
    ADMIN: admin.data.access_token,
    GESTOR: gestor.data.access_token,
    CONSULTOR: consultor.data.access_token
  }

  const tests = [
    // [url, {ADMIN, GESTOR, CONSULTOR}]
    ['/api/usuarios', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/conexiones', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/backups', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/snapshots', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/versiones', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/automatizaciones', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/admin', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/seguridad', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/codigo-fuente', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/audit-logs', { ADMIN: 200, GESTOR: 403, CONSULTOR: 403 }],
    ['/api/clientes', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/prestamos', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/pagos', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/juridico', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/cajas', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/dashboard', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/campanas', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/reportes', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/proyecciones', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/documentos', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/categorias', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/cuentas', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/creditos-bancarios', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
    ['/api/solicitudes-web', { ADMIN: 200, GESTOR: 200, CONSULTOR: 200 }],
  ]

  let allOk = true
  for (const [url, expected] of tests) {
    console.log(`\n▶ ${url}`)
    for (const rol of ['ADMIN', 'GESTOR', 'CONSULTOR']) {
      const ok = await testEndpoint(tokens[rol], url, expected[rol], rol)
      if (!ok) allOk = false
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(allOk ? '🎉 TODOS LOS TESTS PASAN' : '❌ HAY TESTS FALLANDO')
  console.log('='.repeat(50))
}

main().catch(console.error)
