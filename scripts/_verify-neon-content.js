const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});
(async () => {
  const bots = await prisma.bot.findMany({ select: { tipo: true, activo: true, nombre: true, auto: true, updatedAt: true } });
  console.log('=== BOTS en Neon:', bots.length, '===');
  for (const b of bots) console.log(`  ${(b.tipo||'').padEnd(20)} | auto=${b.auto?'Y':'N'} | activo=${b.activo?'Y':'N'} | upd=${b.updatedAt.toISOString().slice(0,16)}`);
  
  const faqs = await prisma.faqBot.count();
  console.log('\nFAQBot:', faqs, 'registros');
  
  const configs = await prisma.configBot.count();
  console.log('ConfigBot:', configs, 'registros');
  
  const mem = await prisma.memoriaBot.count();
  const apr = await prisma.aprendizajeBot.count();
  console.log('MemoriaBot:', mem, '| AprendizajeBot:', apr);
  
  await prisma.$disconnect();
})();
