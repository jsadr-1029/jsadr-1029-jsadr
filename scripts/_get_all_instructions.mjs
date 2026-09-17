import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

const bots = await client.query(`
  SELECT tipo, nombre, descripcion, instrucciones
  FROM "Bot" 
  WHERE activo = true
  ORDER BY tipo
`);

// Print full instructions for each bot
for (const b of bots.rows) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BOT: ${b.tipo} - ${b.nombre}`);
  console.log(`${'='.repeat(80)}`);
  console.log(b.instrucciones);
}

console.log(`\n\n${'='.repeat(80)}`);
console.log(`TOTAL: ${bots.rows.length} bots`);
console.log(`TOTAL CHARS: ${bots.rows.reduce((s, b) => s + b.instrucciones.length, 0)}`);

await client.end();
