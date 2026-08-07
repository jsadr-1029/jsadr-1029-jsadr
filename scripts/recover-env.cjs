/**
 * recover-env.cjs — recupera todos los secretos de la BD Neon y reconstruye .env
 */
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60';
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

(async () => {
  console.log('=== VariableGlobal ===');
  const gv = await prisma.variableGlobal.findMany();
  gv.forEach(v => console.log(`  ${v.clave} = ${(v.valor||'').toString().substring(0, 80)}${(v.valor||'').toString().length > 80 ? '...' : ''}`));
  
  console.log('\n=== PlataformaSync (tokens descifrados NO, solo metadatos) ===');
  const ps = await prisma.plataformaSync.findMany();
  ps.forEach(p => console.log(`  ${p.plataforma}: projectId=${p.projectId} teamId=${p.teamId} alias=${p.alias} tieneToken=${!!p.tokenCifrado} tieneWebhookSecret=${!!p.webhookSecret}`));
  
  console.log('\n=== Configuracion (primeras 30 claves) ===');
  const cfg = await prisma.configuracion.findMany({ take: 30 });
  cfg.forEach(c => console.log(`  ${c.clave} = ${(c.valor||'').toString().substring(0, 80)}${(c.valor||'').toString().length > 80 ? '...' : ''}`));
  
  await prisma.$disconnect();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
