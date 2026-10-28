// Elimina datos de ejemplo y crea nuevo contrato para firma
const { Client } = require('pg');
const crypto = require('crypto');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function eliminarContratoCompleto(client, contratoId) {
  // Eliminar dependencias en orden (respetando foreign keys)
  await client.query('DELETE FROM "AuditoriaVehiculo" WHERE "entidadId" = $1 AND entidad = $2', [contratoId, 'CONTRATO']).catch(() => {});
  await client.query('DELETE FROM "TokenFirma" WHERE "prestamoId" = $1', [contratoId]).catch(() => {});
  const docsLeg = await client.query('SELECT id FROM "ContratoDocumentoVehiculo" WHERE "contratoVehiculoId" = $1', [contratoId]);
  for (const d of docsLeg.rows) {
    await client.query('DELETE FROM "AuditoriaVehiculo" WHERE "entidadId" = $1 AND entidad = $2', [d.id, 'CONTRATO_DOCUMENTO']).catch(() => {});
    await client.query('DELETE FROM "ContratoDocumentoVehiculo" WHERE id = $1', [d.id]);
  }
  await client.query('DELETE FROM "ReciboPagoVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "PagoVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "ObligacionVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "MantenimientoVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "CuentaPagoVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "CodigoQRVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "ReservaVehiculo" WHERE "contratoId" = $1', [contratoId]).catch(() => {});
  await client.query('DELETE FROM "ContratoVehiculo" WHERE id = $1', [contratoId]);
}

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cedulaEjemplo = '12147316499';
  const cedulaBasura = '1214';
  const numeroContratoViejo = 'CONTR-20261022-001';

  // =========================
  // FASE 1: ELIMINAR CONTRATO CONTR-20261022-001 PRIMERO
  // =========================
  console.log('=== FASE 1: ELIMINAR CONTRATO CONTR-20261022-001 ===\n');

  const contrViejo = await client.query('SELECT id, "vehiculoId", "conductorId" FROM "ContratoVehiculo" WHERE "numeroContrato" = $1', [numeroContratoViejo]);
  if (contrViejo.rows.length > 0) {
    const contrId = contrViejo.rows[0].id;
    console.log('→ Eliminando contrato CONTR-20261022-001, ID:', contrId);
    await eliminarContratoCompleto(client, contrId);
    console.log('  ✓ Contrato + documento legal + obligaciones + pagos eliminados');
  } else {
    console.log('  Contrato CONTR-20261022-001 no encontrado (ya eliminado)');
  }

  // =========================
  // FASE 2: ELIMINAR CONDUCTORES DE EJEMPLO
  // =========================
  console.log('\n=== FASE 2: ELIMINAR CONDUCTORES DE EJEMPLO ===\n');

  // 2a. Sebastian (12147316499)
  const condSeb = await client.query('SELECT id FROM "ConductorVehiculo" WHERE cedula = $1', [cedulaEjemplo]);
  if (condSeb.rows.length > 0) {
    const id = condSeb.rows[0].id;
    console.log('→ Eliminando conductor Sebastian (12147316499), ID:', id);
    // Eliminar contratos asociados al conductor primero
    const contratosCond = await client.query('SELECT id FROM "ContratoVehiculo" WHERE "conductorId" = $1', [id]);
    for (const c of contratosCond.rows) {
      console.log('  → Eliminando contrato asociado:', c.id);
      await eliminarContratoCompleto(client, c.id);
    }
    await client.query('DELETE FROM "DocumentoConductor" WHERE "conductorId" = $1', [id]).catch(() => {});
    await client.query('DELETE FROM "ConductorVehiculo" WHERE id = $1', [id]);
    console.log('  ✓ Conductor Sebastian eliminado');
  } else {
    console.log('  Conductor Sebastian no encontrado (ya eliminado)');
  }

  // 2b. Conductor basura "Fffdf" (1214)
  const condBas = await client.query('SELECT id FROM "ConductorVehiculo" WHERE cedula = $1', [cedulaBasura]);
  if (condBas.rows.length > 0) {
    const id = condBas.rows[0].id;
    console.log('→ Eliminando conductor basura "Fffdf" (1214), ID:', id);
    // Eliminar contratos asociados
    const contratosBas = await client.query('SELECT id FROM "ContratoVehiculo" WHERE "conductorId" = $1', [id]);
    for (const c of contratosBas.rows) {
      console.log('  → Eliminando contrato asociado:', c.id);
      await eliminarContratoCompleto(client, c.id);
    }
    await client.query('DELETE FROM "DocumentoConductor" WHERE "conductorId" = $1', [id]).catch(() => {});
    await client.query('DELETE FROM "ConductorVehiculo" WHERE id = $1', [id]);
    console.log('  ✓ Conductor basura eliminado');
  } else {
    console.log('  Conductor basura no encontrado');
  }

  // =========================
  // FASE 3: CREAR NUEVO CONTRATO
  // =========================
  console.log('\n=== FASE 3: CREAR NUEVO CONTRATO (24/10/2026 → 23/01/2027) ===\n');

  const vehRes = await client.query('SELECT id, placa, marca, modelo, anio, color, "kilometraje", vin, motor FROM "Vehiculo" WHERE placa = $1', ['DLW357']);
  if (vehRes.rows.length === 0) {
    console.log('✗ Vehículo DLW357 no encontrado. Abortando.');
    await client.end();
    return;
  }
  const vehiculoId = vehRes.rows[0].id;
  const v = vehRes.rows[0];
  console.log('✓ Vehículo DLW357 encontrado, ID:', vehiculoId);

  const condRes = await client.query('SELECT id, nombre, cedula, email, telefono, direccion, "licenciaNumero", "licenciaCategoria" FROM "ConductorVehiculo" WHERE cedula = $1', ['1037125498']);
  if (condRes.rows.length === 0) {
    console.log('✗ Conductor Yoiman (1037125498) no encontrado. Abortando.');
    await client.end();
    return;
  }
  const conductorId = condRes.rows[0].id;
  const c = condRes.rows[0];
  console.log('✓ Conductor Yoiman encontrado, ID:', conductorId);

  // Crear nuevo ContratoVehiculo
  const nuevoNumeroContrato = 'CONTR-20261028-001';
  const fechaInicio = new Date('2026-10-24T00:00:00-05:00');
  const fechaFin = new Date('2027-01-23T23:59:59-05:00');
  const tarifa = 480000;
  const modalidadPago = 'SEMANAL';

  const existe = await client.query('SELECT id FROM "ContratoVehiculo" WHERE "numeroContrato" = $1', [nuevoNumeroContrato]);
  let nuevoContratoId;
  if (existe.rows.length > 0) {
    nuevoContratoId = existe.rows[0].id;
    console.log('⚠️ Ya existe un contrato con número', nuevoNumeroContrato, '. Actualizando. ID:', nuevoContratoId);
    await client.query(`
      UPDATE "ContratoVehiculo"
      SET estado = 'BORRADOR',
          "fechaInicio" = $1, "fechaFin" = $2, tarifa = $3,
          "modalidadPago" = $4, "diasGracia" = 0, "multaDiaria" = 0, deposito = 0,
          "updatedAt" = NOW()
      WHERE id = $5
    `, [fechaInicio, fechaFin, tarifa, modalidadPago, nuevoContratoId]);
    console.log('  ✓ Contrato existente actualizado');
  } else {
    const insertRes = await client.query(`
      INSERT INTO "ContratoVehiculo" (
        id, "numeroContrato", "vehiculoId", "conductorId",
        "fechaInicio", "fechaFin", estado,
        "modalidadPago", tarifa, "diasGracia", "multaDiaria", deposito,
        "renovacionAnticipada", "valorRenovacionAnticipada",
        "creadoPor", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5, 'BORRADOR',
        $6, $7, 0, 0, 0,
        false, 9900,
        'admin-cleanup', NOW(), NOW()
      ) RETURNING id
    `, [nuevoNumeroContrato, vehiculoId, conductorId, fechaInicio, fechaFin, modalidadPago, tarifa]);
    nuevoContratoId = insertRes.rows[0].id;
    console.log('✓ Nuevo contrato creado, ID:', nuevoContratoId);
  }

  // Crear documento legal
  console.log('\n=== FASE 4: CREAR DOCUMENTO LEGAL ===\n');
  const nuevoNumeroDoc = `CTR-20261028-000001`;

  const propNombre = 'Johan Sebastian Alvarez Del Rio';
  const propCedula = '1214731649';
  const propTelefono = '3235949510';
  const propEmail = 'jsadr23@outlook.com';
  const propDireccion = 'Cl 92 44A 34';

  const conductorToken = crypto.randomBytes(32).toString('hex');
  const propietarioToken = crypto.randomBytes(32).toString('hex');
  const tokenExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const docExiste = await client.query('SELECT id FROM "ContratoDocumentoVehiculo" WHERE "contratoVehiculoId" = $1', [nuevoContratoId]);
  let documentoId;
  if (docExiste.rows.length > 0) {
    documentoId = docExiste.rows[0].id;
    await client.query(`
      UPDATE "ContratoDocumentoVehiculo"
      SET estado = 'ENVIADO_CONDUCTOR',
          "conductorToken" = $1, "conductorTokenExpira" = $2,
          "propietarioToken" = $3, "propietarioTokenExpira" = $4,
          "conductorFotoCedulaFrente" = NULL, "conductorFotoCedulaReverso" = NULL,
          "conductorFotoSelfie" = NULL, "conductorFirmaManuscrita" = NULL,
          "conductorOtpHash" = NULL, "conductorOtpExpira" = NULL,
          "conductorOtpValidado" = false, "conductorFechaFirma" = NULL,
          "propietarioFotoCedulaFrente" = NULL, "propietarioFotoCedulaReverso" = NULL,
          "propietarioFotoSelfie" = NULL, "propietarioFirmaManuscrita" = NULL,
          "propietarioOtpHash" = NULL, "propietarioOtpExpira" = NULL,
          "propietarioOtpValidado" = false, "propietarioFechaFirma" = NULL,
          "updatedAt" = NOW()
      WHERE id = $5
    `, [conductorToken, tokenExpira, propietarioToken, tokenExpira, documentoId]);
    console.log('✓ Documento legal existente actualizado, ID:', documentoId);
  } else {
    const docInsert = await client.query(`
      INSERT INTO "ContratoDocumentoVehiculo" (
        id, "numeroContrato", "contratoVehiculoId",
        "vehiculoPlaca", "vehiculoMarca", "vehiculoModelo", "vehiculoAnio", "vehiculoColor", "vehiculoKilometraje", "vehiculoVin", "vehiculoMotor",
        "propietarioNombre", "propietarioCedula", "propietarioTelefono", "propietarioEmail", "propietarioDireccion",
        "conductorNombre", "conductorCedula", "conductorTelefono", "conductorEmail", "conductorDireccion", "conductorLicencia", "conductorLicenciaCat",
        "modalidadPago", tarifa, "diasGracia", "multaDiaria", deposito,
        "fechaInicio", "fechaFin", "cantidadCuotas", "descripcionVehiculo",
        estado, "conductorToken", "conductorTokenExpira", "propietarioToken", "propietarioTokenExpira",
        "conductorOtpValidado", "propietarioOtpValidado",
        "creadoPor", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2,
        $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, 0, 0, 0,
        $25, $26, 0, $27,
        'ENVIADO_CONDUCTOR', $28, $29, $30, $31,
        false, false,
        'admin-cleanup', NOW(), NOW()
      ) RETURNING id
    `, [
      nuevoNumeroDoc, nuevoContratoId,
      v.placa, v.marca, v.modelo, v.anio, v.color, v.kilometraje, v.vin, v.motor,
      propNombre, propCedula, propTelefono, propEmail, propDireccion,
      c.nombre, c.cedula, c.telefono, c.email || '', c.direccion || '', c.licenciaNumero || '', c.licenciaCategoria || '',
      modalidadPago, tarifa,
      fechaInicio, fechaFin, `Vehículo ${v.marca} ${v.modelo} ${v.anio || ''}, placa ${v.placa}, color ${v.color || '—'}`,
      conductorToken, tokenExpira, propietarioToken, tokenExpira,
    ]);
    documentoId = docInsert.rows[0].id;
    console.log('✓ Nuevo documento legal creado, ID:', documentoId);
  }

  console.log('\n=== RESUMEN ===');
  console.log('  ContratoVehiculo:', nuevoNumeroContrato, '(ID:', nuevoContratoId, ')');
  console.log('  Documento legal:', nuevoNumeroDoc, '(ID:', documentoId, ')');
  console.log('  Vehículo: DLW357 (Ford Fiesta 2012)');
  console.log('  Conductor: Yoiman Smith Franco Valderrama (1037125498)');
  console.log('  Propietario: Johan Sebastian Alvarez Del Rio (1214731649)');
  console.log('  Fecha inicio: 24/10/2026');
  console.log('  Fecha fin: 23/01/2027');
  console.log('  Tarifa: $480.000/semana (SEMANAL)');
  console.log('  Estado: ENVIADO_CONDUCTOR (listo para firma del conductor primero)');
  console.log('\n=== TOKENS DE FIRMA ===');
  console.log('  Conductor link: https://jsadr.com.co/firma-contrato-vehiculo/' + conductorToken);
  console.log('  Propietario link: https://jsadr.com.co/firma-contrato-vehiculo/' + propietarioToken);
  console.log('  Expiración:', tokenExpira.toISOString());

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
