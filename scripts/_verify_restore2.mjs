import pkg from 'pg';
const { Client } = pkg;

console.log('Waiting 20 seconds for restore to complete...');
await new Promise(r => setTimeout(r, 20000));

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  const r1 = await client.query('SELECT COUNT(*) as c FROM "Prestamo"');
  const r2 = await client.query('SELECT COUNT(*) as c FROM "Cliente"');
  const r3 = await client.query('SELECT COUNT(*) as c FROM "Pago"');
  const r4 = await client.query('SELECT COUNT(*) as c FROM "Usuario"');
  
  console.log('\n=== DATA RESTORED! ===');
  console.log(`  Prestamos: ${r1.rows[0].c}`);
  console.log(`  Clientes: ${r2.rows[0].c}`);
  console.log(`  Pagos: ${r3.rows[0].c}`);
  console.log(`  Usuarios: ${r4.rows[0].c}`);
  
  if (parseInt(r1.rows[0].c) > 0) {
    const prestamos = await client.query('SELECT codigo, estado, "saldoTotal" FROM "Prestamo" ORDER BY "createdAt" DESC LIMIT 10');
    console.log('\n=== Últimos préstamos ===');
    prestamos.rows.forEach(p => console.log(`  ${p.codigo} | ${p.estado} | $${p.saldoTotal}`));
  }
  
  await client.end();
} catch (e) {
  console.log('❌ Error (branch may still be resetting):', e.message.substring(0, 200));
  console.log('Waiting 30 more seconds...');
  try { await client.end(); } catch {}
  await new Promise(r => setTimeout(r, 30000));
  
  const client2 = new Client({ 
    connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client2.connect();
    const r1 = await client2.query('SELECT COUNT(*) as c FROM "Prestamo"');
    const r2 = await client2.query('SELECT COUNT(*) as c FROM "Cliente"');
    const r3 = await client2.query('SELECT COUNT(*) as c FROM "Pago"');
    console.log(`\n=== DATA RESTORED (after retry)! ===`);
    console.log(`  Prestamos: ${r1.rows[0].c}`);
    console.log(`  Clientes: ${r2.rows[0].c}`);
    console.log(`  Pagos: ${r3.rows[0].c}`);
    
    if (parseInt(r1.rows[0].c) > 0) {
      const prestamos = await client2.query('SELECT codigo, estado, "saldoTotal" FROM "Prestamo" ORDER BY "createdAt" DESC LIMIT 10');
      console.log('\n=== Últimos préstamos ===');
      prestamos.rows.forEach(p => console.log(`  ${p.codigo} | ${p.estado} | $${p.saldoTotal}`));
    }
    await client2.end();
  } catch (e2) {
    console.log('❌ Still failing:', e2.message.substring(0, 200));
    try { await client2.end(); } catch {}
  }
}
