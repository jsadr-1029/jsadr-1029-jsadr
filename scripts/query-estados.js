const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const counts = await prisma.prestamo.groupBy({
    by: ['estado'],
    _count: true,
  });
  console.log('Estados de préstamos:', JSON.stringify(counts, null, 2));

  // Pendientes específicamente
  const pendientes = await prisma.prestamo.findMany({
    where: { 
      OR: [
        { estado: 'PENDIENTE_ACEPTACION' },
        { estado: { contains: 'PENDIENTE' } }
      ]
    },
    include: {
      cliente: { select: { id: true, nombre: true, email: true, telefono: true, cedula: true } }
    },
    take: 50,
  });
  console.log('\nPréstamos pendientes:', pendientes.length);
  pendientes.forEach(p => {
    console.log(`  - ${p.codigo} | estado=${p.estado} | tycEnviado=${p.tycEnviado} | cliente=${p.cliente?.nombre} | email=${p.cliente?.email} | telefono=${p.cliente?.telefono}`);
  });
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
