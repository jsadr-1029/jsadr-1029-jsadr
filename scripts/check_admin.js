const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.usuario.findMany({ select: { id: true, username: true, rol: true, passwordHash: true, activo: true } });
    for (const u of users.slice(0, 10)) {
      console.log(`- ${u.username} | rol=${u.rol} | activo=${u.activo} | hash=${u.passwordHash ? u.passwordHash.substring(0,30)+'...' : 'NULL'}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
