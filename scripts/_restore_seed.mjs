import pkg from 'pg';
import crypto from 'crypto';
const { Client } = pkg;

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
  ssl: { rejectUnauthorized: false }
});
await client.connect();

console.log('=== Restoring essential seed data to Neon ===\n');

// 1. Create admin user
const adminId = 'admin-jsadr-' + crypto.randomBytes(4).toString('hex');
const bcrypt = await import('bcrypt');
const adminPassHash = await bcrypt.hash('Js951029*', 12);

await client.query(`
  INSERT INTO "Usuario" (id, username, passwordhash, nombre, rol, activo, "createdAt", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET passwordhash = $3, "updatedAt" = NOW()
`, [adminId, 'Js1214731649', adminPassHash, 'Johan Sebastian Alvarez Del Rio', 'ADMIN']);
console.log('✅ Admin user created/updated');

// 2. Create categories
const cats = [
  { codigo: 'CAT-1', nombre: 'Categoría Básica', montoMin: 50000, montoMax: 500000, tasa: 300 },
  { codigo: 'CAT-2', nombre: 'Categoría Intermedia', montoMin: 500000, montoMax: 2000000, tasa: 240 },
  { codigo: 'CAT-3', nombre: 'Categoría Ejecutiva', montoMin: 2000000, montoMax: 5000000, tasa: 180 },
  { codigo: 'CAT-4', nombre: 'Categoría Premium', montoMin: 5000000, montoMax: 10000000, tasa: 150 },
];

for (const c of cats) {
  const id = 'cat-' + c.codigo.toLowerCase() + '-' + crypto.randomBytes(4).toString('hex');
  await client.query(`
    INSERT INTO "CategoriaCliente" (id, codigo, nombre, "montoMinimo", "montoMaximo", "tasaInteresAnual", "tasaMoraAnual", activa, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, 365, true, NOW(), NOW())
    ON CONFLICT (codigo) DO UPDATE SET nombre = $3, "montoMinimo" = $4, "montoMaximo" = $5, "tasaInteresAnual" = $6, "updatedAt" = NOW()
  `, [id, c.codigo, c.nombre, c.montoMin, c.montoMax, c.tasa]);
}
console.log('✅ Categories created (4 categorías)');

// 3. Create bank accounts
const cuentas = [
  { codigo: 'CTA-1', nombre: 'Bancolombia Ahorros', banco: 'Bancolombia', tipo: 'AHORROS', numero: '2061620839' },
  { codigo: 'CTA-2', nombre: 'Bancolombia Corriente', banco: 'Bancolombia', tipo: 'CORRIENTE', numero: '0000000000' },
  { codigo: 'CTA-3', nombre: 'Nequi', banco: 'Nequi', tipo: 'AHORROS', numero: '3000000000' },
  { codigo: 'CTA-4', nombre: 'Daviplata', banco: 'Daviplata', tipo: 'AHORROS', numero: '3000000001' },
];

for (const c of cuentas) {
  const id = 'cta-' + c.codigo.toLowerCase() + '-' + crypto.randomBytes(4).toString('hex');
  await client.query(`
    INSERT INTO "CuentaRecaudo" (id, codigo, nombre, banco, "tipoCuenta", "numeroCuenta", activa, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
    ON CONFLICT (codigo) DO UPDATE SET nombre = $3, banco = $4, "tipoCuenta" = $5, "numeroCuenta" = $6, "updatedAt" = NOW()
  `, [id, c.codigo, c.nombre, c.banco, c.tipo, c.numero]);
}
console.log('✅ Bank accounts created (4 cuentas)');

// 4. Link categories to accounts
const cat1 = await client.query('SELECT id FROM "CategoriaCliente" WHERE codigo = $1', ['CAT-1']);
const cat2 = await client.query('SELECT id FROM "CategoriaCliente" WHERE codigo = $1', ['CAT-2']);
const cat3 = await client.query('SELECT id FROM "CategoriaCliente" WHERE codigo = $1', ['CAT-3']);
const cat4 = await client.query('SELECT id FROM "CategoriaCliente" WHERE codigo = $1', ['CAT-4']);
const cta1 = await client.query('SELECT id FROM "CuentaRecaudo" WHERE codigo = $1', ['CTA-1']);
const cta2 = await client.query('SELECT id FROM "CuentaRecaudo" WHERE codigo = $1', ['CTA-2']);
const cta3 = await client.query('SELECT id FROM "CuentaRecaudo" WHERE codigo = $1', ['CTA-3']);
const cta4 = await client.query('SELECT id FROM "CuentaRecaudo" WHERE codigo = $1', ['CTA-4']);

await client.query('UPDATE "CategoriaCliente" SET "cuentaRecaudoId" = $1 WHERE codigo = $2', [cta1.rows[0].id, 'CAT-1']);
await client.query('UPDATE "CategoriaCliente" SET "cuentaRecaudoId" = $1 WHERE codigo = $2', [cta2.rows[0].id, 'CAT-2']);
await client.query('UPDATE "CategoriaCliente" SET "cuentaRecaudoId" = $1 WHERE codigo = $2', [cta3.rows[0].id, 'CAT-3']);
await client.query('UPDATE "CategoriaCliente" SET "cuentaRecaudoId" = $1 WHERE codigo = $2', [cta4.rows[0].id, 'CAT-4']);
console.log('✅ Categories linked to accounts');

// 5. Create caja menor entries
const cajas = [
  { codigo: 'CAJA-MORA', nombre: 'Caja de Mora', saldo: 0 },
  { codigo: 'CAJA-GARANTIA', nombre: 'Caja de Garantía', saldo: 0 },
  { codigo: 'CAJA-FLEXIBILIDAD', nombre: 'Caja de Flexibilidad Financiera', saldo: 0 },
  { codigo: 'CAJA-INGRESOS-CAUSADOS', nombre: 'Caja de Ingresos Causados', saldo: 0 },
  { codigo: 'CAJA-PAGARE-CARTA', nombre: 'Caja de Pagaré y Carta', saldo: 0 },
  { codigo: 'CAJA-USO-PLATAFORMA', nombre: 'Caja de Uso de Plataforma', saldo: 0 },
  { codigo: 'CAJA-RENOVACIONES', nombre: 'Caja de Renovaciones', saldo: 0 },
];

for (const c of cajas) {
  const id = 'caja-' + c.codigo.toLowerCase() + '-' + crypto.randomBytes(4).toString('hex');
  await client.query(`
    INSERT INTO "CajaMenor" (id, codigo, nombre, "saldoActual", "totalIngresos", "totalEgresos", activa, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, 0, 0, true, NOW(), NOW())
    ON CONFLICT (codigo) DO UPDATE SET nombre = $3, "updatedAt" = NOW()
  `, [id, c.codigo, c.nombre, c.saldo]);
}
console.log(`✅ Cajas created (${cajas.length} cajas)`);

// 6. Create ConfigMantenimiento
await client.query(`
  INSERT INTO "ConfigMantenimiento" (id, activo, "permitirAdmin", "mensajeTitulo", "mensajeCuerpo", "createdAt", "updatedAt")
  VALUES ('config-maint-' || gen_random_uuid()::text, false, true, 'Sistema en mantenimiento', 'Estamos realizando mejoras. Volveremos pronto.', NOW(), NOW())
  ON CONFLICT DO NOTHING
`);
console.log('✅ ConfigMantenimiento created');

// Verify
const counts = await client.query(`
  SELECT 
    (SELECT COUNT(*) FROM "Usuario") as users,
    (SELECT COUNT(*) FROM "CategoriaCliente") as cats,
    (SELECT COUNT(*) FROM "CuentaRecaudo") as cuentas,
    (SELECT COUNT(*) FROM "CajaMenor") as cajas
`);
console.log('\n=== Verification ===');
console.log(`  Usuarios: ${counts.rows[0].users}`);
console.log(`  Categorias: ${counts.rows[0].cats}`);
console.log(`  Cuentas: ${counts.rows[0].cuentas}`);
console.log(`  Cajas: ${counts.rows[0].cajas}`);

await client.end();
console.log('\n✅ Seed data restored to Neon');
