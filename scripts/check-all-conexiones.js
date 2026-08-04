const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // Todas las conexiones por tipo
  const grouped = await prisma.conexionAPI.groupBy({
    by: ['tipo', 'activa'],
    _count: true,
  });
  console.log('Conexiones por tipo/activa:', JSON.stringify(grouped, null, 2));
  
  // Buscar cualquier mención a brevo/jsadr/jsa
  const all = await prisma.conexionAPI.findMany();
  console.log('\nTotal conexiones:', all.length);
  all.forEach(c => {
    console.log(`  [${c.tipo}] ${c.nombre} | activa=${c.activa} | user=${c.usuario} | url=${c.url}`);
  });
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
