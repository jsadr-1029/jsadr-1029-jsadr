const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, email: true, rol: true, activo: true },
    orderBy: { rol: 'asc' }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
