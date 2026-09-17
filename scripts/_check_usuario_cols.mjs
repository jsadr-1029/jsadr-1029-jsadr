import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const cols = await client.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'Usuario' ORDER BY ordinal_position
`);
console.log('Usuario columns:', cols.rows.map(r => r.column_name).join(', '));

const user = await client.query('SELECT * FROM "Usuario" LIMIT 1');
if (user.rows.length > 0) {
  console.log('\nUser exists:', user.rows[0].username);
  console.log('Has passwordHash:', !!user.rows[0].passwordHash);
  console.log('Has email:', !!user.rows[0].email);
}

await client.end();
