const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, username: true, rol: true, passwordHash: true, activo: true, intentosFallidos: true, bloqueadoHasta: true, mustChangePassword: true }
    });
    for (const u of users) {
      console.log(`- ${u.username} | rol=${u.rol} | activo=${u.activo} | intentos=${u.intentosFallidos} | bloqueadoHasta=${u.bloqueadoHasta||'no'} | hash=${u.passwordHash}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
