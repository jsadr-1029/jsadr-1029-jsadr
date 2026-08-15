// =====================================================
// SEED — Usuario inicial del Portal del Contador
// Crea (idempotente) el usuario Js_Contador con rol CONTADOR,
// contraseña hasheada con bcrypt y mustChangePassword=true.
// =====================================================
/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Forzar la URL de Neon PostgreSQL (el shell puede tener DATABASE_URL=sqlite)
const NEON_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
process.env.DATABASE_URL = NEON_URL

const prisma = new PrismaClient()

async function main() {
  const username = 'Js_Contador'
  const email = 'contador@jsadr.com.co'
  const nombre = 'Contador JSADR'
  const rol = 'CONTADOR'
  const passwordPlain = 'Js951029*'

  const existente = await prisma.usuario.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  })

  if (existente) {
    console.log(`[seed-contador] El usuario "${username}" ya existe (id=${existente.id}). No se creó uno nuevo.`)
    console.log(`  - rol: ${existente.rol}`)
    console.log(`  - mustChangePassword: ${existente.mustChangePassword}`)
    return
  }

  const passwordHash = bcrypt.hashSync(passwordPlain, 12)

  const usuario = await prisma.usuario.create({
    data: {
      username,
      email,
      nombre,
      rol,
      passwordHash,
      mustChangePassword: true,
      activo: true,
    },
  })

  console.log(`[seed-contador] Usuario creado correctamente:`)
  console.log(`  - id: ${usuario.id}`)
  console.log(`  - username: ${usuario.username}`)
  console.log(`  - email: ${usuario.email}`)
  console.log(`  - rol: ${usuario.rol}`)
  console.log(`  - mustChangePassword: ${usuario.mustChangePassword}`)
  console.log(`  - passwordHash: (bcrypt rounds=12)`)
}

main()
  .catch((e) => {
    console.error('[seed-contador] Error:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
