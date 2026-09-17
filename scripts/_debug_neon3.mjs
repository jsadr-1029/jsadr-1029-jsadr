import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

console.log('=== Test SELECT * FROM Prestamo ===');
try {
  const r = await client.query('SELECT * FROM "Prestamo" LIMIT 1');
  if (r.rows.length > 0) {
    console.log('✅ columns:', Object.keys(r.rows[0]).length);
    console.log('  codigo:', r.rows[0].codigo);
  } else {
    console.log('✅ No rows (table is empty)');
  }
} catch (e) { console.log('❌:', e.message); }

console.log('\n=== Test SELECT * FROM Prestamo again ===');
try {
  const r = await client.query('SELECT * FROM "Prestamo" LIMIT 1');
  if (r.rows.length > 0) {
    console.log('✅ columns:', Object.keys(r.rows[0]).length);
  } else {
    console.log('✅ No rows');
  }
} catch (e) { console.log('❌:', e.message); }

// Check all tables count
console.log('\n=== Table counts ===');
const tables = ['Prestamo', 'Cliente', 'Pago', 'CajaMenor', 'CategoriaCliente', 'CuentaRecaudo', 'Passkey', 'DispositivoSesion', 'SecurityEvent'];
for (const t of tables) {
  try {
    const r = await client.query(`SELECT COUNT(*) as c FROM "${t}"`);
    console.log(`  ${t}: ${r.rows[0].c}`);
  } catch (e) {
    console.log(`  ${t}: ❌ ${e.message.substring(0, 100)}`);
  }
}

await client.end();
