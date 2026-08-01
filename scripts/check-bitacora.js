const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
;(async () => {
  const entries = await prisma.bitacoraPrestamo.findMany({
    where: { prestamoId: 'cms8chcm2000nqu65omu4817z' },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { titulo: true, descripcion: true, createdAt: true }
  })
  console.log('Total entries found:', entries.length)
  for (const e of entries) {
    console.log(`\n[${e.createdAt.toISOString()}]`)
    console.log(`  TITULO: ${e.titulo}`)
    console.log(`  DESC: ${e.descripcion.substring(0, 200)}...`)
  }
  await prisma.$disconnect()
})()
