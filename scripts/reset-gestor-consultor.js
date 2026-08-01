// Reset passwords for GESTOR and CONSULTOR to known values
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const prisma = new PrismaClient()

async function main() {
  const RESETS = [
    { username: 'gestor-jsadr',    newPassword: 'JsadrGestor2026*' },
    { username: 'consultor-jsadr', newPassword: 'JsadrConsultor2026*' },
  ]

  for (const r of RESETS) {
    const hash = await bcrypt.hash(r.newPassword, 12)
    const updated = await prisma.usuario.update({
      where: { username: r.username },
      data: {
        passwordHash: hash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        mustChangePassword: false,
        sessionToken: null,
      },
    })
    const match = await bcrypt.compare(r.newPassword, updated.passwordHash)
    console.log(`✓ ${r.username} → clave actualizada (bcrypt match: ${match})`)
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect())
