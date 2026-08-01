// Limpia el usuario admin temporal creado para tests.
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const r = await db.usuario.deleteMany({ where: { username: 'test-dual-otp' } })
  console.log(`✓ Usuario(s) eliminado(s): ${r.count}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
