const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  console.log('=== SeguridadModulo (estructura completa) ===');
  const { rows: cols } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='SeguridadModulo' ORDER BY ordinal_position`);
  cols.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));

  console.log('\n=== DATOS DE SeguridadModulo ===');
  const { rows: mods } = await client.query(`SELECT * FROM "SeguridadModulo" ORDER BY "orden" NULLS LAST, nombre ASC`);
  console.log('Total:', mods.length, 'módulos');
  mods.forEach(m => console.log(JSON.stringify(m, null, 2)));

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
