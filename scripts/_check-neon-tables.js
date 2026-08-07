/**
 * Verificar tablas que SÍ existen en Neon
 */
const { Client } = require('pg');

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await neonClient.connect();
  console.log('📋 Tablas en Neon DB:\n');
  
  const res = await neonClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  
  if (res.rows.length === 0) {
    console.log('  ⚠️  NO HAY NINGUNA TABLA en el schema public.');
    console.log('  Necesitamos crear el schema con prisma db push.');
  } else {
    console.log(`Total: ${res.rows.length} tablas\n`);
    for (const r of res.rows) {
      console.log(`  - ${r.table_name}`);
    }
  }
  
  // Verificar tamaños
  const sizeRes = await neonClient.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size;
  `);
  console.log(`\n💾 Tamaño total DB: ${sizeRes.rows[0].size}`);
  
  await neonClient.end();
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
