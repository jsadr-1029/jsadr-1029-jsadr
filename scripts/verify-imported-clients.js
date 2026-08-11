// Script de verificación: cuenta los clientes en la BD Neon después de la importación.
require('dotenv').config({ path: '.env', override: true })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.cliente.count()
  console.log(`Total clientes en BD: ${total}`)

  const conTasa20 = await prisma.cliente.count({
    where: { tieneTasaPersonalizada: true, tasaPersonalizada: 20.0 },
  })
  console.log(`Clientes con tasa personalizada 20%: ${conTasa20}`)

  const sinReferido = await prisma.cliente.count({
    where: { referidoPorId: null },
  })
  console.log(`Clientes sin referido: ${sinReferido}`)

  const conClaveTemp = await prisma.cliente.count({
    where: { debeCambiarClave: true },
  })
  console.log(`Clientes con debeCambiarClave=true: ${conClaveTemp}`)

  // Mostrar los 5 más recientes
  const recientes = await prisma.cliente.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      nombre: true,
      cedula: true,
      telefono: true,
      email: true,
      tasaPersonalizada: true,
      tieneTasaPersonalizada: true,
      referidoPorId: true,
      debeCambiarClave: true,
      createdAt: true,
    },
  })
  console.log('\n=== 5 clientes más recientes ===')
  recientes.forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.nombre} — cédula ${c.cedula}, tel ${c.telefono}, email ${c.email || 'null'}, ` +
        `tasa=${c.tasaPersonalizada}% (personalizada=${c.tieneTasaPersonalizada}), ` +
        `referido=${c.referidoPorId || 'null'}, debeCambiarClave=${c.debeCambiarClave}`,
    )
  })
}

main().finally(() => prisma.$disconnect())
