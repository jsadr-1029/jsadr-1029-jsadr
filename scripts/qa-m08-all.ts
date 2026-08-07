// =====================================================
// QA M08-Portal Jurídico — 10 TCs pendientes
// Jsadr
// =====================================================
// TC-JUR-005: Sesión expira 8h → tokenExpira verificado en cada request
// TC-JUR-006: Logout → HTTP 200, tokenSesion=null
// TC-JUR-007: Listar casos asignados → HTTP 200 con casos del abogado
// TC-JUR-008: Ver detalle de caso → HTTP 200 con detalle completo
// TC-JUR-009: Subir documento legal → HTTP 201, trazabilidad en BD
// TC-JUR-010: Abogado no puede ver caso ajeno → HTTP 403
// TC-JUR-011: Agregar nota interna → HTTP 201, autor=abogado actual
// TC-JUR-012: Ver bitácora del caso → HTTP 200 con movimientos ordenados por fecha
// TC-JUR-013: Rate limit login jurídico (20/min) → HTTP 429 a partir de la 21ava
// TC-JUR-015: Cada acción registrada en AuditLog
// =====================================================

import * as fs from 'fs'
import * as path from 'path'

const ROOT = process.cwd()
let pass = 0
let fail = 0
const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`)
    pass++
  } else {
    console.log(`  ❌ ${msg}`)
    fail++
    failures.push(msg)
  }
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

// =====================================================
// TC-JUR-005: Sesión expira 8h → tokenExpira verificado en cada request
// =====================================================
function TC_JUR_005() {
  console.log('\n=== TC-JUR-005: Sesión expira 8h → tokenExpira verificado en cada request ===')
  const authCode = readFile('src/app/api/juridico/portal/auth/route.ts')

  // Sesión de 8 horas
  assert(
    /SESSION_EXPIRY_HOURS\s*=\s*8/.test(authCode),
    'Sesión con expiración de 8 horas (SESSION_EXPIRY_HOURS = 8)'
  )

  // tokenExpira persistido
  assert(
    /tokenExpira\s*:/.test(authCode),
    'tokenExpira se persiste en BD al hacer login'
  )

  // Helper verificarTokenPortal valida tokenExpira
  assert(
    /tokenExpira\s*<\s*new Date\(\)|tokenExpira\s*>\s*now/.test(authCode),
    'verificarTokenPortal valida tokenExpira vs now'
  )

  // Rutas del portal usan verificarTokenPortal
  const portalRoutes = [
    'src/app/api/juridico/portal/casos/route.ts',
    'src/app/api/juridico/portal/chat/route.ts',
  ]
  for (const r of portalRoutes) {
    if (!fileExists(r)) continue
    const code = readFile(r)
    assert(
      /verificarTokenPortal/.test(code),
      `${r}: usa verificarTokenPortal (que valida tokenExpira)`
    )
  }
}

// =====================================================
// TC-JUR-006: Logout → HTTP 200, tokenSesion=null
// =====================================================
function TC_JUR_006() {
  console.log('\n=== TC-JUR-006: Logout → HTTP 200 + tokenSesion=null ===')
  const code = readFile('src/app/api/juridico/portal/auth/route.ts')

  // Existe método DELETE
  assert(
    /export async function DELETE\s*\(/.test(code),
    'Existe método DELETE en /api/juridico/portal/auth'
  )

  // Limpia tokenSesion en BD
  assert(
    /tokenSesion:\s*null/.test(code),
    'DELETE setea tokenSesion=null en BD'
  )

  // Limpia tokenExpira en BD
  assert(
    /tokenExpira:\s*null/.test(code),
    'DELETE setea tokenExpira=null en BD'
  )

  // HTTP 200
  const delStart = code.indexOf('export async function DELETE')
  const delEnd = code.indexOf('export async function', delStart + 10)
  const delBody = code.slice(delStart, delEnd > 0 ? delEnd : code.length)
  assert(
    /status:\s*200|success:\s*true/.test(delBody),
    'DELETE retorna HTTP 200 (o success:true)'
  )
}

// =====================================================
// TC-JUR-007: Listar casos asignados → HTTP 200 con casos del abogado
// =====================================================
function TC_JUR_007() {
  console.log('\n=== TC-JUR-007: Listar casos asignados → HTTP 200 con casos del abogado ===')
  const code = readFile('src/app/api/juridico/portal/casos/route.ts')

  // Valida token
  assert(
    /verificarTokenPortal/.test(code),
    'Usa verificarTokenPortal para autenticar'
  )

  // Filtra casos por abogado (cedula o nombre)
  assert(
    /abogadoEmail|abogadoNombre/.test(code),
    'Filtra casos por abogadoEmail o abogadoNombre'
  )

  // Si es GESTOR, ve todos los no cerrados
  assert(
    /GESTOR/.test(code),
    'GESTOR puede ver todos los casos no cerrados'
  )

  // HTTP 200 con success:true
  assert(
    /success:\s*true/.test(code),
    'Retorna respuesta exitosa (success: true)'
  )
}

// =====================================================
// TC-JUR-008: Ver detalle de caso → HTTP 200 con detalle completo
// =====================================================
function TC_JUR_008() {
  console.log('\n=== TC-JUR-008: Ver detalle de caso → HTTP 200 con detalle completo ===')
  // Debe existir un endpoint dedicado en el portal (no el /api/juridico/[id] sin auth)
  const ruta = 'src/app/api/juridico/portal/casos/[id]/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint GET /api/juridico/portal/casos/[id] (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida token
  assert(
    /verificarTokenPortal/.test(code),
    'Usa verificarTokenPortal para autenticar'
  )

  // Incluye relaciones: prestamo, cronologias, documentos, alertas
  assert(
    /include:\s*\{[\s\S]*?prestamo/i.test(code),
    'Incluye relación prestamo en la respuesta'
  )
  assert(
    /cronolog/i.test(code),
    'Incluye cronología del caso'
  )

  // HTTP 200 con success:true
  assert(
    /success:\s*true/.test(code),
    'Retorna success: true'
  )
}

// =====================================================
// TC-JUR-009: Subir documento legal → HTTP 201, trazabilidad en BD
// =====================================================
function TC_JUR_009() {
  console.log('\n=== TC-JUR-009: Subir documento legal → HTTP 201 + trazabilidad ===')
  // Endpoint debe estar en el portal con autenticación
  const ruta = 'src/app/api/juridico/portal/casos/[id]/documentos/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint POST /api/juridico/portal/casos/[id]/documentos (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida token
  assert(
    /verificarTokenPortal/.test(code),
    'Usa verificarTokenPortal para autenticar'
  )

  // Crea en documentoLegal (db.documentoLegal.create o tx.documentoLegal.create dentro de transacción)
  assert(
    /(db|tx)\.documentoLegal\.create/.test(code),
    'Crea registro en documentoLegal (db o tx dentro de transacción)'
  )

  // HTTP 201
  assert(
    /status:\s*201/.test(code),
    'Retorna HTTP 201 al crear documento'
  )

  // Trazabilidad: audit log o cronología
  assert(
    /registrarAuditLog|auditLog\.create|cronologiaCaso\.create/i.test(code),
    'Registra trazabilidad (AuditLog o CronologiaCaso)'
  )
}

// =====================================================
// TC-JUR-010: Abogado no puede ver caso ajeno → HTTP 403
// =====================================================
function TC_JUR_010() {
  console.log('\n=== TC-JUR-010: Abogado no puede ver caso ajeno → HTTP 403 ===')
  const ruta = 'src/app/api/juridico/portal/casos/[id]/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint /api/juridico/portal/casos/[id] (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida que el caso esté asignado al abogado
  // Posibles validaciones: abogadoEmail contains cedula, abogadoNombre contains nombre,
  // o rol GESTOR bypass
  assert(
    /abogadoEmail|abogadoNombre|abogadoAsignado/.test(code),
    'Valida asignación del caso al abogado (abogadoEmail/abogadoNombre)'
  )

  // HTTP 403 si no autorizado
  assert(
    /status:\s*403/.test(code),
    'Retorna HTTP 403 cuando el caso no pertenece al abogado'
  )

  // Mensaje claro
  const forbiddenIdx = code.search(/status:\s*403/)
  if (forbiddenIdx > 0) {
    const slice = code.slice(forbiddenIdx - 300, forbiddenIdx + 100)
    assert(
      /no autorizado|forbidden|ajeno|asignado/i.test(slice),
      'Mensaje claro: no autorizado / caso ajeno'
    )
  }

  // GESTOR bypass
  assert(
    /GESTOR/.test(code),
    'GESTOR puede ver cualquier caso (bypass)'
  )
}

// =====================================================
// TC-JUR-011: Agregar nota interna → HTTP 201, autor=abogado actual
// =====================================================
function TC_JUR_011() {
  console.log('\n=== TC-JUR-011: Agregar nota interna → HTTP 201 + autor=abogado actual ===')
  const ruta = 'src/app/api/juridico/portal/casos/[id]/notas-internas/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint POST /api/juridico/portal/casos/[id]/notas-internas (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida token
  assert(
    /verificarTokenPortal/.test(code),
    'Usa verificarTokenPortal para autenticar'
  )

  // Crea nota con autor = usuario.id del token
  assert(
    /autorId\s*[:=]\s*usuario\.id|autorId\s*[:=]\s*usuarioAutenticado\.id/.test(code),
    'Crea nota con autorId = usuario.id del token (abogado actual)'
  )

  // HTTP 201
  assert(
    /status:\s*201/.test(code),
    'Retorna HTTP 201 al crear nota'
  )

  // Registra en BD (NotaInterna o CronologiaCaso con tipo NOTA_INTERNA)
  assert(
    /db\.(notaInterna|cronologiaCaso)\.create/i.test(code),
    'Crea registro en BD (NotaInterna o CronologiaCaso)'
  )
}

// =====================================================
// TC-JUR-012: Ver bitácora del caso → HTTP 200 con movimientos por fecha
// =====================================================
function TC_JUR_012() {
  console.log('\n=== TC-JUR-012: Ver bitácora del caso → HTTP 200 con movimientos por fecha ===')
  const ruta = 'src/app/api/juridico/portal/casos/[id]/bitacora/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint GET /api/juridico/portal/casos/[id]/bitacora (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida token
  assert(
    /verificarTokenPortal/.test(code),
    'Usa verificarTokenPortal para autenticar'
  )

  // Consulta cronología
  assert(
    /cronologiaCaso\.findMany|cronologias:/.test(code),
    'Consulta cronología del caso (CronologiaCaso)'
  )

  // Ordenado por fecha
  assert(
    /orderBy:\s*\{\s*fecha/i.test(code),
    'Movimientos ordenados por fecha'
  )

  // HTTP 200 con success:true
  assert(
    /success:\s*true/.test(code),
    'Retorna success: true'
  )
}

// =====================================================
// TC-JUR-013: Rate limit login jurídico (20/min) → HTTP 429
// =====================================================
function TC_JUR_013() {
  console.log('\n=== TC-JUR-013: Rate limit login jurídico (20/min) → HTTP 429 ===')
  const code = readFile('src/app/api/juridico/portal/auth/route.ts')

  // Rate limit aplicado al login
  assert(
    /rateLimit\s*\(/.test(code),
    'rateLimit() invocado en POST login'
  )

  // Límite de 20 por minuto
  const rlMatch = code.match(/rateLimit\s*\([^,]+,\s*(\d+)\s*\)/)
  const limit = rlMatch ? parseInt(rlMatch[1], 10) : 0
  assert(
    limit === 20,
    `Límite es 20 por minuto (actual: ${limit})`
  )

  // HTTP 429 al exceder
  assert(
    /status:\s*429/.test(code),
    'Retorna HTTP 429 al exceder el rate limit'
  )

  // Mensaje "Demasiadas solicitudes"
  const status429Idx = code.search(/status:\s*429/)
  if (status429Idx > 0) {
    const slice = code.slice(status429Idx - 400, status429Idx + 50)
    assert(
      /demasiadas solicitudes|too many requests/i.test(slice),
      'Mensaje: "Demasiadas solicitudes"'
    )
  }
}

// =====================================================
// TC-JUR-015: Cada acción registrada en AuditLog
// =====================================================
function TC_JUR_015() {
  console.log('\n=== TC-JUR-015: Cada acción registrada en AuditLog ===')

  // Login ya tiene audit log
  const authCode = readFile('src/app/api/juridico/portal/auth/route.ts')
  assert(
    /registrarAuditLog\s*\(/.test(authCode) && /LOGIN_PORTAL_JURIDICO/.test(authCode),
    'POST /auth (login) registra AuditLog (LOGIN_PORTAL_JURIDICO)'
  )

  // Logout debe registrar audit log
  const delStart = authCode.indexOf('export async function DELETE')
  const delEnd = authCode.indexOf('export async function', delStart + 10)
  const delBody = authCode.slice(delStart, delEnd > 0 ? delEnd : authCode.length)
  assert(
    /registrarAuditLog|auditLog\.create/.test(delBody),
    'DELETE /auth (logout) registra AuditLog'
  )

  // Casos GET debe registrar audit log
  const casosCode = readFile('src/app/api/juridico/portal/casos/route.ts')
  assert(
    /registrarAuditLog|auditLog\.create/.test(casosCode),
    'GET /casos registra AuditLog'
  )

  // Casos/[id] GET debe registrar audit log
  const casoDetalleRuta = 'src/app/api/juridico/portal/casos/[id]/route.ts'
  if (fileExists(casoDetalleRuta)) {
    const c = readFile(casoDetalleRuta)
    assert(
      /registrarAuditLog|auditLog\.create/.test(c),
      'GET /casos/[id] registra AuditLog'
    )
  }

  // Documentos POST debe registrar audit log
  const docsRuta = 'src/app/api/juridico/portal/casos/[id]/documentos/route.ts'
  if (fileExists(docsRuta)) {
    const c = readFile(docsRuta)
    assert(
      /registrarAuditLog|auditLog\.create/.test(c),
      'POST /casos/[id]/documentos registra AuditLog'
    )
  }

  // Notas internas POST debe registrar audit log
  const notasRuta = 'src/app/api/juridico/portal/casos/[id]/notas-internas/route.ts'
  if (fileExists(notasRuta)) {
    const c = readFile(notasRuta)
    assert(
      /registrarAuditLog|auditLog\.create/.test(c),
      'POST /casos/[id]/notas-internas registra AuditLog'
    )
  }

  // AuditLog con campos: usuarioId, accion, ip, userAgent, fecha
  const schema = readFile('prisma/schema.prisma')
  const auditStart = schema.indexOf('model AuditLog')
  const auditEnd = schema.indexOf('}', auditStart)
  const auditBlock = schema.slice(auditStart, auditEnd)
  assert(
    /usuarioId/.test(auditBlock) && /accion/.test(auditBlock) && /ipOrigen/.test(auditBlock) && /userAgent/.test(auditBlock) && /fecha/.test(auditBlock),
    'Schema AuditLog tiene: usuarioId, accion, ipOrigen, userAgent, fecha'
  )
}

// =====================================================
// RUN ALL
// =====================================================
console.log('=====================================================')
console.log('QA M08-Portal Jurídico — 10 TCs pendientes')
console.log('=====================================================')

TC_JUR_005()
TC_JUR_006()
TC_JUR_007()
TC_JUR_008()
TC_JUR_009()
TC_JUR_010()
TC_JUR_011()
TC_JUR_012()
TC_JUR_013()
TC_JUR_015()

console.log('\n=====================================================')
console.log(`RESUMEN: ${pass} PASS / ${fail} FAIL`)
if (fail > 0) {
  console.log('\nFALLOS:')
  failures.forEach((f) => console.log(`  - ${f}`))
}
console.log('=====================================================')
process.exit(fail === 0 ? 0 : 1)
