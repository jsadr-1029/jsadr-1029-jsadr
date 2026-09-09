import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();
const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Pago' ORDER BY ordinal_position`);
console.log(cols.rows.map(r => r.column_name).join(', '));

// Check if the prestamo was created
const pres = await client.query(`SELECT id, codigo FROM "Prestamo" WHERE id = 'prest-dbce8103571108e7'`);
console.log('\nPrestamo exists:', pres.rows.length > 0);
await client.end();
