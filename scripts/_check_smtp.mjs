import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// All config keys
const all = await client.query(`
  SELECT clave, LEFT(valor, 50) as valor_preview FROM "Configuracion" 
  WHERE clave ILIKE '%SMTP%' OR clave ILIKE '%BREVO%' OR clave ILIKE '%EMAIL%' OR clave ILIKE '%MAIL%'
  ORDER BY clave
`);
console.log('=== Configuración correo ===');
all.rows.forEach(r => console.log(`  ${r.clave}: ${r.valor_preview}...`));

await client.end();
