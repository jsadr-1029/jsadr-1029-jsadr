// Reset admin password to a known value for testing
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const db = new PrismaClient()

async function main() {
  const newPass = 'Admin-Test-2026*'
  const hash = await bcrypt.hash(newPass, 12)
  const u = await db.usuario.update({
    where: { username: 'adm-jsadr' },
    data: { passwordHash: hash, intentosFallidos: 0, bloqueadoHasta: null },
  })
  console.log('Password actualizada para adm-jsadr')
  console.log('Nueva contraseña:', newPass)
  // Verify
  const ok = await bcrypt.compare(newPass, u.passwordHash)
  console.log('Verificación bcrypt:', ok)
}
main().catch(console.error).finally(() => db.$disconnect())
