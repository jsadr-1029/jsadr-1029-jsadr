// =====================================================
// verify-portal-fixes.js
// =====================================================
// Verificación de los 4 fixes aplicados al portal del cliente:
//
// 1. /api/solicitudes-web DEBE estar en isPublicEndpoint() del proxy
// 2. Flexibilidad Financiera DEBE aparecer en SimuladorCredito de PortalClienteModal
// 3. Sesión del portal DEBE ser 8h (no 2h) en /api/portal/login y /api/portal/auth
// 4. PortalClienteModal DEBE tener navegarA(), volverAtras(), popstate handler,
//    y bloqueo de cierre accidental (Escape, clic fuera)
//
// Uso: node scripts/verify-portal-fixes.js
// =====================================================

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`✅ ${label}`)
    passed++
  } else {
    console.log(`❌ ${label}`)
    if (detail) console.log(`   ${detail}`)
    failed++
  }
}

console.log('\n=== Fix #1: Proxy permite /api/solicitudes-web ===\n')
const proxy = readFile('src/proxy.ts')
check(
  "isPublicEndpoint() incluye '/api/solicitudes-web'",
  proxy.includes("pathname === '/api/solicitudes-web'") ||
    proxy.includes("pathname.startsWith('/api/solicitudes-web')"),
  'Falta agregar la ruta a la lista de endpoints públicos en src/proxy.ts'
)
check(
  "isPublicEndpoint() incluye '/api/solicitudes-web/' (sub-rutas)",
  proxy.includes("pathname.startsWith('/api/solicitudes-web/')"),
  'Falta agregar el prefijo para sub-rutas (cliente/[cedula])'
)

console.log('\n=== Fix #2: Flexibilidad Financiera en SimuladorCredito ===\n')
const portalModal = readFile('src/components/views/PortalClienteModal.tsx')
check(
  "SimuladorCredito tiene estado 'flexibilidadFinanciera'",
  portalModal.includes('flexibilidadFinanciera, setFlexibilidadFinanciera') ||
    portalModal.includes('useState(false)\n  const FLEXIBILIDAD_COSTO'),
  'Falta agregar el estado flexibilidadFinanciera en SimuladorCredito'
)
check(
  "SimuladorCredito muestra el bloque de Flexibilidad Financiera en el resultado",
  portalModal.includes('Flexibilidad Financiera (visible para TODOS los clientes)'),
  'Falta agregar la UI del bloque Flexibilidad Financiera'
)
check(
  "El checkbox está deshabilitado cuando cuotas < 4",
  portalModal.includes('disabled={!elegible}') || portalModal.includes('disabled={!elegible}'),
  'El checkbox debe inhabilitarse cuando hay menos de 4 cuotas'
)

console.log('\n=== Fix #3: Sesión extendida a 8h + keep-alive ===\n')
const portalLogin = readFile('src/app/api/portal/login/route.ts')
const portalAuth = readFile('src/app/api/portal/auth/route.ts')
const portalCedula = readFile('src/app/api/portal/[cedula]/route.ts')

check(
  '/api/portal/login usa 8h para tokenExpira',
  portalLogin.includes("8 * 60 * 60 * 1000"),
  'Falta actualizar el timeout de 2h a 8h en /api/portal/login/route.ts'
)
check(
  '/api/portal/auth SESSION_EXPIRY_HOURS = 8',
  portalAuth.includes('SESSION_EXPIRY_HOURS = 8'),
  'Falta actualizar SESSION_EXPIRY_HOURS de 2 a 8 en /api/portal/auth/route.ts'
)
check(
  '/api/portal/[cedula] tiene keep-alive que renueva tokenExpira',
  portalCedula.includes('KEEP-ALIVE') && portalCedula.includes('8 * 60 * 60 * 1000'),
  'Falta agregar el keep-alive en /api/portal/[cedula]/route.ts'
)

console.log('\n=== Fix #4: Botón Atrás real + popstate ===\n')
check(
  "PortalClienteModal define navegarA()",
  portalModal.includes('const navegarA ='),
  'Falta implementar navegarA() en PortalClienteModal'
)
check(
  "PortalClienteModal define volverAtras()",
  portalModal.includes('const volverAtras ='),
  'Falta implementar volverAtras() en PortalClienteModal'
)
check(
  "PortalClienteModal tiene handler popstate",
  portalModal.includes("window.addEventListener('popstate'"),
  'Falta agregar el handler popstate para interceptar botón atrás del navegador'
)
check(
  "PortalClienteModal bloquea cierre accidental (Escape + clic fuera)",
  portalModal.includes('onEscapeKeyDown') && portalModal.includes('onPointerDownOutside'),
  'Falta bloquear cierre accidental del modal'
)
check(
  "Botón 'Atrás' usa volverAtras en lugar de setVista('hub')",
  portalModal.includes('onClick={volverAtras}'),
  'El botón Atrás debe llamar a volverAtras() en lugar de setVista("hub")'
)
check(
  "Botón 'Cerrar sesión' pide confirmación antes de cerrar",
  portalModal.includes("¿Seguro que deseas cerrar la sesión?") && portalModal.includes('confirmLogoutRef'),
  'El botón Cerrar sesión debe pedir confirmación'
)
check(
  "Navegación del Hub usa navegarA",
  portalModal.includes('onSelect={(id) => navegarA(id)}'),
  'HubView.onSelect debe llamar a navegarA en lugar de setVista'
)
check(
  "Bottom nav usa navegarA",
  portalModal.includes("onClick={() => navegarA('hub')}") &&
    portalModal.includes("onClick={() => navegarA('avisos')}") &&
    portalModal.includes("onClick={() => navegarA('campanas')}"),
  'Bottom nav debe usar navegarA'
)

console.log('\n=== Resumen ===\n')
console.log(`  ✅ Pasaron: ${passed}`)
console.log(`  ❌ Fallaron: ${failed}`)
console.log(`  Total: ${passed + failed}`)

if (failed > 0) {
  console.log('\n❌ ALGUNAS VERIFICACIONES FALLARON')
  process.exit(1)
} else {
  console.log('\n✅ TODAS LAS VERIFICACIONES PASARON')
  process.exit(0)
}
