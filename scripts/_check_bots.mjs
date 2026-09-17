import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Listar todos los bots
const bots = await client.query(`
  SELECT id, nombre, tipo, descripcion, activo, 
         LENGTH(instrucciones) as len_instrucciones,
         LEFT(instrucciones, 200) as preview
  FROM "Bot" 
  ORDER BY tipo
`);
console.log('=== TODOS LOS BOTS ===');
bots.rows.forEach(b => {
  console.log(`\n${b.tipo} - ${b.nombre} ${b.activo ? '(ACTIVO)' : '(inactivo)'}`);
  console.log(`  Descripción: ${b.descripcion}`);
  console.log(`  Instrucciones length: ${b.len_instrucciones} chars`);
  console.log(`  Preview: ${b.preview?.substring(0, 100)}...`);
});

await client.end();
