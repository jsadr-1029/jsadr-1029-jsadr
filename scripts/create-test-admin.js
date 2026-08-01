// Crea un usuario admin temporal con contraseña conocida para ejecutar tests.
// Al final del test, ejecuta cleanup-test-admin.js para borrarlo.
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const db = new PrismaClient()

async function main() {
  const username = 'test-dual-otp'
  const password = 'TestDualOtp2025$'

  // Borrar si ya existe
  await db.usuario.deleteMany({ where: { username } }).catch(() => {})

  const hash = await bcrypt.hash(password, 12)
  const u = await db.usuario.create({
    data: {
      nombre: 'Test Dual OTP',
      username,
      email: 'test-dual-otp@test.local',
      passwordHash: hash,
      rol: 'ADMIN',
      permisos: '["*"]',
      activo: true,
      mfaEnabled: false,
      mustChangePassword: false,
    },
    select: { username: true, rol: true },
  })

  console.log('✓ Usuario temporal creado:')
  console.log(JSON.stringify(u, null, 2))
  console.log(`  password: ${password}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
