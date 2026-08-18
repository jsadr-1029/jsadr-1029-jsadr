// Verificar que la migración del schema se aplicó correctamente en Neon
const { PrismaClient } = require('@prisma/client')
const { config } = require('dotenv')
config({ path: '.env' })

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

async function main() {
  process.env.DATABASE_URL = NEON_URL
  const prisma = new PrismaClient()
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'SolicitudNuevoCliente'
        AND column_name IN ('motivoDevolucion', 'fechaDevolucion', 'vecesDevuelta')
      ORDER BY column_name;
    `
    console.log('Columnas nuevas en SolicitudNuevoCliente:')
    for (const row of result) {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`)
    }
    if (result.length !== 3) {
      console.error(`✗ Se esperaban 3 columnas, encontradas ${result.length}`)
      process.exit(1)
    }
    console.log('\n✓ Schema correctamente sincronizado con Neon.')

    // Verificar que también podemos leer el estado DEVUELTA en el enum (es string, no enum real)
    const counts = await prisma.$queryRaw`
      SELECT estado, COUNT(*)::int as cantidad
      FROM "SolicitudNuevoCliente"
      GROUP BY estado
      ORDER BY estado;
    `
    console.log('\nEstados actuales en la BD:')
    for (const row of counts) {
      console.log(`  ${row.estado}: ${row.cantidad}`)
    }
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}
main()
