// Diagnóstico completo: buscar conductor 12147316499, sus contratos, vehículos, y CONTR-20261022-001
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cedulaEjemplo = '12147316499';
  const numeroContrato = 'CONTR-20261022-001';

  // 1. Buscar conductor 12147316499
  console.log('=== CONDUCTOR 12147316499 (DATO DE EJEMPLO) ===');
  const condRes = await client.query(`
    SELECT id, nombre, cedula, telefono, email FROM "ConductorVehiculo" WHERE cedula = $1
  `, [cedulaEjemplo]);
  const conductorId = condRes.rows[0]?.id;
  for (const c of condRes.rows) {
    console.log('  ID:', c.id);
    console.log('  Nombre:', c.nombre);
    console.log('  Cédula:', c.cedula);
    console.log('  Teléfono:', c.telefono);
    console.log('  Email:', c.email);
  }

  // 2. Buscar contratos de ese conductor
  console.log('\n=== CONTRATOS DEL CONDUCTOR ===');
  const contRes = await client.query(`
    SELECT id, "numeroContrato", estado, "fechaInicio", "fechaFin", "vehiculoId"
    FROM "ContratoVehiculo" WHERE "conductorId" = $1
  `, [conductorId]);
  const contratoIds = contRes.rows.map(c => c.id);
  for (const c of contRes.rows) {
    console.log('  Contrato:', c.id, '|', c.numeroContrato, '|', c.estado, '|', c.fechaInicio, '→', c.fechaFin);
  }

  // 3. Buscar vehículos de esos contratos
  console.log('\n=== VEHÍCULOS ASOCIADOS A CONTRATOS DEL CONDUCTOR ===');
  if (contratoIds.length > 0) {
    const vehRes = await client.query(`
      SELECT DISTINCT v.id, v.placa, v.marca, v.modelo, v."kilometraje", v.estado
      FROM "Vehiculo" v
      JOIN "ContratoVehiculo" c ON c."vehiculoId" = v.id
      WHERE c.id = ANY($1::text[])
    `, [contratoIds]);
    for (const v of vehRes.rows) {
      console.log('  Vehículo:', v.id, '|', v.placa, '|', v.marca, v.modelo, '|', v.estado);
    }
  } else {
    console.log('  (sin contratos)');
  }

  // 4. Buscar CONTR-20261022-001 directamente
  console.log('\n=== CONTRATO CONTR-20261022-001 ===');
  const contrRes = await client.query(`
    SELECT * FROM "ContratoVehiculo" WHERE "numeroContrato" = $1
  `, [numeroContrato]);
  if (contrRes.rows.length === 0) {
    console.log('  No se encontró ContratoVehiculo con ese número.');
  } else {
    const c = contrRes.rows[0];
    console.log('  ID:', c.id);
    console.log('  Número:', c.numeroContrato);
    console.log('  Estado:', c.estado);
    console.log('  Vehículo ID:', c.vehiculoId);
    console.log('  Conductor ID:', c.conductorId);
    console.log('  Fecha inicio:', c.fechaInicio);
    console.log('  Fecha fin:', c.fechaFin);
    console.log('  Tarifa:', c.tarifa);
    contratoIds.push(c.id);
  }

  // 5. Buscar ContratoDocumentoVehiculo (firmas electrónicas)
  console.log('\n=== DOCUMENTOS LEGALES (ContratoDocumentoVehiculo) ===');
  if (contratoIds.length > 0) {
    const docRes = await client.query(`
      SELECT id, "numeroContrato", estado, "conductorToken", "propietarioToken",
             "conductorFechaFirma", "propietarioFechaFirma",
             "conductorOtpValidado", "propietarioOtpValidado"
      FROM "ContratoDocumentoVehiculo"
      WHERE "contratoVehiculoId" = ANY($1::text[])
         OR "numeroContrato" = $2
    `, [contratoIds, numeroContrato]);
    for (const d of docRes.rows) {
      console.log('  Documento ID:', d.id);
      console.log('  Número:', d.numeroContrato);
      console.log('  Estado:', d.estado);
      console.log('  Conductor firmó:', d.conductorFechaFirma, d.conductorOtpValidado ? '✓' : '✗');
      console.log('  Propietario firmó:', d.propietarioFechaFirma, d.propietarioOtpValidado ? '✓' : '✗');
    }
  }

  // 6. Buscar obligaciones y pagos asociados a esos contratos
  console.log('\n=== OBLIGACIONES Y PAGOS ===');
  if (contratoIds.length > 0) {
    const oblRes = await client.query(`
      SELECT COUNT(*)::int AS total FROM "ObligacionVehiculo" WHERE "contratoId" = ANY($1::text[])
    `, [contratoIds]);
    console.log('  Obligaciones:', oblRes.rows[0].total);

    const pagRes = await client.query(`
      SELECT COUNT(*)::int AS total FROM "PagoVehiculo" WHERE "contratoId" = ANY($1::text[])
    `, [contratoIds]);
    console.log('  Pagos:', pagRes.rows[0].total);
  }

  // 7. Verificar conductor correcto 1214731649 (Johan Alvarez - 10 dígitos)
  console.log('\n=== CONDUCTOR CORRECTO 1214731649 (Johan Alvarez - debe preservarse) ===');
  const condOkRes = await client.query(`
    SELECT id, nombre, cedula FROM "ConductorVehiculo" WHERE cedula = '1214731649'
  `);
  if (condOkRes.rows.length === 0) {
    console.log('  No existe conductor con cédula 1214731649');
  } else {
    for (const c of condOkRes.rows) {
      console.log('  ID:', c.id, '|', c.nombre, '|', c.cedula);
    }
  }

  // 8. Verificar si hay otros conductores reales en el sistema
  console.log('\n=== OTROS CONDUCTORES EN EL SISTEMA ===');
  const otrosCondRes = await client.query(`
    SELECT id, nombre, cedula FROM "ConductorVehiculo" WHERE cedula != $1 ORDER BY "createdAt" ASC LIMIT 10
  `, [cedulaEjemplo]);
  for (const c of otrosCondRes.rows) {
    console.log('  ID:', c.id, '|', c.nombre, '|', c.cedula);
  }

  await client.end();
  console.log('\n=== DIAGNÓSTICO COMPLETADO ===');
}

main().catch(e => { console.error(e); process.exit(1); });
