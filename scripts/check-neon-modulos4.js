const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();

  console.log('=== Columnas de VariableGlobal ===');
  const { rows: cols } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='VariableGlobal'`);
  console.log(cols.map(c => c.column_name).join(', '));

  console.log('\n=== Todas las variables globales ===');
  const { rows: vg } = await client.query(`SELECT * FROM "VariableGlobal" ORDER BY 1`);
  vg.forEach(v => {
    const k = v.clave || v.key || v.nombre || JSON.stringify(Object.keys(v));
    const val = v.valor || v.value || JSON.stringify(v).substring(0, 150);
    console.log(`  ${k} = ${val}`);
  });

  // Verificar configuración de modulos por rol en el código fuente
  console.log('\n=== Búsqueda en el código fuente (Sidebar.tsx) ===');
  // Buscar el archivo en el zip extraído
  const fs = require('fs');
  const path = '/tmp/zip_extract/src/components/Sidebar.tsx';
  if (fs.existsSync(path)) {
    const content = fs.readFileSync(path, 'utf8');
    // Buscar todas las entradas del menú
    const menuItems = content.match(/\{[^{]*key:\s*'[^']+'[^}]*\}/g) || [];
    console.log('Entradas de menú encontradas:', menuItems.length);
    menuItems.slice(0, 30).forEach((m, i) => console.log(`  [${i}]`, m.substring(0, 200)));
  } else {
    console.log('Sidebar.tsx no encontrado en zip');
  }

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
