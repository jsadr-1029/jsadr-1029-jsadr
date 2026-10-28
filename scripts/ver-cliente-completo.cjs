// Ver todos los campos del cliente Luz enith Ortega (1050426060)
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT * FROM "Cliente" WHERE cedula = $1
  `, ['1050426060']);

  if (res.rows.length === 0) {
    console.log('No encontrado');
    await client.end();
    return;
  }

  const c = res.rows[0];
  console.log('=== TODOS LOS CAMPOS DEL CLIENTE ===');
  for (const [key, value] of Object.entries(c)) {
    if (typeof value === 'string' && value.length > 100) {
      console.log(`  ${key}: ${value.substring(0, 100)}... (longitud: ${value.length})`);
    } else {
      console.log(`  ${key}:`, value);
    }
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
