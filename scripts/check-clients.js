const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const clientes = await prisma.cliente.findMany({
    select: { cedula: true, nombre: true, activo: true, claveHash: true },
    take: 5
  });
  console.log('Clientes (5):', JSON.stringify(clientes, null, 2));
  const total = await prisma.cliente.count();
  console.log('Total clientes:', total);
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
