import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar ConexionAPI con tipo EMAIL
console.log('=== ConexionAPI tipo EMAIL ===');
const ca = await client.query(`SELECT * FROM "ConexionAPI" WHERE tipo ILIKE '%EMAIL%' OR tipo ILIKE '%SMTP%' OR tipo ILIKE '%BREVO%' LIMIT 5`);
ca.rows.forEach(r => {
  console.log(`  ${r.id} | tipo=${r.tipo}`);
  Object.keys(r).forEach(k => {
    if (r[k] && typeof r[k] === 'string' && r[k].length < 200) console.log(`    ${k}: ${r[k]}`);
    else if (r[k]) console.log(`    ${k}: [${r[k].length} chars]`);
  });
});

// También ConfiguracionEmpresa
console.log('\n=== ConfiguracionEmpresa ===');
const ce = await client.query(`SELECT * FROM "ConfiguracionEmpresa" LIMIT 1`);
if (ce.rows.length > 0) {
  const r = ce.rows[0];
  Object.keys(r).forEach(k => {
    if (r[k] && typeof r[k] === 'string' && r[k].length < 100) console.log(`  ${k}: ${r[k]}`);
  });
} else {
  console.log('Sin filas');
}

await client.end();
