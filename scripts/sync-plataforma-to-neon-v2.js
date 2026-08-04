const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const cols = ['id','plataforma','nombreMostrar','descripcion','sincronizado','tiempoReal','endpoint','proyectoRef','region','ramaPrincipal','tokenCifrado','webhookSecret','webhookUrl','ultimoSync','ultimoEstado','ultimoError','eventosRecibidos','configJson','createdAt','updatedAt'];

(async () => {
  await neonClient.connect();
  console.log('✓ Conectado a Neon\n');

  const rows = await prisma.plataformaSync.findMany();
  // TRUNCATE
  await neonClient.query('TRUNCATE TABLE "PlataformaSync" CASCADE');
  console.log('  TRUNCATE OK\n');

  for (const r of rows) {
    const colsQuoted = cols.map(c => `"${c}"`).join(', ');
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const params = cols.map(c => {
      const v = r[c];
      if (v === undefined) return null;
      if (v instanceof Date) return v;
      return v;
    });
    try {
      await neonClient.query(
        `INSERT INTO "PlataformaSync" (${colsQuoted}) VALUES (${placeholders})`,
        params
      );
      console.log(`  ✅ ${r.plataforma} | sincronizado=${r.sincronizado} | estado=${r.ultimoEstado} | proyectoRef=${r.proyectoRef || '-'}`);
    } catch (e) {
      console.log(`  ❌ ${r.plataforma}: ${e.message.split('\n')[0]}`);
    }
  }

  // Verificación
  const verify = await neonClient.query('SELECT "plataforma", "sincronizado", "ultimoEstado", "proyectoRef" FROM "PlataformaSync" ORDER BY "plataforma"');
  console.log('\n=== VERIFICACIÓN EN NEON ===');
  verify.rows.forEach(r => {
    const flag = r.sincronizado ? '✅' : '⚠️ ';
    console.log(`${flag} ${r.plataforma} | sincronizado=${r.sincronizado} | estado=${r.ultimoEstado} | proyectoRef=${r.proyectoRef || '-'}`);
  });

  await neonClient.end();
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
