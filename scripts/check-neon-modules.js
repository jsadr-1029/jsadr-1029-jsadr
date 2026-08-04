const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  console.log('=== TABLAS EN NEON ===');
  const { rows: tabs } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  tabs.forEach(t => console.log('  ' + t.table_name));

  console.log('\n=== TABLAS CON "modulo" O "seguridad" ===');
  const { rows: modTabs } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%modulo%' OR table_name ILIKE '%seguridad%' OR table_name ILIKE '%permiso%') ORDER BY table_name`);
  modTabs.forEach(t => console.log('  ' + t.table_name));

  // Buscar contenido de SeguridadModulo si existe
  try {
    console.log('\n=== SeguridadModulo ===');
    const { rows: mods } = await client.query(`SELECT * FROM "SeguridadModulo" ORDER BY "orden" NULLS LAST, nombre ASC`);
    if (mods.length) {
      console.log('Columnas:', Object.keys(mods[0]));
      mods.forEach(m => console.log(JSON.stringify(m)));
    } else {
      console.log('Sin registros');
    }
  } catch(e) { console.log('  (tabla no existe o error:', e.message, ')'); }

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
