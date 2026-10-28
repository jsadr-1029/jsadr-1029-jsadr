// Revisa el estado de los préstamos PAC y LEO y sus firmas electrónicas
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const codigos = ['PAC-CC-1036671139-20261020-01', 'LEO-CC-1050426060-20261028-01'];

  for (const codigo of codigos) {
    console.log('\n========================================');
    console.log('PRÉSTAMO:', codigo);
    console.log('========================================');

    // Buscar préstamo
    const pRes = await client.query(`
      SELECT id, codigo, estado, "tycAceptado", "firmaId", "clienteId"
      FROM "Prestamo" WHERE codigo = $1
    `, [codigo]);

    if (pRes.rows.length === 0) {
      console.log('  ✗ Préstamo no encontrado');
      continue;
    }

    const p = pRes.rows[0];
    console.log('  Estado:', p.estado);
    console.log('  tycAceptado:', p.tycAceptado);
    console.log('  firmaId:', p.firmaId);

    // Buscar cliente
    const cRes = await client.query(`
      SELECT nombre, cedula, email, telefono FROM "Cliente" WHERE id = $1
    `, [p.clienteId]);
    if (cRes.rows.length > 0) {
      const c = cRes.rows[0];
      console.log('  Cliente:', c.nombre, '|', c.cedula);
      console.log('  Email:', c.email);
      console.log('  Teléfono:', c.telefono);
    }

    // Buscar todas las firmas del préstamo
    const fRes = await client.query(`
      SELECT id, "estadoFirma", "otpEnviado", "otpValidado", "intentosOTP", "maxIntentos",
             "fotoDocumento" IS NOT NULL AS tiene_foto_doc,
             "fotoSelfie" IS NOT NULL AS tiene_foto_selfie,
             "imagenFirma" IS NOT NULL AS tiene_imagen_firma,
             "fechaFirmaCompleta",
             "createdAt", "updatedAt"
      FROM "FirmaElectronica"
      WHERE "prestamoId" = $1
      ORDER BY "createdAt" DESC
    `, [p.id]);

    console.log('\n  FIRMAS ELECTRÓNICAS:', fRes.rows.length);
    for (const f of fRes.rows) {
      console.log('  ---');
      console.log('  ID:', f.id);
      console.log('  estadoFirma:', f.estadoFirma);
      console.log('  otpEnviado:', f.otpEnviado);
      console.log('  otpValidado:', f.otpValidado);
      console.log('  intentosOTP:', f.intentosOTP, '/', f.maxIntentos);
      console.log('  tiene_foto_doc:', f.tiene_foto_doc);
      console.log('  tiene_foto_selfie:', f.tiene_foto_selfie);
      console.log('  tiene_imagen_firma:', f.tiene_imagen_firma);
      console.log('  fechaFirmaCompleta:', f.fechaFirmaCompleta);
      console.log('  createdAt:', f.createdAt);
    }

    // Buscar tokens de firma
    const tRes = await client.query(`
      SELECT id, token, "firmaId", usado, "fechaExpiracion", "fechaUsado"
      FROM "TokenFirma"
      WHERE "prestamoId" = $1
      ORDER BY "createdAt" DESC
    `, [p.id]);

    console.log('\n  TOKENS DE FIRMA:', tRes.rows.length);
    const ahora = new Date();
    for (const t of tRes.rows) {
      const expirado = new Date(t.fechaExpiracion) < ahora;
      console.log('  ---');
      console.log('  Token ID:', t.id);
      console.log('  firmaId:', t.firmaId);
      console.log('  usado:', t.usado);
      console.log('  fechaExpiracion:', t.fechaExpiracion, expirado ? '[EXPIRADO]' : '[VIGENTE]');
      console.log('  fechaUsado:', t.fechaUsado);
      console.log('  token (primeros 30):', t.token?.substring(0, 30) + '...');
    }
  }

  await client.end();
  console.log('\n=== REVISIÓN COMPLETADA ===');
}

main().catch(e => { console.error(e); process.exit(1); });
