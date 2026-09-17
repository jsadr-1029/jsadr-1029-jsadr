import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });

console.log('=== Waiting for restore to complete (15 seconds) ===');
await new Promise(r => setTimeout(r, 15000));

try {
  await client.connect();
  const r1 = await client.query('SELECT COUNT(*) as c FROM "Prestamo"');
  const r2 = await client.query('SELECT COUNT(*) as c FROM "Cliente"');
  const r3 = await client.query('SELECT COUNT(*) as c FROM "Pago"');
  const r4 = await client.query('SELECT COUNT(*) as c FROM "Usuario"');
  const r5 = await client.query('SELECT COUNT(*) as c FROM "CajaMenor"');
  const r6 = await client.query('SELECT COUNT(*) as c FROM "CategoriaCliente"');
  
  console.log('\n=== DATA RESTORED! ===');
  console.log(`  Prestamos: ${r1.rows[0].c}`);
  console.log(`  Clientes: ${r2.rows[0].c}`);
  console.log(`  Pagos: ${r3.rows[0].c}`);
  console.log(`  Usuarios: ${r4.rows[0].c}`);
  console.log(`  Cajas: ${r5.rows[0].c}`);
  console.log(`  Categorias: ${r6.rows[0].c}`);
  
  // Show some prestamos
  const prestamos = await client.query('SELECT codigo, estado, "saldoTotal" FROM "Prestamo" ORDER BY "createdAt" DESC LIMIT 5');
  console.log('\n=== Últimos préstamos ===');
  prestamos.rows.forEach(p => console.log(`  ${p.codigo} | ${p.estado} | $${p.saldoTotal}`));
  
  await client.end();
} catch (e) {
  console.log('❌ Error:', e.message);
  
  // The branch might still be resetting. Wait more and retry.
  console.log('Retrying in 30 seconds...');
  try { await client.end(); } catch {}
  await new Promise(r => setTimeout(r, 30000));
  
  const client2 = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
  try {
    await client2.connect();
    const r1 = await client2.query('SELECT COUNT(*) as c FROM "Prestamo"');
    const r2 = await client2.query('SELECT COUNT(*) as c FROM "Cliente"');
    console.log(`\n=== DATA RESTORED (after retry)! ===`);
    console.log(`  Prestamos: ${r1.rows[0].c}`);
    console.log(`  Clientes: ${r2.rows[0].c}`);
    await client2.end();
  } catch (e2) {
    console.log('❌ Still failing:', e2.message);
    try { await client2.end(); } catch {}
  }
}
