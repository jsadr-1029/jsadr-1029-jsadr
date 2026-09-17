// Debug: run the dashboard queries individually to find which one fails
import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Test 1: cajaMenor with movimientos
try {
  const r = await client.query(`
    SELECT * FROM "CajaMenor" 
    LIMIT 1
  `);
  console.log('✅ CajaMenor query OK, rows:', r.rows.length);
  
  // Test with include movimientos
  const r2 = await client.query(`
    SELECT c.*, COUNT(m.id) as mov_count 
    FROM "CajaMenor" c 
    LEFT JOIN "MovimientoCaja" m ON m."cajaId" = c.id 
    GROUP BY c.id 
    LIMIT 5
  `);
  console.log('✅ CajaMenor with movimientos OK');
} catch (e) {
  console.log('❌ CajaMenor query error:', e.message);
}

// Test 2: categoriaCliente
try {
  const r = await client.query(`
    SELECT * FROM "CategoriaCliente" LIMIT 1
  `);
  console.log('✅ CategoriaCliente OK');
} catch (e) {
  console.log('❌ CategoriaCliente error:', e.message);
}

// Test 3: cuentaRecaudo
try {
  const r = await client.query(`
    SELECT * FROM "CuentaRecaudo" LIMIT 1
  `);
  console.log('✅ CuentaRecaudo OK');
} catch (e) {
  console.log('❌ CuentaRecaudo error:', e.message);
}

// Test 4: casoJuridico with prestamo
try {
  const r = await client.query(`
    SELECT cj.* FROM "CasoJuridico" cj 
    WHERE cj.estado != 'CERRADO' 
    LIMIT 5
  `);
  console.log('✅ CasoJuridico OK, rows:', r.rows.length);
} catch (e) {
  console.log('❌ CasoJuridico error:', e.message);
}

// Test 5: Check if there's a column missing
const cols = await client.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'CajaMenor' ORDER BY ordinal_position
`);
console.log('\nCajaMenor columns:', cols.rows.map(r => r.column_name).join(', '));

const cols2 = await client.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'MovimientoCaja' ORDER BY ordinal_position
`);
console.log('MovimientoCaja columns:', cols2.rows.map(r => r.column_name).join(', '));

await client.end();
