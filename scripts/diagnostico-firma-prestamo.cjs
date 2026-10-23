// Diagnóstico: inspecciona el préstamo ICB-CC-1077430375-20261022-01 y sus firmas
const { Client } = require('pg');

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const codigo = 'ICB-CC-1077430375-20261022-01';

  // 1. Buscar el préstamo
  const prestamoRes = await client.query(`
    SELECT id, codigo, estado, "tycAceptado", "tycFechaAceptacion",
           "firmaId", "tieneCodeudor", "codeudorId", "codeudorEmail",
           "codeudorNombre", "codeudorFirmaId", "clienteId",
           "createdAt", "updatedAt"
    FROM "Prestamo"
    WHERE codigo = $1
    LIMIT 1
  `, [codigo]);

  if (prestamoRes.rows.length === 0) {
    console.log('✗ No se encontró el préstamo con código:', codigo);
    // Buscar préstamos que contengan parte del código
    const partial = await client.query(`
      SELECT id, codigo, estado FROM "Prestamo"
      WHERE codigo ILIKE '%1077430375%' OR codigo ILIKE '%ICB%'
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
  console.log('tycFechaAceptacion:', p.tycFechaAceptacion);
  console.log('firmaId:', p.firmaId);
  console.log('tieneCodeudor:', p.tieneCodeudor);
  console.log('codeudorId:', p.codeudorId);
  console.log('codeudorEmail:', p.codeudorEmail);
  console.log('codeudorNombre:', p.codeudorNombre);
  console.log('codeudorFirmaId:', p.codeudorFirmaId);
  console.log('clienteId:', p.clienteId);
  console.log('createdAt:', p.createdAt);
  console.log('updatedAt:', p.updatedAt);

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

  // 3. Buscar las firmas electrónicas asociadas (deudor y codeudor)
  const firmaIds = [p.firmaId, p.codeudorFirmaId].filter(Boolean);
  if (firmaIds.length > 0) {
    const firmasRes = await client.query(`
      SELECT id, "prestamoId", tipo, "esFirmaCodeudor", "firmanteRol", "firmanteNombre",
             "estadoFirma", "otpEnviado", "otpValidado", "intentosOTP", "maxIntentos",
             "otpFechaEnvio", "fechaFirmaCompleta", "fechaRechazo", "motivoRechazo",
             "fotoDocumento" IS NOT NULL AS tiene_foto_doc,
             "fotoSelfie" IS NOT NULL AS tiene_foto_selfie,
             "imagenFirma" IS NOT NULL AS tiene_imagen_firma,
             "createdAt", "updatedAt"
      FROM "FirmaElectronica"
      WHERE id = ANY($1::text[])
    `, [firmaIds]);

    console.log('\n=== FIRMAS ELECTRÓNICAS ===');
    for (const f of firmasRes.rows) {
      console.log(`\n--- Firma ${f.id} (${f.tipo}) ---`);
      console.log('  esFirmaCodeudor:', f.esFirmaCodeudor);
      console.log('  firmanteRol:', f.firmanteRol);
      console.log('  firmanteNombre:', f.firmanteNombre);
      console.log('  estadoFirma:', f.estadoFirma);
      console.log('  otpEnviado:', f.otpEnviado);
      console.log('  otpValidado:', f.otpValidado);
      console.log('  intentosOTP:', f.intentosOTP, '/', f.maxIntentos);
      console.log('  otpFechaEnvio:', f.otpFechaEnvio);
      console.log('  fechaFirmaCompleta:', f.fechaFirmaCompleta);
      console.log('  fechaRechazo:', f.fechaRechazo);
      console.log('  motivoRechazo:', f.motivoRechazo);
      console.log('  tiene_foto_doc:', f.tiene_foto_doc);
      console.log('  tiene_foto_selfie:', f.tiene_foto_selfie);
      console.log('  tiene_imagen_firma:', f.tiene_imagen_firma);
      console.log('  createdAt:', f.createdAt);
      console.log('  updatedAt:', f.updatedAt);
    }
  } else {
    console.log('\n⚠️ El préstamo NO tiene firmaId ni codeudorFirmaId. Esto significa que NO se ha iniciado el proceso de firma.');
  }

  // 4. Buscar tokens de firma asociados al préstamo
  const tokensRes = await client.query(`
    SELECT id, token, "firmaId", "prestamoId", usado, "fechaExpiracion", "fechaUsado", "createdAt"
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

  // 5. Buscar bitácora del préstamo (últimos 20 eventos)
  const bitacoraRes = await client.query(`
    SELECT id, tipo, descripcion, "fechaEvento", "usuarioId", datos
    FROM "BitacoraPrestamo"
    WHERE "prestamoId" = $1
    ORDER BY "fechaEvento" DESC
    LIMIT 20
  `, [p.id]).catch(() => ({ rows: [] }));

  if (bitacoraRes.rows.length > 0) {
    console.log('\n=== BITÁCORA DEL PRÉSTAMO (últimos 20) ===');
    for (const b of bitacoraRes.rows) {
      console.log(`  [${b.fechaEvento?.toISOString()}] ${b.tipo}: ${b.descripcion}`);
    }
  }

  await client.end();
  console.log('\n=== DIAGNÓSTICO COMPLETADO ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
