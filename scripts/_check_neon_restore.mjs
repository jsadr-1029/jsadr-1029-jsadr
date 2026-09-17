import pkg from 'pg';
const { Client } = pkg;

// Check if Neon has any restore points or history
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Check AuditLog (the only table with data)
console.log('=== AuditLog entries ===');
const r = await client.query('SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 5');
r.rows.forEach(row => {
  console.log(`  ${row.createdAt} | ${row.accion} | ${row.entidadNombre || 'N/A'}`);
});

// Check ConfigMantenimiento
console.log('\n=== ConfigMantenimiento ===');
const r2 = await client.query('SELECT * FROM "ConfigMantenimiento" LIMIT 1');
console.log(JSON.stringify(r2.rows[0], null, 2));

// Check if there are any _prisma_migrations
console.log('\n=== Prisma migrations ===');
const r3 = await client.query('SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5');
r3.rows.forEach(row => {
  console.log(`  ${row.migration_name} | ${row.finished_at} | ${row.rolled_back_at ? 'ROLLED BACK' : 'OK'}`);
});

await client.end();
