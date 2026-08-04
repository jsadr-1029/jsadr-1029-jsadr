const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();
  console.log('=== CUENTAS DE RECAUDO EN NEON (completas) ===');
  const { rows: cuentas } = await client.query(`SELECT * FROM "CuentaRecaudo" ORDER BY codigo ASC`);
  cuentas.forEach(c => console.log(JSON.stringify(c, null, 2)));

  console.log('\n=== CATEGORIAS EN NEON ===');
  const { rows: cats } = await client.query(`SELECT * FROM "CategoriaCliente" ORDER BY codigo ASC`);
  cats.forEach(c => console.log(JSON.stringify(c, null, 2)));

  console.log('\n=== USUARIOS EN NEON ===');
  const { rows: users } = await client.query(`SELECT id, username, nombre, email, rol, cedula, activo, "passwordHash" IS NOT NULL AS has_pass, "claveHash" IS NOT NULL AS has_clave, "mustChangePassword", "intentosFallidos", "bloqueadoHasta" FROM "Usuario" ORDER BY rol, username`);
  users.forEach(u => console.log(JSON.stringify(u)));

  console.log('\n=== CLIENTES EN NEON ===');
  const { rows: clientes } = await client.query(`SELECT nombre, cedula, "bancoCliente", "numeroCuentaCliente", "tipoCuentaCliente", "pinHash" IS NOT NULL AS has_pin, "claveHash" IS NOT NULL AS has_clave FROM "Cliente" ORDER BY nombre`);
  clientes.forEach(c => console.log(JSON.stringify(c)));

  console.log('\n=== TOTALES ===');
  const { rows: p } = await client.query(`SELECT COUNT(*) as n FROM "Prestamo"`);
  const { rows: pa } = await client.query(`SELECT COUNT(*) as n FROM "Pago"`);
  console.log(`  Préstamos: ${p[0].n} | Pagos: ${pa[0].n}`);

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
