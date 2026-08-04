const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

async function main() {
  const ps = await prisma.plataformaSync.findFirst({ where: { plataforma: 'VERCEL' } });
  console.log('PlataformaSync.VERCEL:');
  console.log('  tokenCifrado:', ps?.tokenCifrado?.slice(0, 30) + '...');
  console.log('  ultimoEstado:', ps?.ultimoEstado);
  console.log('  configJson (first 200):', ps?.configJson?.slice(0, 200));
  await prisma.$disconnect();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
