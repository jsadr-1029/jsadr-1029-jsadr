import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Check if usuario has sessionToken column (the snapshot code might reference it)
const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Usuario' ORDER BY ordinal_position`);
console.log('Usuario columns:', cols.rows.map(r => r.column_name).join(', '));

// Check the actual user data
const user = await client.query('SELECT id, username, "passwordHash", email, rol, activo, "intentosFallidos", "bloqueadoHasta", "sessionToken" FROM "Usuario" LIMIT 1');
console.log('\nUser data:', JSON.stringify(user.rows[0], null, 2));

// Check if sessionToken is in the Prisma schema
const schema = require('fs').readFileSync('/home/z/my-project/prisma/schema.prisma', 'utf8');
console.log('\nsessionToken in schema:', schema.includes('sessionToken'));
console.log('claveResetToken in schema:', schema.includes('claveResetToken'));
console.log('debeCambiarClave in schema:', schema.includes('debeCambiarClave'));

await client.end();
