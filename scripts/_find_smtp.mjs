import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public', ssl: { rejectUnauthorized: false } });
await client.connect();

// Buscar en todas las tablas posibles
console.log('=== ConexionAPI ===');
const ca = await client.query(`SELECT id, nombre, proveedor, LEFT("configuracion", 100) as cfg FROM "ConexionAPI" WHERE nombre ILIKE '%brevo%' OR nombre ILIKE '%smtp%' OR nombre ILIKE '%email%' OR proveedor ILIKE '%brevo%' OR proveedor ILIKE '%smtp%' LIMIT 5`);
console.log(JSON.stringify(ca.rows, null, 2));

console.log('\n=== Configuracion (todo) ===');
const cfg = await client.query(`SELECT clave, LEFT(valor, 80) as v FROM "Configuracion" WHERE clave ILIKE '%smtp%' OR clave ILIKE '%brevo%' OR clave ILIKE '%email%' OR clave ILIKE '%mail%' LIMIT 10`);
console.log(JSON.stringify(cfg.rows, null, 2));

console.log('\n=== ConfiguracionEmpresa ===');
const ce = await client.query(`SELECT id, nombre, LEFT("smtpHost", 30) as host, "smtpUser", "smtpFrom", "smtpPort" FROM "ConfiguracionEmpresa" LIMIT 5`);
console.log(JSON.stringify(ce.rows, null, 2));

console.log('\n=== PlataformaSync ===');
const ps = await client.query(`SELECT * FROM "PlataformaSync" LIMIT 3`);
console.log(JSON.stringify(ps.rows.map(r => ({...r, configuracion: r.configuracion ? r.configuracion.toString().substring(0, 100) : null})), null, 2));

await client.end();
