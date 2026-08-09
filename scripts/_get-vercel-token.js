const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});
(async () => {
  const ps = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } });
  if (!ps) { console.log('NO HAY VERCEL'); process.exit(0); }
  console.log('Full record:');
  console.log(JSON.stringify(ps, null, 2));
  await prisma.$disconnect();
})();
