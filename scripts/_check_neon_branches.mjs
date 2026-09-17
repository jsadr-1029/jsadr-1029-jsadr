import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Check what databases exist
console.log('=== All databases ===');
const r = await client.query(`
  SELECT datname FROM pg_database 
  WHERE datistemplate = false 
  ORDER BY datname
`);
console.log(r.rows.map(row => row.datname));

// Check Neon branch info
console.log('\n=== Neon branch info ===');
try {
  const r2 = await client.query(`
    SELECT current_database(), inet_server_addr(), inet_server_port()
  `);
  console.log(JSON.stringify(r2.rows[0]));
} catch (e) { console.log('Error:', e.message); }

// Check pg_stat for actual data
console.log('\n=== Tables with n_live_tup > 0 ===');
const r3 = await client.query(`
  SELECT relname, n_live_tup 
  FROM pg_stat_user_tables 
  WHERE n_live_tup > 0 
  ORDER BY n_live_tup DESC 
  LIMIT 10
`);
r3.rows.forEach(r => console.log(`  ${r.relname}: ${r.n_live_tup}`));

// Try ANALYZE to update stats
console.log('\n=== Running ANALYZE ===');
try {
  await client.query('ANALYZE');
  console.log('✅ ANALYZE OK');
} catch (e) { console.log('❌:', e.message); }

// Check again after ANALYZE
console.log('\n=== Tables with n_live_tup > 0 after ANALYZE ===');
const r4 = await client.query(`
  SELECT relname, n_live_tup 
  FROM pg_stat_user_tables 
  WHERE n_live_tup > 0 
  ORDER BY n_live_tup DESC 
  LIMIT 10
`);
r4.rows.forEach(r => console.log(`  ${r.relname}: ${r.n_live_tup}`));

await client.end();
