import pkg from 'pg';
const { Client } = pkg;

// Check if we're connected to the right database
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

console.log('=== Current database ===');
const r1 = await client.query('SELECT current_database(), current_schema()');
console.log(JSON.stringify(r1.rows[0]));

console.log('\n=== All schemas ===');
const r2 = await client.query(`
  SELECT schema_name FROM information_schema.schemata 
  WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
`);
console.log(r2.rows.map(r => r.schema_name));

console.log('\n=== Tables in public schema ===');
const r3 = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);
console.log(r3.rows.map(r => r.table_name).join(', '));

console.log('\n=== Table sizes ===');
const r4 = await client.query(`
  SELECT relname as table_name, n_live_tup as row_count 
  FROM pg_stat_user_tables 
  ORDER BY n_live_tup DESC
  LIMIT 20
`);
r4.rows.forEach(r => console.log(`  ${r.table_name}: ${r.row_count} rows`));

await client.end();
