// Lista últimos envíos de correo para ver qué email se usó como remitente
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const enviosRes = await client.query(`
    SELECT id, "remitenteEmail", destinatario, asunto, estado, "fechaEnvio", "createdAt"
    FROM "EnvioCorreo"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('=== ÚLTIMOS ENVIOS DE CORREO ===');
  for (const e of enviosRes.rows) {
    console.log('  -', e.createdAt, '|', e.remitenteEmail, '→', e.destinatario);
    console.log('    asunto:', e.asunto);
    console.log('    estado:', e.estado);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
