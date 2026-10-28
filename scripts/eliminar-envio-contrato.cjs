// Elimina cualquier registro de envío de firma del contrato CONTR-20261028-001
// Restablece el documento legal a estado ENVIADO_CONDUCTOR (pendiente de envío manual)
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== ELIMINANDO REGISTROS DE ENVÍO DEL CONTRATO CTR-20261028-000001 ===\n');

  // 1. Buscar el documento legal
  const docRes = await client.query(`
    SELECT id, "numeroContrato", estado,
           "conductorToken", "conductorTokenExpira",
           "propietarioToken", "propietarioTokenExpira",
           "conductorOtpValidado",
           "conductorFechaFirma", "propietarioFechaFirma",
           "conductorFotoCedulaFrente" IS NOT NULL AS tiene_foto_doc,
           "conductorFotoSelfie" IS NOT NULL AS tiene_foto_selfie,
           "conductorFirmaManuscrita" IS NOT NULL AS tiene_firma_manuscrita,
           "propietarioFotoCedulaFrente" IS NOT NULL AS prop_tiene_foto_doc,
           "propietarioFirmaManuscrita" IS NOT NULL AS prop_tiene_firma
    FROM "ContratoDocumentoVehiculo"
    WHERE "numeroContrato" = 'CTR-20261028-000001'
       OR "contratoVehiculoId" IN (
         SELECT id FROM "ContratoVehiculo" WHERE "numeroContrato" = 'CONTR-20261028-001'
       )
  `);

  if (docRes.rows.length === 0) {
    console.log('✗ No se encontró documento legal');
    await client.end();
    return;
  }

  for (const doc of docRes.rows) {
    console.log('Documento encontrado:');
    console.log('  ID:', doc.id);
    console.log('  Número:', doc.numeroContrato);
    console.log('  Estado actual:', doc.estado);
    console.log('  Conductor OTP validado:', doc.conductorOtpValidado);
    console.log('  Conductor firmó:', doc.conductorFechaFirma);
    console.log('  Propietario firmó:', doc.propietarioFechaFirma);
    console.log('  Conductor tiene fotos:', doc.tiene_foto_doc, doc.tiene_foto_selfie);
    console.log('  Conductor tiene firma manuscrita:', doc.tiene_firma_manuscrita);
    console.log('  Propietario tiene fotos:', doc.prop_tiene_foto_doc);
    console.log('  Propietario tiene firma:', doc.prop_tiene_firma);

    // 2. Eliminar TODO rastro de envío/firma: resetear a estado ENVIADO_CONDUCTOR
    // Mantener los tokens (para que se puedan enviar manualmente)
    // Pero limpiar cualquier foto, firma, OTP que se haya guardado
    await client.query(`
      UPDATE "ContratoDocumentoVehiculo"
      SET estado = 'ENVIADO_CONDUCTOR',
          "conductorFotoCedulaFrente" = NULL,
          "conductorFotoCedulaReverso" = NULL,
          "conductorFotoSelfie" = NULL,
          "conductorFirmaManuscrita" = NULL,
          "conductorOtpHash" = NULL,
          "conductorOtpExpira" = NULL,
          "conductorOtpValidado" = false,
          "conductorFechaFirma" = NULL,
          "conductorIp" = NULL,
          "conductorUserAgent" = NULL,
          "propietarioFotoCedulaFrente" = NULL,
          "propietarioFotoCedulaReverso" = NULL,
          "propietarioFotoSelfie" = NULL,
          "propietarioFirmaManuscrita" = NULL,
          "propietarioOtpHash" = NULL,
          "propietarioOtpExpira" = NULL,
          "propietarioOtpValidado" = false,
          "propietarioFechaFirma" = NULL,
          "propietarioIp" = NULL,
          "propietarioUserAgent" = NULL,
          "updatedAt" = NOW()
      WHERE id = $1
    `, [doc.id]);

    console.log('\n✓ Documento reseteado a ENVIADO_CONDUCTOR (pendiente de envío manual)');
    console.log('  - Fotos del conductor eliminadas');
    console.log('  - Firma manuscrita del conductor eliminada');
    console.log('  - OTP del conductor eliminado');
    console.log('  - Fecha de firma del conductor eliminada');
    console.log('  - Fotos del propietario eliminadas');
    console.log('  - Firma manuscrita del propietario eliminada');
    console.log('  - OTP del propietario eliminado');
    console.log('  - Fecha de firma del propietario eliminada');
    console.log('  - Tokens preservados (para envío manual)');
  }

  // 3. Verificar estado final
  const verif = await client.query(`
    SELECT id, "numeroContrato", estado,
           "conductorToken" IS NOT NULL AS tiene_token_conductor,
           "propietarioToken" IS NOT NULL AS tiene_token_propietario,
           "conductorFotoCedulaFrente" IS NOT NULL AS tiene_foto,
           "conductorFirmaManuscrita" IS NOT NULL AS tiene_firma
    FROM "ContratoDocumentoVehiculo"
    WHERE "numeroContrato" = 'CTR-20261028-000001'
  `);

  console.log('\n=== ESTADO FINAL ===');
  for (const v of verif.rows) {
    console.log('  Número:', v.numeroContrato);
    console.log('  Estado:', v.estado);
    console.log('  Token conductor:', v.tiene_token_conductor ? '✓ (preservado)' : '✗');
    console.log('  Token propietario:', v.tiene_token_propietario ? '✓ (preservado)' : '✗');
    console.log('  Fotos conductor:', v.tiene_foto ? '✗ (eliminadas)' : '✓ sin fotos');
    console.log('  Firma conductor:', v.tiene_firma ? '✗ (eliminada)' : '✓ sin firma');
  }

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => { console.error(e); process.exit(1); });
