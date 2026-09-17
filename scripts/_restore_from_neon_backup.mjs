import pkg from 'pg';
const { Client } = pkg;

// The Neon database was WIPED by `prisma migrate reset --force` earlier.
// We need to check if Vercel has the correct DATABASE_URL env var.
// The production app connects via Vercel's env var, not our .env file.

// Check if Vercel uses a DIFFERENT Neon connection string (maybe a different branch)
console.log('=== Testing Neon connection (pooler) ===');
const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

// Check the actual data
const r = await client.query('SELECT COUNT(*) as c FROM "Prestamo"');
console.log('Prestamo count:', r.rows[0].c);

const r2 = await client.query('SELECT COUNT(*) as c FROM "Cliente"');
console.log('Cliente count:', r2.rows[0].c);

const r3 = await client.query('SELECT COUNT(*) as c FROM "Pago"');
console.log('Pago count:', r3.rows[0].c);

const r4 = await client.query('SELECT COUNT(*) as c FROM "Usuario"');
console.log('Usuario count:', r4.rows[0].c);

const r5 = await client.query('SELECT COUNT(*) as c FROM "CajaMenor"');
console.log('CajaMenor count:', r5.rows[0].c);

const r6 = await client.query('SELECT COUNT(*) as c FROM "CategoriaCliente"');
console.log('CategoriaCliente count:', r6.rows[0].c);

const r7 = await client.query('SELECT COUNT(*) as c FROM "CuentaRecaudo"');
console.log('CuentaRecaudo count:', r7.rows[0].c);

await client.end();

// The production app on Vercel might be using a DIFFERENT DATABASE_URL
// We need to check if Vercel env vars have a different Neon project
console.log('\n=== Checking if production uses a different DB ===');
console.log('The .env file was pointing to a SQLite file that doesnt exist.');
console.log('Vercel should have its own DATABASE_URL env var pointing to Neon.');
console.log('But the Neon DB seems empty (wiped by prisma migrate reset).');
console.log('We need to restore the data from a Neon backup or re-seed.');
