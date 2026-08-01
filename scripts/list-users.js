// Find a user we can log in with by reading the database directly
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const users = await db.usuario.findMany({
    select: { id: true, username: true, email: true, rol: true, activo: true },
  })
  console.log('Usuarios en BD:')
  for (const u of users) {
    console.log(`  - ${u.username} (${u.rol}) activo=${u.activo} email=${u.email}`)
  }
}
main().catch(console.error).finally(() => db.$disconnect())
