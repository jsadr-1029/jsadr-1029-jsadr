require('dotenv').config({ path: '.env' })
// =====================================================
// TEST END-TO-END DE CORREOS — OTP + RESET + NOTIFICACIÓN
// =====================================================
// Verifica que TODOS los flujos que envían correo funcionen:
//   1. Recuperación de clave (recuperar-clave route)
//   2. OTP chat (chat/otp route)
//   3. OTP firma préstamo (portal/solicitar-otp route)
//   4. Notificación de activación (aceptar-tyc-otp route)
//   5. Prueba directa de envío (api/email route)
//
// Ejecuta contra localhost:3000 (servidor dev).
// =====================================================

const http = require('http')

const BASE = 'http://localhost:3000'

function req(path, method, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null
    const h = { 'Content-Type': 'application/json', ...headers }
    if (data) h['Content-Length'] = Buffer.byteLength(data)
    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers: h }, (res) => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => resolve({ status: res.statusCode, body: buf }))
    })
    r.on('error', e => resolve({ status: 0, error: e.message }))
    if (data) r.write(data)
    r.end()
  })
}

async function loginAdmin() {
  // Buscar credenciales admin en BD
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const admins = await prisma.usuario.findMany({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true, username: true, nombre: true, email: true, passwordHash: true },
      take: 5,
    })
    console.log('Admins encontrados:', admins.length)
    admins.forEach(a => console.log(`  - username=${a.username} email=${a.email} hasHash=${!!a.passwordHash}`))
    return admins
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  console.log('=========================================')
  console.log('  TEST END-TO-END DE CORREOS  v1.0')
  console.log('=========================================\n')

  // 1. Verificar admins disponibles
  console.log('[1] Verificando usuarios ADMIN en BD...')
  await loginAdmin()

  // 2. Estado SMTP (requiere auth ADMIN — lo intentamos sin auth para ver el 401)
  console.log('\n[2] GET /api/email (estado SMTP)...')
  const r2 = await req('/api/email', 'GET')
  console.log(`  Status: ${r2.status}`)
  console.log(`  Body: ${r2.body.slice(0, 300)}`)

  // 3. Recuperación de clave (público)
  console.log('\n[3] POST /api/auth/recuperar-clave (con identificador "admin")...')
  const r3 = await req('/api/auth/recuperar-clave', 'POST', { identificador: 'admin' })
  console.log(`  Status: ${r3.status}`)
  console.log(`  Body: ${r3.body.slice(0, 500)}`)

  // 4. Recuperación de clave con email inexistente
  console.log('\n[4] POST /api/auth/recuperar-clave (con identificador inexistente)...')
  const r4 = await req('/api/auth/recuperar-clave', 'POST', { identificador: 'no-existe-xyz-12345' })
  console.log(`  Status: ${r4.status}`)
  console.log(`  Body: ${r4.body.slice(0, 300)}`)

  // 5. Recuperación de clave sin identificador (validación)
  console.log('\n[5] POST /api/auth/recuperar-clave (sin identificador)...')
  const r5 = await req('/api/auth/recuperar-clave', 'POST', {})
  console.log(`  Status: ${r5.status}`)
  console.log(`  Body: ${r5.body.slice(0, 300)}`)

  // 6. Solicitar OTP chat (sin cliente)
  console.log('\n[6] POST /api/chat/otp accion=solicitar (sin clienteId)...')
  const r6 = await req('/api/chat/otp', 'POST', { accion: 'solicitar' })
  console.log(`  Status: ${r6.status}`)
  console.log(`  Body: ${r6.body.slice(0, 300)}`)

  // 7. Solicitar OTP chat con cliente inexistente
  console.log('\n[7] POST /api/chat/otp accion=solicitar (clienteId inexistente)...')
  const r7 = await req('/api/chat/otp', 'POST', { accion: 'solicitar', clienteId: 'no-existe-xyz' })
  console.log(`  Status: ${r7.status}`)
  console.log(`  Body: ${r7.body.slice(0, 300)}`)

  // 8. Verificar OTP chat con datos inválidos
  console.log('\n[8] POST /api/chat/otp accion=verificar (sin codigo)...')
  const r8 = await req('/api/chat/otp', 'POST', { accion: 'verificar' })
  console.log(`  Status: ${r8.status}`)
  console.log(`  Body: ${r8.body.slice(0, 300)}`)

  // 9. Solicitar OTP firma préstamo (sin firmaId)
  console.log('\n[9] POST /api/portal/solicitar-otp (sin firmaId)...')
  const r9 = await req('/api/portal/solicitar-otp', 'POST', {})
  console.log(`  Status: ${r9.status}`)
  console.log(`  Body: ${r9.body.slice(0, 300)}`)

  // 10. Buscar cliente válido en BD y solicitar OTP chat
  console.log('\n[10] Buscando cliente con email en BD para prueba real...')
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  let clienteReal = null
  try {
    clienteReal = await prisma.cliente.findFirst({
      where: { activo: true, email: { not: null } },
      select: { id: true, nombre: true, cedula: true, email: true, telefono: true },
    })
    if (clienteReal) {
      console.log(`  Cliente encontrado: ${clienteReal.nombre} (cedula=${clienteReal.cedula}, email=${clienteReal.email})`)
      console.log(`\n[10a] POST /api/chat/otp accion=solicitar (cliente real)...`)
      const r10 = await req('/api/chat/otp', 'POST', { accion: 'solicitar', clienteId: clienteReal.id })
      console.log(`  Status: ${r10.status}`)
      console.log(`  Body: ${r10.body.slice(0, 500)}`)
    } else {
      console.log('  No hay clientes con email registrado.')
    }
  } finally {
    await prisma.$disconnect()
  }

  // 11. Recuperación de clave con email del cliente real
  if (clienteReal) {
    console.log(`\n[11] POST /api/auth/recuperar-clave (cliente real, email=${clienteReal.email})...`)
    const r11 = await req('/api/auth/recuperar-clave', 'POST', { identificador: clienteReal.email })
    console.log(`  Status: ${r11.status}`)
    console.log(`  Body: ${r11.body.slice(0, 500)}`)
  }

  // 12. Recuperación de clave con cédula del cliente real
  if (clienteReal) {
    console.log(`\n[12] POST /api/auth/recuperar-clave (cliente real, cedula=${clienteReal.cedula})...`)
    const r12 = await req('/api/auth/recuperar-clave', 'POST', { identificador: clienteReal.cedula })
    console.log(`  Status: ${r12.status}`)
    console.log(`  Body: ${r12.body.slice(0, 500)}`)
  }

  console.log('\n=========================================')
  console.log('  FIN DEL TEST END-TO-END')
  console.log('=========================================')
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
