// One-off: actualiza la descripción del hash del portal admin para
// reflejar el nuevo usuario "Jsadr" (la clave sigue siendo 731649,
// así que el hash bcrypt ya almacenado sigue siendo válido).

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const db = new PrismaClient()

async function main() {
  const cfg = await db.configuracion.findUnique({
    where: { clave: 'portal_admin_hash' },
  })
  if (!cfg) {
    console.log('No existe Configuracion.portal_admin_hash. Se creará en el primer login.')
    return
  }
  console.log('Registro actual:')
  console.log('  clave       :', cfg.clave)
  console.log('  descripcion :', cfg.descripcion)
  console.log('  valor (hash):', cfg.valor.substring(0, 30) + '...')

  const updated = await db.configuracion.update({
    where: { clave: 'portal_admin_hash' },
    data: {
      descripcion: 'Hash bcrypt del portal administrador (usuario Jsadr)',
    },
  })
  console.log('\nDescripción actualizada a:', updated.descripcion)
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => db.$disconnect())
