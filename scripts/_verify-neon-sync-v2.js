/**
 * Verificación de sincronización Neon DB (v2 - con tablas correctas PascalCase)
 */
const { Client } = require('pg');

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await neonClient.connect();
  console.log('🔌 Conexión a Neon OK\n');
  
  // Listar todas las tablas
  const tablasRes = await neonClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  
  console.log(`📋 Tablas en Neon: ${tablasRes.rows.length}\n`);
  console.log('Tabla'.padEnd(40) + 'Registros'.padStart(12));
  console.log('-'.repeat(55));
  
  let total = 0;
  let vacias = 0;
  
  for (const r of tablasRes.rows) {
    const tabla = r.table_name;
    try {
      const countRes = await neonClient.query(`SELECT COUNT(*)::int as c FROM "${tabla}"`);
      const count = countRes.rows[0].c;
      total += count;
      if (count === 0) vacias++;
      console.log(tabla.padEnd(40) + String(count).padStart(12));
    } catch (e) {
      console.log(tabla.padEnd(40) + 'ERROR'.padStart(12));
    }
  }
  
  console.log('-'.repeat(55));
  console.log('TOTAL'.padEnd(40) + String(total).padStart(12));
  
  // Verificar usuarios admin
  console.log('\n👤 Usuarios en sistema:');
  const users = await neonClient.query('SELECT username, rol, "activo" FROM "Usuario" LIMIT 10');
  for (const u of users.rows) {
    console.log(`  - ${u.username} (${u.rol}) ${u.activo ? '✓' : '✗'}`);
  }
  
  // Verificar clientes
  console.log('\n👥 Clientes (primeros 5):');
  const clientes = await neonClient.query('SELECT nombre, cedula, telefono FROM "Cliente" LIMIT 5');
  for (const c of clientes.rows) {
    console.log(`  - ${c.nombre} | ${c.cedula} | ${c.telefono}`);
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`  - Total tablas: ${tablasRes.rows.length}`);
  console.log(`  - Total registros: ${total}`);
  console.log(`  - Tablas vacías: ${vacias}`);
  
  await neonClient.end();
  console.log('\n✅ Neon DB operativa y con datos.');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
