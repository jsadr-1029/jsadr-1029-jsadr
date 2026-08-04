const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

async function main() {
  const recent = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, destinatario: true, asunto: true, estado: true, mensajeError: true, createdAt: true },
  });
  console.log('Recent EnvioCorreo entries:');
  for (const r of recent) {
    console.log(`  ${r.createdAt.toISOString().slice(0,19)} | ${r.estado.padEnd(10)} | ${r.asunto.slice(0,40).padEnd(40)} | err=${r.mensajeError ? r.mensajeError.slice(0,60) : '-'}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
