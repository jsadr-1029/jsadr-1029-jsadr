import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Verify the token is valid (not expired)
const cli = await client.query(`
  SELECT cedula, email, "claveResetToken", "claveResetExpira", 
         NOW() as now,
         "claveResetExpira" > NOW() as token_valido
  FROM "Cliente" WHERE cedula = '1100012073'
`);
console.log('=== Estado token ===');
console.log(JSON.stringify(cli.rows[0], null, 2));

// 2. Probar el endpoint restablecer-clave con el token (solo verificación, no cambiar)
if (cli.rows[0].token_valido) {
  const token = cli.rows[0].claveResetToken;
  console.log('\n=== Probando /api/auth/restablecer-clave (sin cambiar clave) ===');
  // Hacer solo verificación GET si existe
  const res = await fetch(`https://jsadr.com.co/api/auth/restablecer-clave?token=${token}&verificar=1`, {
    headers: { 'Origin': 'https://jsadr.com.co' }
  });
  console.log('Status verificación:', res.status);
  const json = await res.json().catch(() => ({}));
  console.log('Response:', JSON.stringify(json, null, 2));
}

await client.end();
