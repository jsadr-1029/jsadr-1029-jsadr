// Diagnóstico: inspecciona el préstamo PAC-CC-1036671139-20261020-01
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const codigo = 'PAC-CC-1036671139-20261020-01';

  // 1. Buscar el préstamo
  const prestamoRes = await client.query(`
    SELECT id, codigo, estado, "tycAceptado", "firmaId", "tieneCodeudor",
           "codeudorId", "codeudorEmail", "codeudorNombre", "codeudorFirmaId",
           "clienteId", "createdAt"
    FROM "Prestamo"
    WHERE codigo = $1
    LIMIT 1
  `, [codigo]);

  if (prestamoRes.rows.length === 0) {
    console.log('✗ No se encontró el préstamo con código:', codigo);
    // Buscar préstamos que contengan parte del código
    const partial = await client.query(`
      SELECT id, codigo, estado FROM "Prestamo"
      WHERE codigo ILIKE '%1036671139%' OR codigo ILIKE '%PAC%'
      ORDER BY "createdAt" DESC LIMIT 10
    `);
    console.log('\nPréstamos relacionados:');
    for (const r of partial.rows) {
      console.log(`  - ${r.codigo} | estado: ${r.estado}`);
    }
    await client.end();
    return;
  }

  const p = prestamoRes.rows[0];
  console.log('=== PRÉSTAMO ENCONTRADO ===');
  console.log('ID:', p.id);
  console.log('Código:', p.codigo);
  console.log('Estado:', p.estado);
  console.log('tycAceptado:', p.tycAceptado);
  console.log('firmaId:', p.firmaId);
  console.log('tieneCodeudor:', p.tieneCodeudor);
  console.log('codeudorEmail:', p.codeudorEmail);
  console.log('codeudorNombre:', p.codeudorNombre);
  console.log('clienteId:', p.clienteId);
  console.log('createdAt:', p.createdAt);

  // 2. Buscar datos del cliente
  const clienteRes = await client.query(`
    SELECT id, nombre, cedula, email, telefono
    FROM "Cliente"
    WHERE id = $1
    LIMIT 1
  `, [p.clienteId]);

  if (clienteRes.rows.length > 0) {
    const c = clienteRes.rows[0];
    console.log('\n=== CLIENTE ===');
    console.log('Nombre:', c.nombre);
    console.log('Cédula:', c.cedula);
    console.log('Email:', c.email);
    console.log('Teléfono:', c.telefono);
  }

  // 3. Buscar tokens de firma asociados al préstamo
  const tokensRes = await client.query(`
    SELECT id, token, "firmaId", usado, "fechaExpiracion", "fechaUsado", "createdAt"
    FROM "TokenFirma"
    WHERE "prestamoId" = $1
    ORDER BY "createdAt" DESC
  `, [p.id]);

  console.log('\n=== TOKENS DE FIRMA ===');
  if (tokensRes.rows.length === 0) {
    console.log('  No hay tokens de firma asociados a este préstamo.');
  } else {
    for (const t of tokensRes.rows) {
      const ahora = new Date();
      const expirado = new Date(t.fechaExpiracion) < ahora;
      console.log(`\n--- Token ${t.id} ---`);
      console.log('  token (primeros 20):', t.token?.substring(0, 20) + '...');
      console.log('  firmaId:', t.firmaId);
      console.log('  usado:', t.usado);
      console.log('  fechaExpiracion:', t.fechaExpiracion, expirado ? '[EXPIRADO]' : '[VIGENTE]');
      console.log('  fechaUsado:', t.fechaUsado);
      console.log('  createdAt:', t.createdAt);
    }
  }

  await client.end();
  console.log('\n=== DIAGNÓSTICO COMPLETADO ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
