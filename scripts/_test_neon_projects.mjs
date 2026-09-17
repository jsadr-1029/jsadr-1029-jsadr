import pkg from 'pg';
const { Client } = pkg;

// Test BOTH project IDs to find which one has data
const urls = [
  { name: 'rapid-darkness-56995142 (pooler)', url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public' },
  { name: 'rapid-darkness-56995142 (direct)', url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public' },
];

for (const { name, url } of urls) {
  console.log(`\n=== Testing: ${name} ===`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const r = await client.query('SELECT COUNT(*) as c FROM "Prestamo"');
    const r2 = await client.query('SELECT COUNT(*) as c FROM "Cliente"');
    console.log(`  Prestamo: ${r.rows[0].c}, Cliente: ${r2.rows[0].c}`);
    await client.end();
  } catch (e) {
    console.log(`  ❌ ${e.message.substring(0, 100)}`);
    try { await client.end(); } catch {}
  }
}
