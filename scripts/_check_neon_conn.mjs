import pkg from 'pg';
const { Client } = pkg;

// Try direct connection (non-pooler)
const urls = [
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
];

for (const url of urls) {
  console.log(`\n=== Testing: ${url.split('@')[1].split('/')[0]} ===`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const r = await client.query('SELECT COUNT(*) as c FROM "Prestamo"');
    console.log(`✅ Prestamo count: ${r.rows[0].c}`);
    
    const r2 = await client.query('SELECT COUNT(*) as c FROM "Cliente"');
    console.log(`✅ Cliente count: ${r2.rows[0].c}`);
    
    await client.end();
  } catch (e) {
    console.log(`❌ ${e.message.substring(0, 200)}`);
    try { await client.end(); } catch {}
  }
}
