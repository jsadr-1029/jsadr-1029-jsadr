// =====================================================
// RESET — Restaura el usuario Js_Contador a su estado inicial
// (contraseña Js951029* + mustChangePassword=true).
// Útil para re-pruebas del flujo de primer login.
// Uso: node scripts/reset-contador.cjs
// =====================================================
/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const NEON_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
process.env.DATABASE_URL = NEON_URL

const prisma = new PrismaClient()

async function main() {
  const username = 'Js_Contador'
  const passwordPlain = 'Js951029*'

  const usuario = await prisma.usuario.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  })

  if (!usuario) {
    console.log(`[reset-contador] El usuario "${username}" no existe. Ejecute primero scripts/seed-contador.cjs`)
    return
  }

  const passwordHash = bcrypt.hashSync(passwordPlain, 12)

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  })

  console.log(`[reset-contador] Usuario "${username}" restaurado al estado inicial:`)
  console.log(`  - contraseña: ${passwordPlain} (hasheada con bcrypt rounds=12)`)
  console.log(`  - mustChangePassword: true`)
  console.log(`  - intentosFallidos: 0`)
}

main()
  .catch((e) => {
    console.error('[reset-contador] Error:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
