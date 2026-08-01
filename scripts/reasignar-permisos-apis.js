// =====================================================
// REASIGNACIÓN DE PERMISOS POR ROL — JSADR Aurora Bancaria
// -----------------------------------------------------
// Aplica la matriz de permisos correcta a todas las APIs internas:
//
//   ADMIN-ONLY (solo admin):
//     /api/usuarios, /api/seguridad/*, /api/conexiones, /api/configuracion*,
//     /api/backups, /api/snapshots, /api/versiones, /api/automatizaciones,
//     /api/admin/*, /api/codigo-fuente, /api/audit-logs, /api/auditoria-seguridad,
//     /api/seguridad/*, /api/configuracion-global
//
//   ADMIN + GESTOR (operacional con escritura):
//     /api/clientes POST/PATCH/DELETE, /api/prestamos POST/PATCH,
//     /api/pagos POST/PATCH/DELETE, /api/juridico POST/PATCH,
//     /api/cajas POST, /api/campanas POST, /api/creditos-bancarios POST/PATCH/DELETE,
//     /api/documentos POST/DELETE, /api/categorias POST, /api/cuentas POST,
//     /api/planes-* POST/PATCH/DELETE, /api/notificaciones POST,
//     /api/automatizaciones/ejecutar (no — admin only)
//
//   ADMIN + GESTOR + CONSULTOR (lectura operacional):
//     /api/dashboard, /api/clientes GET, /api/prestamos GET, /api/pagos GET,
//     /api/juridico GET, /api/cajas GET, /api/campanas GET, /api/proyecciones,
//     /api/refinanciaciones GET, /api/categorias GET, /api/cuentas GET,
//     /api/solicitudes-nuevos-clientes GET, /api/documentos GET,
//     /api/chat/*, /api/bots/*, /api/reportes, /api/pagos/export, /api/pagos/informe,
//     /api/planes-financieros GET, /api/planes-clientes GET,
//     /api/solicitudes-web GET, /api/pagos/recibo, /api/pagos/proximos,
//     /api/pagos/prediccion-mora, /api/prestamos/[id]/pagos-export,
//     /api/juridico/[id] GET, /api/juridico/[id]/cronologia, /api/juridico/[id]/documentos,
//     /api/juridico/[id]/alertas, /api/juridico/[id]/exportar
//
// Nota: Las APIs /api/portal/* (cliente) y /api/juridico/portal/* (abogado)
// NO se tocan — usan sus propios sistemas de token.
// =====================================================

const fs = require('fs')
const path = require('path')

const API_DIR = '/home/z/my-project/src/app/api'

// === MATRIZ DE PERMISOS POR RUTA ===
// Cada entrada: { roles: [...], methods: ['GET','POST','PATCH','PUT','DELETE'] | 'all' }
// Si una ruta no está aquí, no se modifica.
const PERMISOS_POR_RUTA = [
  // === SOLO ADMIN ===
  { ruta: '/api/usuarios', roles: ['ADMIN'], methods: 'all' },
  { ruta: '/api/seguridad', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/conexiones', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/configuracion', roles: ['ADMIN'], methods: 'all' },
  { ruta: '/api/configuracion-global', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/backups', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/snapshots', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/versiones', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/automatizaciones', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/admin', roles: ['ADMIN'], methods: 'all', recursive: true },
  { ruta: '/api/codigo-fuente', roles: ['ADMIN'], methods: 'all' },
  { ruta: '/api/audit-logs', roles: ['ADMIN'], methods: 'all' },
  { ruta: '/api/auditoria-seguridad', roles: ['ADMIN'], methods: 'all' },
  { ruta: '/api/bitacora', roles: ['ADMIN'], methods: 'all' },
  // /api/email es transversal: solo ADMIN (para evitar spam/abuso)
  { ruta: '/api/email', roles: ['ADMIN'], methods: 'all' },

  // === ADMIN + GESTOR (escritura operacional) — métodos de escritura ===
  // Para estas rutas, GET queda con [ADMIN, GESTOR, CONSULTOR] (definido abajo)
  // y POST/PATCH/PUT/DELETE con [ADMIN, GESTOR].
  { ruta: '/api/clientes', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/prestamos', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  // /api/pagos: POST requiere ADMIN+GESTOR; DELETE (reversar) solo ADMIN
  { ruta: '/api/pagos', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT'], recursive: true },
  { ruta: '/api/pagos', roles: ['ADMIN'], methods: ['DELETE'], recursive: true },
  { ruta: '/api/juridico', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/casos-juridicos', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/cajas', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/campanas', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/creditos-bancarios', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/documentos', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/categorias', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/cuentas', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/planes-financieros', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/planes-clientes', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/notificaciones', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/solicitudes-nuevos-clientes', roles: ['ADMIN', 'GESTOR'], methods: ['POST', 'PATCH', 'PUT', 'DELETE'], recursive: true },
  { ruta: '/api/solicitudes-web', roles: ['ADMIN', 'GESTOR'], methods: ['PATCH', 'PUT', 'DELETE'], recursive: true },
  // /api/prestamos/limpiar-todos es destructivo — solo ADMIN
  { ruta: '/api/prestamos/limpiar-todos', roles: ['ADMIN'], methods: 'all' },
  // /api/pagos/boton-pago y bancolombia-checkout pueden ser usados por gestor o por portal
  { ruta: '/api/pagos/boton-pago', roles: ['ADMIN', 'GESTOR'], methods: 'all' },
  { ruta: '/api/pagos/aplicar', roles: ['ADMIN', 'GESTOR'], methods: 'all' },
  { ruta: '/api/pagos/conciliacion', roles: ['ADMIN', 'GESTOR'], methods: 'all' },
  { ruta: '/api/pagos/renegociar-mora', roles: ['ADMIN', 'GESTOR'], methods: 'all' },
  { ruta: '/api/pagos/recibo', roles: ['ADMIN', 'GESTOR'], methods: 'all', recursive: true },
  { ruta: '/api/pagos/batch', roles: ['ADMIN', 'GESTOR'], methods: 'all' },
  // /api/pagos/bancolombia-checkout tiene lógica dual (portal + gestor) — lo dejamos con requireAuth pero cambiamos a ADMIN+GESTOR para la rama no-portal
  // No lo tocamos aquí porque ya tiene su propia lógica.

  // === ADMIN + GESTOR + CONSULTOR (lectura operacional) ===
  { ruta: '/api/dashboard', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'] },
  { ruta: '/api/clientes', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/prestamos', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/pagos', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/juridico', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  // Excluir /api/juridico/portal/* (es portal aparte)
  { ruta: '/api/casos-juridicos', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/cajas', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/campanas', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/proyecciones', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all' },
  { ruta: '/api/refinanciaciones', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all' },
  { ruta: '/api/categorias', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/cuentas', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/solicitudes-nuevos-clientes', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/solicitudes-web', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/documentos', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/chat', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all', recursive: true },
  { ruta: '/api/bots', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all', recursive: true },
  { ruta: '/api/reportes', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all', recursive: true },
  { ruta: '/api/creditos-bancarios', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/planes-financieros', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/planes-clientes', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: ['GET'], recursive: true },
  { ruta: '/api/ficha-tecnica', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all' },
  { ruta: '/api/manual', roles: ['ADMIN', 'GESTOR', 'CONSULTOR'], methods: 'all' },
  // /api/estado-cuenta y /api/paz-y-salvo tienen lógica dual (portal + staff)
  // No las tocamos aquí porque ya validan portal token por separado.
  // Pero la rama staff debe ser explícita — la manejamos aparte.

  // /api/firma es para firma electrónica — admin+gestor
  { ruta: '/api/firma', roles: ['ADMIN', 'GESTOR'], methods: 'all', recursive: true },
]

// === RUTAS EXCLUIDAS (no tocar) ===
// Son portales con su propio sistema de autenticación
const RUTAS_EXCLUIDAS = [
  '/api/portal',      // portal cliente — usa x-portal-token
  '/api/juridico/portal',  // portal abogado — usa token propio
  '/api/auth',        // login, refresh, MFA — no requiere auth
  '/api/simulador',   // simulador público
  '/api/paz-y-salvo', // tiene lógica dual
  '/api/estado-cuenta', // tiene lógica dual
  '/api/pagos/bancolombia-checkout', // tiene lógica dual
  '/api/pagos/bancolombia-redirect', // redirect de Bancolombia
  '/api/pagos/bancolombia-webhook', // webhook de Bancolombia (sin auth)
  '/api/pagos/cron', // cron job (sin auth, llamado por scheduler)
  '/api/seguridad/plataformas-sync/webhook', // webhook
  '/api/portal', // portal cliente
]

// === HELPERS ===

function rutaRelativa(filePath) {
  // /home/z/my-project/src/app/api/usuarios/route.ts → /api/usuarios
  const rel = path.relative(API_DIR, filePath)
  // usuarios/route.ts → usuarios
  // usuarios/[id]/route.ts → usuarios/[id]
  const parts = rel.split(path.sep)
  // quitar 'route.ts' o 'route.js' al final
  if (parts[parts.length - 1].startsWith('route.')) {
    parts.pop()
  }
  return '/api/' + parts.join('/')
}

function rutaAplica(rutaArchivo, rutaRegla, recursive) {
  if (recursive) {
    // /api/seguridad/* aplica a /api/seguridad, /api/seguridad/credenciales, /api/seguridad/credenciales/[id], etc.
    return rutaArchivo === rutaRegla || rutaArchivo.startsWith(rutaRegla + '/')
  }
  // No recursivo: solo la ruta exacta
  return rutaArchivo === rutaRegla
}

function estaExcluida(rutaArchivo) {
  return RUTAS_EXCLUIDAS.some(ex => rutaArchivo === ex || rutaArchivo.startsWith(ex + '/'))
}

function encontrarRegla(rutaArchivo, method) {
  // Buscar la regla más específica que aplique
  let mejorRegla = null
  let mejorEspecificidad = -1

  for (const regla of PERMISOS_POR_RUTA) {
    if (!rutaAplica(rutaArchivo, regla.ruta, regla.recursive)) continue
    if (regla.methods !== 'all' && !regla.methods.includes(method)) continue

    // Especificidad: longitud de la ruta + si es recursiva
    const especificidad = regla.ruta.length + (regla.recursive ? 0.5 : 0)
    if (especificidad > mejorEspecificidad) {
      mejorEspecificidad = especificidad
      mejorRegla = regla
    }
  }
  return mejorRegla
}

function extraerMethodsDelArchivo(content) {
  // Buscar exports: export async function GET, POST, PATCH, PUT, DELETE
  const methods = []
  const regex = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g
  let m
  while ((m = regex.exec(content)) !== null) {
    methods.push(m[1])
  }
  return methods
}

function reemplazarRequireRole(content, method, rolesNuevos) {
  // Patrones a reemplazar:
  // requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
  // requireRole(req, ['ADMIN', 'GESTOR'])
  // requireRole(req, ['ADMIN'])
  // requireAuth(req)
  //
  // Estrategia: para cada función exportada, buscar la primera llamada a
  // requireRole o requireAuth dentro de esa función y reemplazarla.

  const rolesStr = JSON.stringify(rolesNuevos).replace(/"/g, "'")
  // `'${rolesNuevos.join("', '")}'`
  const rolesStrFormatted = "['" + rolesNuevos.join("', '") + "']"

  // Buscar el bloque de la función del método
  // export async function GET(req: NextRequest) { ... }
  const regex = new RegExp(
    `(export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?)(requireRole\\(req,\\s*\\[[^\\]]*\\]\\)|requireAuth\\(req\\))`,
    'm'
  )
  const match = content.match(regex)
  if (!match) return { content, changed: false }

  const antes = match[1]
  const call = match[2]
  const nuevoCall = `requireRole(req, ${rolesStrFormatted})`
  if (call === nuevoCall) return { content, changed: false }

  const nuevoContent = content.replace(match[0], antes + nuevoCall)
  return { content: nuevoContent, changed: true }
}

// === FUNCIÓN PRINCIPAL ===

function procesarArchivo(filePath) {
  const ruta = rutaRelativa(filePath)
  if (estaExcluida(ruta)) {
    return { ruta, saltada: true, razon: 'excluida' }
  }

  let content = fs.readFileSync(filePath, 'utf8')
  const originalContent = content
  const methods = extraerMethodsDelArchivo(content)
  const cambios = []

  for (const method of methods) {
    const regla = encontrarRegla(ruta, method)
    if (!regla) {
      cambios.push({ method, accion: 'sin-regla', roles: null })
      continue
    }
    const result = reemplazarRequireRole(content, method, regla.roles)
    if (result.changed) {
      content = result.content
      cambios.push({ method, accion: 'actualizado', roles: regla.roles })
    } else {
      cambios.push({ method, accion: 'sin-cambio', roles: regla.roles })
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8')
    return { ruta, saltada: false, cambios, modificado: true }
  }
  return { ruta, saltada: false, cambios, modificado: false }
}

function listarRouteFiles(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      results.push(...listarRouteFiles(full))
    } else if (e.name.startsWith('route.')) {
      results.push(full)
    }
  }
  return results
}

// === EJECUCIÓN ===

console.log('=== REASIGNACIÓN DE PERMISOS POR ROL ===\n')

const files = listarRouteFiles(API_DIR)
console.log(`Total de route.ts encontrados: ${files.length}\n`)

const resultados = files.map(procesarArchivo)

let modificados = 0
let sinCambio = 0
let excluidos = 0
let sinRegla = 0

for (const r of resultados) {
  if (r.saltada) {
    excluidos++
    continue
  }
  if (r.modificado) {
    modificados++
    console.log(`✅ ${r.ruta}`)
    for (const c of r.cambios) {
      if (c.accion === 'actualizado') {
        console.log(`   ${c.method}: → [${c.roles.join(', ')}]`)
      }
    }
  } else {
    let allSinRegla = r.cambios.every(c => c.accion === 'sin-regla')
    if (allSinRegla) {
      sinRegla++
      // No imprimir nada para no llenar la consola
    } else {
      sinCambio++
    }
  }
}

console.log(`\n=== RESUMEN ===`)
console.log(`Archivos modificados: ${modificados}`)
console.log(`Archivos sin cambio: ${sinCambio}`)
console.log(`Archivos sin regla (no tocados): ${sinRegla}`)
console.log(`Archivos excluidos (portales/auth): ${excluidos}`)
