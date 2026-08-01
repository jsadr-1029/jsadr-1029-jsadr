const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.usuario.findMany({ select: { id: true, username: true, rol: true, activo: true, email: true, cedula: true, nombre: true } });
    console.log('Total usuarios:', users.length);
    for (const u of users) {
      console.log(`- username=${u.username} | rol=${u.rol} | cedula=${u.cedula||'-'} | email=${u.email||'-'} | activo=${u.activo}`);
    }
    // Check if there's a "cliente" table too
    const clientesCount = await prisma.cliente.count().catch(() => 'no tabla');
    console.log('\nClientes count:', clientesCount);
    if (typeof clientesCount === 'number') {
      const muestra = await prisma.cliente.findMany({ take: 5, select: { id: true, cedula: true, nombre: true, pin: true, activo: true } });
      for (const c of muestra) {
        const pinShow = c.pin ? (c.pin.length > 8 ? c.pin.substring(0,8)+'...' : c.pin) : 'NULL';
        console.log(`  Cliente: ${c.nombre} | cedula=${c.cedula} | pin=${pinShow} | activo=${c.activo}`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
