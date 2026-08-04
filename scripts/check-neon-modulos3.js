const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  console.log('=== SeguridadModulo (todos los registros) ===');
  const { rows: mods } = await client.query(`SELECT * FROM "SeguridadModulo" ORDER BY "moduloKey" ASC`);
  console.log('Total módulos protegidos:', mods.length, '\n');
  mods.forEach(m => {
    console.log(`  ${m.moduloKey} | ${m.moduloNombre} | protegido=${m.protegido} | clave=${m.claveHash ? 'configurada' : 'NULL'}`);
  });

  // Buscar en Configuracion o ConfiguracionEmpresa algo que mencione módulos
  console.log('\n=== ConfiguracionEmpresa (columnas) ===');
  const { rows: cols1 } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ConfiguracionEmpresa'`);
  console.log(cols1.map(c => c.column_name).join(', '));

  // Buscar variableGlobal con 'modulo' o 'menu' o 'rol'
  console.log('\n=== VariableGlobal con "modulo"/"menu"/"rol"/"permiso" ===');
  const { rows: vg } = await client.query(`SELECT key, value FROM "VariableGlobal" WHERE key ILIKE '%modulo%' OR key ILIKE '%menu%' OR key ILIKE '%rol%' OR key ILIKE '%permiso%' OR key ILIKE '%acceso%' ORDER BY key`);
  vg.forEach(v => console.log(`  ${v.key} = ${v.value ? v.value.substring(0,200) : 'NULL'}`));

  // Buscar en Usuario.permisos los permisos de cada rol
  console.log('\n=== Usuario.permisos (JSON) por rol ===');
  const { rows: users } = await client.query(`SELECT username, rol, permisos FROM "Usuario" ORDER BY rol, username`);
  users.forEach(u => console.log(`  ${u.username} (${u.rol}): ${u.permisos || 'NULL'}`));

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
