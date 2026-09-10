import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar la tabla PlataformaSync o similar
const tabs = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND (table_name ILIKE '%plataforma%' OR table_name ILIKE '%sync%' OR table_name ILIKE '%config%' OR table_name ILIKE '%smtp%' OR table_name ILIKE '%brevo%' OR table_name ILIKE '%conexion%')
  ORDER BY table_name
`);
console.log('Tablas:', tabs.rows.map(r => r.table_name).join(', '));

await client.end();
