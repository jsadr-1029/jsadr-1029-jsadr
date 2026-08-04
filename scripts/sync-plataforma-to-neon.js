// Sincronizar solo PlataformaSync (los cambios recientes) a Neon
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await neonClient.connect();
  console.log('✓ Conectado a Neon\n');
  const cols = ['id','plataforma','nombreMostrar','descripcion','sincronizado','tiempoReal','endpoint','proyectoRef','region','ramaPrincipal','tokenCifrado','webhookSecret','webhookUrl','ultimoSync','ultimoEstado','ultimoError','eventosRecibidos','configJson','createdAt','updatedAt'];

  const rows = await prisma.plataformaSync.findMany();
  await neonClient.query('TRUNCATE TABLE "PlataformaSync" CASCADE');
  for (const r of rows) {
    const sets = cols.map((c,i) => `"${c}"=$${i+1}`).join(', ');
    const params = cols.map(c => r[c] === undefined ? null : (r[c] instanceof Date ? r[c] : r[c]));
    // UPSERT
    const placeholders = cols.map((_,i) => `$${i+1}`).join(', ');
    const colsQuoted = cols.map(c => `"${c}"`).join(', ');
    try {
      await neonClient.query(
        `INSERT INTO "PlataformaSync" (${colsQuoted}) VALUES (${placeholders}) ON CONFLICT (plataforma) DO UPDATE SET ${sets}`,
        [...params, ...params]
      );
      console.log(`  ✅ ${r.plataforma} | sincronizado=${r.sincronizado} | estado=${r.ultimoEstado}`);
    } catch (e) {
      console.log(`  ❌ ${r.plataforma}: ${e.message.split('\n')[0]}`);
    }
  }
  await neonClient.end();
  await prisma.$disconnect();
  console.log('\n✓ PlataformaSync sincronizada a Neon');
})();
