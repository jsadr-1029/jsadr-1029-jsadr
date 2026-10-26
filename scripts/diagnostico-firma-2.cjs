// Diagnóstico 2: inspecciona la firma electrónica cmvjue0ul0007jq08u2ejv5uc
// (la que está asociada al token pero no al préstamo)
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const firmaId = 'cmvjue0ul0007jq08u2ejv5uc';

  const res = await client.query(`
    SELECT id, "prestamoId", tipo, "esFirmaCodeudor", "firmanteRol", "firmanteNombre",
           "estadoFirma", "otpEnviado", "otpValidado", "intentosOTP", "maxIntentos",
           "otpFechaEnvio", "fechaFirmaCompleta",
           "fotoDocumento" IS NOT NULL AS tiene_foto_doc,
           "fotoSelfie" IS NOT NULL AS tiene_foto_selfie,
           "imagenFirma" IS NOT NULL AS tiene_imagen_firma,
           "clienteId",
           "createdAt", "updatedAt"
    FROM "FirmaElectronica"
    WHERE id = $1
  `, [firmaId]);

  if (res.rows.length === 0) {
    console.log('✗ No se encontró la firma con ID:', firmaId);
    await client.end();
    return;
  }

  const f = res.rows[0];
  console.log('=== FIRMA ELECTRÓNICA ===');
  console.log('ID:', f.id);
  console.log('prestamoId:', f.prestamoId);
  console.log('tipo:', f.tipo);
  console.log('esFirmaCodeudor:', f.esFirmaCodeudor);
  console.log('firmanteRol:', f.firmanteRol);
  console.log('firmanteNombre:', f.firmanteNombre);
  console.log('estadoFirma:', f.estadoFirma);
  console.log('otpEnviado:', f.otpEnviado);
  console.log('otpValidado:', f.otpValidado);
  console.log('intentosOTP:', f.intentosOTP, '/', f.maxIntentos);
  console.log('otpFechaEnvio:', f.otpFechaEnvio);
  console.log('fechaFirmaCompleta:', f.fechaFirmaCompleta);
  console.log('tiene_foto_doc:', f.tiene_foto_doc);
  console.log('tiene_foto_selfie:', f.tiene_foto_selfie);
  console.log('tiene_imagen_firma:', f.tiene_imagen_firma);
  console.log('clienteId:', f.clienteId);
  console.log('createdAt:', f.createdAt);
  console.log('updatedAt:', f.updatedAt);

  // Verificar si el préstamo coincide
  const prestamoRes = await client.query(`
    SELECT id, codigo, estado, "firmaId"
    FROM "Prestamo"
    WHERE id = $1
  `, [f.prestamoId]);

  if (prestamoRes.rows.length > 0) {
    const p = prestamoRes.rows[0];
    console.log('\n=== PRÉSTAMO ASOCIADO A LA FIRMA ===');
    console.log('ID:', p.id);
    console.log('Código:', p.codigo);
    console.log('Estado:', p.estado);
    console.log('firmaId (en el préstamo):', p.firmaId);
    console.log('¿Coincide firmaId?:', p.firmaId === f.id ? '✓ SÍ' : '✗ NO — ESTO ES EL PROBLEMA');
  }

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
