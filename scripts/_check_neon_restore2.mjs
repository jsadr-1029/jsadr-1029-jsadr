import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Check AuditLog columns
const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'AuditLog' ORDER BY ordinal_position`);
console.log('AuditLog columns:', cols.rows.map(r => r.column_name).join(', '));

// Check actual AuditLog data
const r = await client.query('SELECT * FROM "AuditLog" LIMIT 2');
r.rows.forEach(row => {
  console.log('Entry:', JSON.stringify(row).substring(0, 200));
});

// Check Prisma migrations
console.log('\n=== Prisma migrations ===');
const r3 = await client.query('SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5');
r3.rows.forEach(row => {
  console.log(`  ${row.migration_name} | finished: ${row.finished_at} | rolled_back: ${row.rolled_back_at || 'NO'}`);
});

await client.end();
