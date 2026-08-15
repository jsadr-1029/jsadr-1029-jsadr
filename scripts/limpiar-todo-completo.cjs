// Script para limpiar préstamos "TODO COMPLETO" previos (sin pagos programados)
// Uso:
//   node scripts/limpiar-todo-completo.cjs            → limpia TODOS los TODO COMPLETO
//   node scripts/limpiar-todo-completo.cjs 1214731649 → limpia solo los de un cliente por cédula
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

async function main() {
  const cedulaParam = process.argv[2]
  let where = { codigo: { startsWith: 'TODO-COMPLETO-' } }
  if (cedulaParam) {
    where = {
      codigo: { startsWith: 'TODO-COMPLETO-' },
      cliente: { cedula: cedulaParam },
    }
    console.log(`🧹 Limpiando préstamos TODO COMPLETO del cliente cédula ${cedulaParam}...`)
  } else {
    console.log(`🧹 Limpiando TODOS los préstamos TODO COMPLETO...`)
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    include: {
      cliente: { select: { nombre: true, cedula: true } },
      _count: { select: { pagosProgramados: true, pagos: true } },
    },
  })

  console.log(`Préstamos 'TODO COMPLETO' encontrados: ${prestamos.length}`)
  for (const p of prestamos) {
    console.log(`  - ${p.codigo} | cliente=${p.cliente.nombre} (CC ${p.cliente.cedula}) | estado=${p.estado} | pagosProgramados=${p._count.pagosProgramados} | pagos=${p._count.pagos}`)
  }

  for (const p of prestamos) {
    await prisma.pagoProgramado.deleteMany({ where: { prestamoId: p.id } })
    await prisma.prestamo.delete({ where: { id: p.id } })
    console.log(`  ✗ Eliminado: ${p.codigo}`)
  }
  console.log('Limpieza completa.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

