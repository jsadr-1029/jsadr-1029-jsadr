// Resetear el contrato CONTR-20261028-001 a estado pendiente de firma
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Buscar el ContratoVehiculo
  const cv = await client.query(`
    SELECT id, "numeroContrato", estado FROM "ContratoVehiculo" WHERE "numeroContrato" = 'CONTR-20261028-001'
  `);

  if (cv.rows.length === 0) {
    console.log('✗ Contrato no encontrado');
    await client.end();
    return;
  }

  console.log('ContratoVehiculo encontrado:');
  console.log('  ID:', cv.rows[0].id);
  console.log('  Número:', cv.rows[0].numeroContrato);
  console.log('  Estado actual:', cv.rows[0].estado);

  // 2. Cambiar estado del ContratoVehiculo a BORRADOR (pendiente de firma)
  await client.query(`
    UPDATE "ContratoVehiculo" SET estado = 'BORRADOR', "updatedAt" = NOW() WHERE id = $1
  `, [cv.rows[0].id]);
  console.log('  ✓ Estado cambiado a BORRADOR');

  // 3. Buscar el documento legal
  const cd = await client.query(`
    SELECT id, "numeroContrato", estado,
           "conductorToken", "conductorTokenExpira",
           "propietarioToken", "propietarioTokenExpira",
           "conductorFotoCedulaFrente" IS NOT NULL AS tiene_foto_doc,
           "conductorFirmaManuscrita" IS NOT NULL AS tiene_firma,
           "conductorFechaFirma",
           "propietarioFechaFirma"
    FROM "ContratoDocumentoVehiculo" WHERE "contratoVehiculoId" = $1
  `, [cv.rows[0].id]);

  if (cd.rows.length > 0) {
    const doc = cd.rows[0];
    console.log('\nDocumento legal encontrado:');
    console.log('  ID:', doc.id);
    console.log('  Número:', doc.numeroContrato);
    console.log('  Estado actual:', doc.estado);
    console.log('  Tiene fotos:', doc.tiene_foto_doc);
    console.log('  Tiene firma:', doc.tiene_firma);
    console.log('  Conductor firmó:', doc.conductorFechaFirma);
    console.log('  Propietario firmó:', doc.propietarioFechaFirma);

    // 4. Resetear el documento legal a ENVIADO_CONDUCTOR
    // Mantener tokens (para envío manual)
    // Limpiar cualquier rastro de firma/fotos/OTP
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

    console.log('\n  ✓ Documento legal reseteado a ENVIADO_CONDUCTOR');
    console.log('  ✓ Fotos del conductor eliminadas');
    console.log('  ✓ Firma del conductor eliminada');
    console.log('  ✓ OTP del conductor eliminado');
    console.log('  ✓ Fecha de firma del conductor eliminada');
    console.log('  ✓ Fotos del propietario eliminadas');
    console.log('  ✓ Firma del propietario eliminada');
    console.log('  ✓ OTP del propietario eliminado');
    console.log('  ✓ Fecha de firma del propietario eliminada');
    console.log('  ✓ Tokens preservados para envío manual');

    // 5. Verificar
    const verif = await client.query(`
      SELECT estado,
             "conductorToken" IS NOT NULL AS tiene_token_cond,
             "propietarioToken" IS NOT NULL AS tiene_token_prop,
             "conductorFotoCedulaFrente" IS NOT NULL AS tiene_foto,
             "conductorFirmaManuscrita" IS NOT NULL AS tiene_firma
      FROM "ContratoDocumentoVehiculo" WHERE id = $1
    `, [doc.id]);
    console.log('\n=== ESTADO FINAL ===');
    console.log('  Documento estado:', verif.rows[0].estado);
    console.log('  Token conductor:', verif.rows[0].tiene_token_cond ? '✓ preservado' : '✗');
    console.log('  Token propietario:', verif.rows[0].tiene_token_prop ? '✓ preservado' : '✗');
    console.log('  Fotos:', verif.rows[0].tiene_foto ? '✗ aún hay' : '✓ sin fotos');
    console.log('  Firma:', verif.rows[0].tiene_firma ? '✗ aún hay' : '✓ sin firma');
  } else {
    console.log('\nNo hay documento legal. Creando uno nuevo...');
    const crypto = require('crypto');
    const conductorToken = crypto.randomBytes(32).toString('hex');
    const propietarioToken = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Buscar datos del contrato
    const condRes = await client.query(`
      SELECT c.nombre, c.cedula, c.telefono, c.email, c.direccion,
             c."licenciaNumero", c."licenciaCategoria"
      FROM "ContratoVehiculo" cv
      JOIN "ConductorVehiculo" c ON c.id = cv."conductorId"
      WHERE cv.id = $1
    `, [cv.rows[0].id]);

    const vehRes = await client.query(`
      SELECT v.placa, v.marca, v.modelo, v.anio, v.color, v."kilometraje", v.vin, v.motor,
             cv."modalidadPago", cv.tarifa, cv."diasGracia", cv."multaDiaria", cv.deposito,
             cv."fechaInicio", cv."fechaFin"
      FROM "ContratoVehiculo" cv
      JOIN "Vehiculo" v ON v.id = cv."vehiculoId"
      WHERE cv.id = $1
    `, [cv.rows[0].id]);

    const cond = condRes.rows[0];
    const veh = vehRes.rows[0];
    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const numeroDoc = `CTR-${fechaStr}-000001`;

    await client.query(`
      INSERT INTO "ContratoDocumentoVehiculo" (
        id, "numeroContrato", "contratoVehiculoId",
        "vehiculoPlaca", "vehiculoMarca", "vehiculoModelo", "vehiculoAnio", "vehiculoColor", "vehiculoKilometraje", "vehiculoVin", "vehiculoMotor",
        "propietarioNombre", "propietarioCedula", "propietarioTelefono", "propietarioEmail", "propietarioDireccion",
        "conductorNombre", "conductorCedula", "conductorTelefono", "conductorEmail", "conductorDireccion", "conductorLicencia", "conductorLicenciaCat",
        "modalidadPago", tarifa, "diasGracia", "multaDiaria", deposito,
        "fechaInicio", "fechaFin", "cantidadCuotas", "descripcionVehiculo",
        estado, "conductorToken", "conductorTokenExpira", "propietarioToken", "propietarioTokenExpira",
        "conductorOtpValidado", "propietarioOtpValidado",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2,
        $3, $4, $5, $6, $7, $8, $9, $10,
        'Johan Sebastian Alvarez Del Rio', '1214731649', '3235949510', 'jsadr23@outlook.com', 'Cl 92 44A 34',
        $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, 0, $25,
        'ENVIADO_CONDUCTOR', $26, $27, $28, $29,
        false, false,
        NOW(), NOW()
      )
    `, [
      numeroDoc, cv.rows[0].id,
      veh.placa, veh.marca, veh.modelo, veh.anio, veh.color, veh.kilometraje, veh.vin, veh.motor,
      cond.nombre, cond.cedula, cond.telefono, cond.email || '', cond.direccion || '', cond.licenciaNumero || '', cond.licenciaCategoria || '',
      veh.modalidadPago, veh.tarifa, veh.diasGracia, veh.multaDiaria, veh.deposito,
      veh.fechaInicio, veh.fechaFin, `Vehículo ${veh.marca} ${veh.modelo} ${veh.anio || ''}, placa ${veh.placa}`,
      conductorToken, tokenExpira, propietarioToken, tokenExpira,
    ]);
    console.log('  ✓ Documento legal creado en estado ENVIADO_CONDUCTOR');
  }

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => { console.error(e); process.exit(1); });
