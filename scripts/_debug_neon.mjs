import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Try DEALLOCATE ALL to clear cached plans
try {
  await client.query('DEALLOCATE ALL');
  console.log('✅ DEALLOCATE ALL OK');
} catch (e) {
  console.log('❌ DEALLOCATE:', e.message);
}

// Try a simple query
try {
  const r = await client.query('SELECT COUNT(*) FROM "Prestamo"');
  console.log('✅ Simple query:', r.rows[0].count);
} catch (e) {
  console.log('❌ Simple query:', e.message);
}

// Try with the filter that fails
try {
  const r = await client.query(`
    SELECT COUNT(*) FROM "Prestamo" p 
    JOIN "Cliente" c ON c.id = p."clienteId"
    WHERE p.estado = 'EN_MORA' 
    AND c."esPrueba" = false
    AND c.cedula NOT IN ('1214731649')
  `);
  console.log('✅ Filtered query:', r.rows[0].count);
} catch (e) {
  console.log('❌ Filtered query:', e.message);
}

// Check if there are any prepared statements
try {
  const r = await client.query(`
    SELECT * FROM pg_prepared_statements LIMIT 5
  `);
  console.log('✅ Prepared statements:', r.rows.length);
} catch (e) {
  console.log('❌ Prepared statements:', e.message);
}

await client.end();
