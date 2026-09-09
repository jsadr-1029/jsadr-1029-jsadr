import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`DELETE FROM "Pago" WHERE "prestamoId" = 'prest-dbce8103571108e7'`);
await client.query(`DELETE FROM "Prestamo" WHERE id = 'prest-dbce8103571108e7'`);
console.log('Limpieza OK');
await client.end();
