// Script para limpiar préstamos "TODO COMPLETO" previos (sin pagos programados)
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

async function main() {
  const prestamos = await prisma.prestamo.findMany({
    where: { codigo: { startsWith: 'TODO-COMPLETO-' } },
    include: { _count: { select: { pagosProgramados: true, pagos: true } } },
  })

  console.log(`Préstamos 'TODO COMPLETO' encontrados: ${prestamos.length}`)
  for (const p of prestamos) {
    console.log(`  - ${p.codigo} | estado=${p.estado} | pagosProgramados=${p._count.pagosProgramados} | pagos=${p._count.pagos}`)
  }

  // Borrarlos todos (pagos programados se borran en cascada)
  for (const p of prestamos) {
    await prisma.pagoProgramado.deleteMany({ where: { prestamoId: p.id } })
    await prisma.prestamo.delete({ where: { id: p.id } })
    console.log(`  ✗ Eliminado: ${p.codigo}`)
  }
  console.log('Limpieza completa.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
