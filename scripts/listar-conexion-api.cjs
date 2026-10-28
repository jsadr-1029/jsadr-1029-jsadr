// Lista TODOS los registros de ConexionAPI y busca cualquier campo con 'brevo' o 'smtp'
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`SELECT COUNT(*)::int AS n FROM "ConexionAPI"`);
  console.log('Total ConexionAPI:', res.rows[0].n);

  const all = await client.query(`SELECT * FROM "ConexionAPI" LIMIT 50`);
  console.log('Registros:');
  for (const r of all.rows) {
    console.log('  ---', r.id, '---');
    console.log('    nombre:', r.nombre);
    console.log('    tipo:', r.tipo);
    console.log('    url:', r.url);
    console.log('    apiKey:', r.apiKey ? `[${r.apiKey.length} chars]` : 'null');
    console.log('    apiSecret:', r.apiSecret ? `[${r.apiSecret.length} chars]` : 'null');
    console.log('    usuario:', r.usuario);
    console.log('    password:', r.password ? `[${r.password.length} chars]` : 'null');
    console.log('    activa:', r.activa);
    console.log('    probada:', r.probada);
  }

  // Buscar en EnvioCorreo los últimos envíos para ver qué correo se usó
  const enviosRes = await client.query(`
    SELECT id, "correoInstitucionalId", para, asunto, estado, "createdAt"
    FROM "EnvioCorreo"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('\n=== ÚLTIMOS ENVIOS DE CORREO ===');
  for (const e of enviosRes.rows) {
    console.log('  -', e.createdAt, '|', e.para, '|', e.asunto, '|', e.estado);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
