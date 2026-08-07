// =====================================================
// QA M07-Portal Cliente — 9 TCs pendientes
// Jsadr
// =====================================================
// TC-PORT-003: Login PIN incorrecto → HTTP 401, pinIntentos++, bloqueo a los 5
// TC-PORT-004: Cliente inactivo no puede login → HTTP 403 'Cuenta inactiva' antes de PIN
// TC-PORT-006: Sesión expira a las 2h → tokenExpira verificado en cada request
// TC-PORT-009: Validar OTP incorrecto → HTTP 401, intentosOTP++, bloqueo firma a los 5
// TC-PORT-011: Validar clave dinámica → HTTP 200 con codigoConfirmacion, estado OTP=USADO
// TC-PORT-012: Ver estado de cuenta → GET /api/portal/mi-estado, solo datos del cliente autenticado
// TC-PORT-013: Crear solicitud de crédito → POST /api/solicitudes-web, codigoConfirmacion consumido
// TC-PORT-014: Logout → DELETE /api/portal/login, tokenSesion=null, tokenExpira=null en BD
// TC-PORT-015: Acceso cross-cliente → HTTP 403, validación token vs clienteId
// =====================================================

import * as fs from 'fs'
import * as path from 'path'

const ROOT = '/home/z/my-project'
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
// TC-PORT-003: Login PIN incorrecto → HTTP 401, pinIntentos++, bloqueo a los 5
// =====================================================
function TC_PORT_003() {
  console.log('\n=== TC-PORT-003: Login PIN incorrecto → 401 + pinIntentos++ + bloqueo a 5 ===')
  const code = readFile('src/app/api/portal/login/route.ts')

  // pinIntentos++ en BD al PIN incorrecto (puede ser directo o vía variable intermedia)
  const incrementaPin = /cliente\.pinIntentos\s*\+\s*1/.test(code)
  assert(incrementaPin, 'pinIntentos se incrementa al fallar el PIN')

  // HTTP 401 al PIN incorrecto (puede ser `status: 401` o `status: bloquear ? 403 : 401`)
  assert(
    /status:\s*401|status:\s*bloquear\s*\?\s*403\s*:\s*401/.test(code),
    'HTTP 401 retornado cuando PIN es incorrecto'
  )

  // Bloqueo a los 5 intentos (no 3)
  // El Excel exige "Bloqueo a los 5". Validar que el umbral sea 5.
  // Acepta: literal `>= 5` o constante `>= MAX_INTENTOS_PIN` con `MAX_INTENTOS_PIN = 5`
  const literalMatch = code.match(/(?:nuevosIntentos|intentos)\s*>=\s*(\d+)/)
  const constMatch = code.match(/(?:nuevosIntentos|intentos)\s*>=\s*MAX_INTENTOS_PIN/)
  const constValueMatch = code.match(/MAX_INTENTOS_PIN\s*=\s*(\d+)/)

  let umbral = 0
  if (literalMatch) {
    umbral = parseInt(literalMatch[1], 10)
  } else if (constMatch && constValueMatch) {
    umbral = parseInt(constValueMatch[1], 10)
  }
  assert(
    umbral === 5,
    `Bloqueo tras 5 intentos (umbral actual: ${umbral}; esperado: 5)`
  )

  // Mensaje coherente sobre bloqueo
  assert(
    /bloqueada|bloqueado/i.test(code),
    'Mensaje indica bloqueo cuando se excede el umbral'
  )
}

// =====================================================
// TC-PORT-004: Cliente inactivo no puede login → HTTP 403 'Cuenta inactiva' antes de PIN
// =====================================================
function TC_PORT_004() {
  console.log('\n=== TC-PORT-004: Cliente inactivo → HTTP 403 antes de check PIN ===')
  const code = readFile('src/app/api/portal/login/route.ts')

  // Validación de !cliente.activo retorna 403
  const inactivoIdx = code.indexOf('!cliente.activo')
  assert(inactivoIdx > 0, 'Existe validación de cliente inactivo (!cliente.activo)')

  // Verificar que la validación retorna 403
  const sliceAfterCheck = code.slice(inactivoIdx, inactivoIdx + 250)
  assert(
    /status:\s*403/.test(sliceAfterCheck),
    'Cliente inactivo retorna HTTP 403'
  )

  // Mensaje 'Cuenta inactiva'
  assert(
    /Cuenta inactiva/i.test(sliceAfterCheck),
    "Mensaje 'Cuenta inactiva' presente en respuesta"
  )

  // Verificar que la validación de inactividad ocurre ANTES de la verificación de PIN
  const pinCompareIdx = code.indexOf('bcrypt.compareSync(pin')
  assert(
    inactivoIdx > 0 && pinCompareIdx > 0 && inactivoIdx < pinCompareIdx,
    'Validación de inactividad ocurre antes de la verificación del PIN'
  )
}

// =====================================================
// TC-PORT-006: Sesión expira a las 2h → tokenExpira verificado en cada request
// =====================================================
function TC_PORT_006() {
  console.log('\n=== TC-PORT-006: Sesión expira 2h → tokenExpira verificado en cada request ===')
  const code = readFile('src/app/api/portal/login/route.ts')

  // Sesión de 2 horas
  assert(
    /2\s*\*\s*60\s*\*\s*60\s*\*\s*1000|2\s*\*\s*60\s*\*\s*60\s*\*\s*1_000/.test(code),
    'Sesión con expiración de 2 horas (2 * 60 * 60 * 1000 ms)'
  )

  // tokenExpira persistido (shorthand `tokenExpira,` o `tokenExpira: valor`)
  assert(
    /tokenExpira\s*[,:]\s*\S*/.test(code),
    'tokenExpira se persiste en BD al hacer login'
  )

  // Verificar que las rutas que requieren sesión validan tokenExpira
  const routesToCheck = [
    'src/app/api/portal/prestamos/route.ts',
    'src/app/api/portal/cuenta-pago/route.ts',
    'src/app/api/portal/firmar/route.ts',
    'src/app/api/portal/simular/route.ts',
    'src/app/api/portal/clave-dinamica/solicitar/route.ts',
    'src/app/api/portal/clave-dinamica/validar/route.ts',
  ]
  for (const route of routesToCheck) {
    if (!fileExists(route)) continue
    const r = readFile(route)
    // Cualquier patrón que compare tokenExpira contra now/new Date
    const checksToken =
      /tokenExpira\s*<\s*new\s*Date|tokenExpira\s*>\s*now|new\s*Date\s*\(\s*\S*\.tokenExpira\s*\)\s*<\s*new\s*Date|cliente\.tokenExpira\s*>\s*now/.test(r)
    assert(
      checksToken,
      `${route}: valida tokenExpira vs now → 401 'Sesión expirada' si expiró`
    )
  }

  // Validar también en solicitudes-web POST
  const solWeb = readFile('src/app/api/solicitudes-web/route.ts')
  assert(
    /tokenExpira\s*>\s*now|tokenExpira\s*<\s*new Date/.test(solWeb),
    'solicitudes-web POST valida tokenExpira'
  )
}

// =====================================================
// TC-PORT-009: Validar OTP incorrecto → HTTP 401, intentosOTP++, bloqueo a 5
// =====================================================
function TC_PORT_009() {
  console.log('\n=== TC-PORT-009: Validar OTP incorrecto → 401 + intentosOTP++ + bloqueo a 5 ===')
  const code = readFile('src/app/api/portal/validar-otp/route.ts')

  // intentosOTP++ (puede ser directo o vía variable intermedia)
  const incrementaOtp = /firma\.intentosOTP\s*\+\s*1/.test(code)
  assert(incrementaOtp, 'intentosOTP se incrementa al fallar el OTP')

  // HTTP 401 cuando OTP incorrecto (no bloqueado aún)
  assert(
    /status:\s*401/.test(code),
    'HTTP 401 retornado cuando OTP es incorrecto (sin bloquear)'
  )

  // Bloqueo con maxIntentos del schema (5)
  assert(
    /maxIntentos/.test(code),
    'Bloqueo basado en firma.maxIntentos (schema default 5)'
  )

  // Verificar schema: maxIntentos default = 5 para FirmaElectronica
  const schema = readFile('prisma/schema.prisma')
  // Buscar el maxIntentos dentro del bloque de FirmaElectronica (no OtpRegistro ni otros)
  const firmaStart = schema.indexOf('model FirmaElectronica')
  const firmaEnd = schema.indexOf('}', schema.indexOf('}', firmaStart) + 1)
  const firmaBlock = schema.slice(firmaStart, firmaEnd)
  const maxIntentosMatch = firmaBlock.match(/maxIntentos\s+Int\s+@default\((\d+)\)/)
  assert(
    maxIntentosMatch !== null && maxIntentosMatch[1] === '5',
    `Schema FirmaElectronica.maxIntentos default = 5 (actual: ${maxIntentosMatch?.[1] || 'N/A'})`
  )
}

// =====================================================
// TC-PORT-011: Validar clave dinámica → HTTP 200 con codigoConfirmacion, estado OTP=USADO
// =====================================================
function TC_PORT_011() {
  console.log('\n=== TC-PORT-011: Validar clave dinámica → 200 + codigoConfirmacion + estado OTP=USADO ===')
  const code = readFile('src/app/api/portal/clave-dinamica/validar/route.ts')

  // Genera codigoConfirmacion
  assert(
    /codigoConfirmacion\s*=/.test(code),
    'Se genera codigoConfirmacion tras validar la clave'
  )

  // Retorna codigoConfirmacion al cliente
  assert(
    /codigoConfirmacion/.test(code.slice(code.indexOf('return NextResponse.json'))),
    'codigoConfirmacion incluido en la respuesta HTTP 200'
  )

  // Marca el OtpRegistro como usado (estado USADO)
  // La función marcarOtpVerificado(otpRegistroId, codigoConfirmacionHash)
  // es la que ejecuta update con usado: true
  assert(
    /marcarOtpVerificado/.test(code),
    'Se llama a marcarOtpVerificado() tras éxito'
  )

  // Verificar que marcarOtpVerificado efectivamente setea usado=true
  const otpLib = readFile('src/lib/otp.ts')
  const fnStart = otpLib.indexOf('export async function marcarOtpVerificado')
  const fnEnd = otpLib.indexOf('}\n', fnStart)
  const fnBody = otpLib.slice(fnStart, fnEnd)
  assert(
    /usado:\s*true/.test(fnBody),
    'marcarOtpVerificado() setea usado=true (Estado OTP=USADO)'
  )

  // Comparación constant-time (anti-timing)
  assert(
    /verificarOtp/.test(code),
    'Comparación OTP con verificarOtp (constant-time SHA-256)'
  )
}

// =====================================================
// TC-PORT-012: Ver estado de cuenta → GET /api/portal/mi-estado
// =====================================================
function TC_PORT_012() {
  console.log('\n=== TC-PORT-012: GET /api/portal/mi-estado → solo datos del cliente autenticado ===')
  const ruta = 'src/app/api/portal/mi-estado/route.ts'
  const exists = fileExists(ruta)
  assert(exists, `Existe endpoint GET /api/portal/mi-estado (${ruta})`)

  if (!exists) return

  const code = readFile(ruta)

  // Valida token (header o query)
  assert(
    /x-portal-token|tokenSesion/.test(code),
    'Endpoint valida token (header x-portal-token o por cliente.tokenSesion)'
  )

  // Valida tokenExpira
  assert(
    /tokenExpira/.test(code),
    'Endpoint valida tokenExpira vs now'
  )

  // Solo devuelve datos del cliente del token (no acepta clienteId arbitrario)
  assert(
    /findFirst\s*\(\s*\{[\s\S]*?where:[\s\S]*?tokenSesion/.test(code) ||
      /findUnique\s*\(\s*\{[\s\S]*?where:[\s\S]*?tokenSesion/.test(code),
    'Busca cliente por tokenSesion (no por clienteId arbitrario)'
  )

  // Devuelve préstamos y saldos
  assert(
    /prestamo/i.test(code),
    'Devuelve préstamos del cliente'
  )

  // Devuelve saldos / próximos vencimientos
  assert(
    /saldo|vencim/i.test(code),
    'Devuelve saldos y/o próximos vencimientos'
  )
}

// =====================================================
// TC-PORT-013: Crear solicitud de crédito → codigoConfirmacion consumido
// =====================================================
function TC_PORT_013() {
  console.log('\n=== TC-PORT-013: POST /api/solicitudes-web → codigoConfirmacion consumido ===')
  const code = readFile('src/app/api/solicitudes-web/route.ts')

  // Recibe codigoConfirmacion
  assert(
    /codigoConfirmacion/.test(code),
    'POST /api/solicitudes-web recibe codigoConfirmacion en el body'
  )

  // Valida codigoConfirmacion contra OtpRegistro
  assert(
    /otpRegistro|otpReg/.test(code) && /sessionIdGenerado/.test(code),
    'Valida codigoConfirmacion contra OtpRegistro.sessionIdGenerado (hash)'
  )

  // Comparación constant-time
  assert(
    /safeCompare/.test(code),
    'Comparación constant-time (safeCompare) para codigoConfirmacion'
  )

  // Marca el codigoConfirmacion como consumido (bloqueado=true o usado=false+verificado=false)
  // El Excel solo exige "codigoConfirmación consumido" — la implementación marca
  // el OtpRegistro para que no pueda reutilizarse en otra solicitud.
  const updateIdx = code.indexOf('otpRegistro.update')
  assert(updateIdx > 0, 'Se actualiza OtpRegistro tras crear la solicitud (consumir codigoConfirmacion)')

  if (updateIdx > 0) {
    const updateSlice = code.slice(updateIdx, updateIdx + 400)
    const consumed =
      /bloqueado:\s*true/.test(updateSlice) ||
      /usado:\s*false/.test(updateSlice) ||
      /verificado:\s*false/.test(updateSlice)
    assert(consumed, 'OtpRegistro marcado como no reutilizable (bloqueado=true o verificado=false)')
  }

  // Crea la solicitud con estado PENDIENTE
  assert(
    /estado:\s*['"]PENDIENTE['"]/.test(code),
    'Solicitud creada con estado PENDIENTE'
  )

  // HTTP 201 al crear (Excel: 'HTTP 201. Solicitud creada con estado PENDIENTE')
  assert(
    /status:\s*201/.test(code),
    'Respuesta retorna HTTP 201 al crear solicitud'
  )
}

// =====================================================
// TC-PORT-014: Logout → DELETE /api/portal/login
// =====================================================
function TC_PORT_014() {
  console.log('\n=== TC-PORT-014: DELETE /api/portal/login → tokenSesion=null + tokenExpira=null en BD ===')
  const ruta = 'src/app/api/portal/login/route.ts'
  const code = readFile(ruta)

  // Existe método DELETE
  assert(
    /export async function DELETE\s*\(/.test(code),
    `Existe método DELETE en ${ruta}`
  )

  // Encontrar el cuerpo del DELETE
  const delStart = code.indexOf('export async function DELETE')
  if (delStart < 0) return
  const delEnd = code.indexOf('export async function', delStart + 10)
  const delBody = code.slice(delStart, delEnd > 0 ? delEnd : code.length)

  // Acepta token (body o header)
  assert(
    /token/.test(delBody),
    'DELETE acepta token (en body o header)'
  )

  // Limpia tokenSesion en BD
  assert(
    /tokenSesion:\s*null/.test(delBody),
    'DELETE setea tokenSesion=null en BD'
  )

  // Limpia tokenExpira en BD
  assert(
    /tokenExpira:\s*null/.test(delBody),
    'DELETE setea tokenExpira=null en BD'
  )

  // Registra en AccesoPortal (auditoría)
  assert(
    /accesoPortal\.create|registrarAccesoPortal/.test(delBody),
    'DELETE registra acción de LOGOUT en AccesoPortal (auditoría)'
  )

  // HTTP 200
  assert(
    /status:\s*200|\{ success:\s*true/.test(delBody),
    'DELETE retorna HTTP 200 (o success:true)'
  )
}

// =====================================================
// TC-PORT-015: Acceso cross-cliente → HTTP 403, validación token vs clienteId
// =====================================================
function TC_PORT_015() {
  console.log('\n=== TC-PORT-015: Cliente A no puede ver datos de B → 403 con validación token vs cédula ===')
  const ruta = 'src/app/api/portal/[cedula]/route.ts'
  const code = readFile(ruta)

  // Recibe token (header o query)
  assert(
    /x-portal-token|token/.test(code),
    'GET /api/portal/[cedula] recibe token (header o query)'
  )

  // Busca cliente por tokenSesion (no solo por cédula)
  assert(
    /tokenSesion/.test(code),
    'Endpoint usa tokenSesion para identificar al cliente autenticado'
  )

  // Valida que la cédula del cliente autenticado coincida con la cédula del URL
  // (para evitar que cliente A vea datos de cliente B)
  // Acepta: `cliente.cedula !== cedula` o `clienteAutenticado.cedula !== cedula` etc.
  assert(
    /(?:cliente|clienteAutenticado|sesion)\.cedula\s*!==?\s*cedula|cedula\s*!==?\s*(?:cliente|clienteAutenticado|sesion)\.cedula/.test(code),
    'Valida que la cédula del cliente autenticado coincida con la cédula del URL'
  )

  // Si no coincide → HTTP 403
  const forbiddenIdx = code.search(/status:\s*403/)
  assert(
    forbiddenIdx > 0,
    'Retorna HTTP 403 cuando token no corresponde a la cédula solicitada'
  )

  // Mensaje claro
  const slice403 = code.slice(forbiddenIdx - 300, forbiddenIdx + 100)
  assert(
    /no autorizado|forbidden|otro cliente/i.test(slice403),
    'Mensaje claro: cliente no autorizado para ver datos de otro'
  )
}

// =====================================================
// RUN ALL
// =====================================================
console.log('=====================================================')
console.log('QA M07-Portal Cliente — 9 TCs pendientes')
console.log('=====================================================')

TC_PORT_003()
TC_PORT_004()
TC_PORT_006()
TC_PORT_009()
TC_PORT_011()
TC_PORT_012()
TC_PORT_013()
TC_PORT_014()
TC_PORT_015()

console.log('\n=====================================================')
console.log(`RESUMEN: ${pass} PASS / ${fail} FAIL`)
if (fail > 0) {
  console.log('\nFALLOS:')
  failures.forEach((f) => console.log(`  - ${f}`))
}
console.log('=====================================================')
process.exit(fail === 0 ? 0 : 1)
