const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
  `;
  console.log('Tablas en Neon:', tables.length);
  console.log(tables.map(t => t.tablename).join(', '));
  const memCount = await prisma.memoriaBot.count().catch(() => -1);
  const aprCount = await prisma.aprendizajeBot.count().catch(() => -1);
  console.log('MemoriaBot registros:', memCount);
  console.log('AprendizajeBot registros:', aprCount);
  await prisma.$disconnect();
})();
