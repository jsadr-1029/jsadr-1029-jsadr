// Diagnóstico 3: obtener el token completo y probar el endpoint público
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT id, token, "firmaId", "prestamoId", usado, "fechaExpiracion"
    FROM "TokenFirma"
    WHERE "prestamoId" = 'cmvjue0ig0001jq08mxaikzg9'
    ORDER BY "createdAt" DESC
  `);

  for (const t of res.rows) {
    console.log('Token completo:', t.token);
    console.log('firmaId:', t.firmaId);
    console.log('usado:', t.usado);
    console.log('fechaExpiracion:', t.fechaExpiracion);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
