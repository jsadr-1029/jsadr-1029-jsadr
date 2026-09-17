import pkg from 'pg';
const { Client } = pkg;

console.log('Waiting 30 seconds for restore to complete...');
await new Promise(r => setTimeout(r, 30000));

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  const tables = ['Prestamo', 'Cliente', 'Pago', 'Usuario', 'CajaMenor', 'CategoriaCliente', 'CuentaRecaudo', 'NotificacionLog', 'FirmaElectronica'];
  
  console.log('\n=== DATA COUNTS ===');
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*) as c FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].c}`);
    } catch (e) {
      console.log(`  ${t}: ❌ ${e.message.substring(0, 50)}`);
    }
  }
  
  // Show some data
  const r = await client.query('SELECT codigo, estado, "saldoTotal" FROM "Prestamo" ORDER BY "createdAt" DESC LIMIT 10');
  console.log('\n=== Préstamos ===');
  r.rows.forEach(p => console.log(`  ${p.codigo} | ${p.estado} | $${p.saldoTotal}`));
  
  const r2 = await client.query('SELECT nombre, cedula, activo FROM "Cliente" LIMIT 10');
  console.log('\n=== Clientes ===');
  r2.rows.forEach(c => console.log(`  ${c.nombre} | CC ${c.cedula} | ${c.activo ? 'Activo' : 'Inactivo'}`));
  
  await client.end();
} catch (e) {
  console.log('❌ Error:', e.message.substring(0, 200));
  try { await client.end(); } catch {}
}
