// Lista todas las CorreoInstitucional disponibles
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT id, nombre, email, estado, "esPrincipal", "smtpHost", "smtpUser"
    FROM "CorreoInstitucional"
    ORDER BY "esPrincipal" DESC, prioridad ASC
  `);

  console.log('=== CORREOS INSTITUCIONALES ===');
  for (const c of res.rows) {
    console.log('  -', c.nombre, '|', c.email, '|', c.estado, '| principal:', c.esPrincipal);
    console.log('    smtpHost:', c.smtpHost, '| smtpUser:', c.smtpUser);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
