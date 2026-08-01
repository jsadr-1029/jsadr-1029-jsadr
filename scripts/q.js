const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const p = await prisma.prestamo.findFirst({ orderBy: { fechaSolicitud: 'desc' }, select: { id: true, codigo: true, tieneCodeudor: true, cliente: { select: { nombre: true } } } });
  console.log(JSON.stringify(p, null, 2));
  await prisma.$disconnect();
})();
