import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Verificar el cliente
const cli = await client.query(`
  SELECT cedula, email, "claveResetToken", "claveResetExpira", "debeCambiarClave"
  FROM "Cliente" WHERE cedula = '1100012073'
`);
console.log('=== Cliente actualizado ===');
console.log(JSON.stringify(cli.rows[0], null, 2));

// Buscar logs de recuperación
console.log('\n=== AuditLog reciente ===');
const logs = await client.query(`
  SELECT "accion", "exito", LEFT("errorMessage", 100) as err, "createdAt"
  FROM "AuditLog" 
  WHERE "accion" ILIKE '%RECUPERACION%' OR "accion" ILIKE '%CLAVE%'
  ORDER BY "createdAt" DESC LIMIT 10
`);
logs.rows.forEach(r => console.log(`  ${r.createdAt} | ${r.accion} | exito=${r.exito} | err=${r.err || ''}`));

// Buscar en Configuracion
console.log('\n=== Configuracion: recuperación ===');
const cfg = await client.query(`
  SELECT clave, LEFT(valor, 200) as v, "updatedAt"
  FROM "Configuracion" 
  WHERE clave ILIKE '%RECUPERACION%' OR clave ILIKE '%RESET%'
  ORDER BY "updatedAt" DESC LIMIT 5
`);
cfg.rows.forEach(r => console.log(`  ${r.updatedAt} | ${r.clave} | ${r.v}`));

await client.end();
