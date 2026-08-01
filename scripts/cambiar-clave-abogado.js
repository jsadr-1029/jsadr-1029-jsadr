// Cambia la clave del portal de abogado a "951029"
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const prisma = new PrismaClient()

async function main() {
  const NUEVA_CLAVE = '951029'
  const CEDULA = '1234567890'

  console.log(`Actualizando clave del portal para cédula ${CEDULA}...`)
  const claveHash = await bcrypt.hash(NUEVA_CLAVE, 12)

  const actualizado = await prisma.usuario.update({
    where: { cedula: CEDULA },
    data: {
      claveHash,
      // Reset campos de seguridad
      intentosFallidos: 0,
      bloqueadoHasta: null,
      tokenSesion: null,
      tokenExpira: null,
      mustChangePassword: false,
    },
  })

  console.log('✓ Clave actualizada')
  console.log('  Usuario:', actualizado.username)
  console.log('  Nombre:', actualizado.nombre)
  console.log('  Rol:', actualizado.rol)
  console.log('  Cédula:', actualizado.cedula)

  // Verificación bcrypt
  const match = await bcrypt.compare(NUEVA_CLAVE, actualizado.claveHash)
  console.log('  bcrypt.compare OK:', match)
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect())
