// Inspeccionar categorías existentes en Neon (force prod DATABASE_URL)
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const cats = await db.categoriaCliente.findMany({
    orderBy: { codigo: 'asc' },
    include: { _count: { select: { clientes: true, prestamos: true } } },
  })
  console.log(`\n=== ${cats.length} Categorías en BD ===`)
  for (const c of cats) {
    console.log(`- ${c.codigo} | ${c.nombre}`)
    console.log(`    min: $${c.montoMinimo} | max: $${c.montoMaximo}`)
    console.log(`    tasa anual: ${c.tasaInteresAnual}% | mora: ${c.tasaMoraAnual}%`)
    console.log(`    activa: ${c.activa} | clientes: ${c._count.clientes} | préstamos: ${c._count.prestamos}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
