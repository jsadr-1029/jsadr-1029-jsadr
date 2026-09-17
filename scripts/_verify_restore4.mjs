import pkg from 'pg';
const { Client } = pkg;

console.log('Waiting 30 seconds...');
await new Promise(r => setTimeout(r, 30000));

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  const tables = ['Prestamo', 'Cliente', 'Pago', 'Usuario', 'CajaMenor', 'CategoriaCliente', 'CuentaRecaudo', 'FirmaElectronica', 'BitacoraPrestamo', 'NotificacionLog', 'AccesoPortal', 'CompromisoPago', 'OtroSiCambioFecha', 'Passkey', 'SecurityEvent', 'DispositivoSesion'];
  
  console.log('=== DATA COUNTS ===');
  let total = 0;
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*) as c FROM "${t}"`);
      const count = parseInt(r.rows[0].c);
      total += count;
      console.log(`  ${t}: ${count}`);
    } catch (e) {
      console.log(`  ${t}: ❌ (tabla no existe)`);
    }
  }
  console.log(`\nTotal rows: ${total}`);
  
  if (total > 20) {
    const r = await client.query('SELECT codigo, estado, "saldoTotal" FROM "Prestamo" ORDER BY "createdAt" DESC LIMIT 10');
    console.log('\n=== Préstamos ===');
    r.rows.forEach(p => console.log(`  ${p.codigo} | ${p.estado} | $${p.saldoTotal}`));
    
    const r2 = await client.query('SELECT nombre, cedula FROM "Cliente" LIMIT 10');
    console.log('\n=== Clientes ===');
    r2.rows.forEach(c => console.log(`  ${c.nombre} | CC ${c.cedula}`));
  }
  
  await client.end();
} catch (e) {
  console.log('❌ Error:', e.message.substring(0, 200));
  try { await client.end(); } catch {}
}
