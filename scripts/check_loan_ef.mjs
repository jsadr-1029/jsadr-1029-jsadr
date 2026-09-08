import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// Get all scheduled payments for this loan
const pagos = await client.query(`
  SELECT * FROM "PagoProgramado" WHERE "prestamoId" = 'cmtnf9yph0001l404xpsdc1a9' ORDER BY "numeroCuota"
`);
console.log('\n=== PAGOS PROGRAMADOS ===');
console.log(JSON.stringify(pagos.rows, null, 2));

await client.end();
