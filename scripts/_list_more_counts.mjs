import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query(`
  SELECT relname as table_name, n_live_tup as row_count 
  FROM pg_stat_user_tables 
  WHERE n_live_tup > 0
  ORDER BY n_live_tup DESC
`);
console.log('=== Tables with data ===');
r.rows.forEach(row => console.log(`  ${row.table_name}: ${row.row_count} rows`));

await client.end();
