const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const muestra = await prisma.cliente.findMany({ take: 5, select: { id: true, cedula: true, nombre: true, claveHash: true, pinHash: true, activo: true } });
    for (const c of muestra) {
      const clave = c.claveHash ? c.claveHash.substring(0,15)+'...' : 'NULL';
      const pin = c.pinHash ? c.pinHash.substring(0,15)+'...' : 'NULL';
      console.log(`- ${c.nombre} | cedula=${c.cedula} | claveHash=${clave} | pinHash=${pin} | activo=${c.activo}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
