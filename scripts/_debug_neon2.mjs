import pkg from 'pg';
const { Client, Pool } = pkg;

// Test with Pool (what Prisma uses)
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false },
  max: 1, // single connection
});

// Test running multiple queries on same connection
const client = await pool.connect();
console.log('=== Test 1: Simple count ===');
try {
  const r = await client.query('SELECT COUNT(*) FROM "Prestamo"');
  console.log('✅:', r.rows[0].count);
} catch (e) { console.log('❌:', e.message.substring(0, 200)); }

console.log('\n=== Test 2: Count with JOIN filter ===');
try {
  const r = await client.query(`
    SELECT COUNT(*) FROM "Prestamo" p 
    JOIN "Cliente" c ON c.id = p."clienteId"
    WHERE c."esPrueba" = false AND c.cedula NOT IN ('1214731649')
  `);
  console.log('✅:', r.rows[0].count);
} catch (e) { console.log('❌:', e.message.substring(0, 200)); }

console.log('\n=== Test 3: Same query again (tests cached plan) ===');
try {
  const r = await client.query(`
    SELECT COUNT(*) FROM "Prestamo" p 
    JOIN "Cliente" c ON c.id = p."clienteId"
    WHERE c."esPrueba" = false AND c.cedula NOT IN ('1214731649')
  `);
  console.log('✅:', r.rows[0].count);
} catch (e) { console.log('❌:', e.message.substring(0, 200)); }

console.log('\n=== Test 4: SELECT * (all columns) ===');
try {
  const r = await client.query('SELECT * FROM "Prestamo" LIMIT 1');
  console.log('✅ columns:', Object.keys(r.rows[0]).length);
} catch (e) { console.log('❌:', e.message.substring(0, 200)); }

console.log('\n=== Test 5: SELECT * again (cached plan test) ===');
try {
  const r = await client.query('SELECT * FROM "Prestamo" LIMIT 1');
  console.log('✅ columns:', Object.keys(r.rows[0]).length);
} catch (e) { console.log('❌:', e.message.substring(0, 200)); }

client.release();
await pool.end();
