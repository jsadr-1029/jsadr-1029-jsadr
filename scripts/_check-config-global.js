const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const models = Object.keys(prisma);
  for (const m of models.sort()) {
    if (m.startsWith('_') || m.startsWith('$')) continue;
    try {
      const count = await prisma[m].count();
      if (count > 0) console.log(`  ${m}: ${count} registros`);
    } catch (e) { /* skip */ }
  }
  // Buscar configuración global con posible api key brevo
  const config = await prisma.configuracionGlobal?.findMany?.() || [];
  console.log('\nConfiguración global:', config.length);
  config.forEach(c => console.log(' ', JSON.stringify(c).substring(0, 200)));
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
