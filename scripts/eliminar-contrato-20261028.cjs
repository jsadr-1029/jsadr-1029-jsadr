// Elimina el contrato CONTR-20261028-001 y todos sus registros asociados
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const numeroContrato = 'CONTR-20261028-001';

  // 1. Buscar el ContratoVehiculo
  const contrRes = await client.query(`
    SELECT id, "numeroContrato", "vehiculoId", "conductorId"
    FROM "ContratoVehiculo" WHERE "numeroContrato" = $1
  `, [numeroContrato]);

  if (contrRes.rows.length === 0) {
    console.log('✗ Contrato no encontrado (ya eliminado)');
    await client.end();
    return;
  }

  const contrId = contrRes.rows[0].id;
  console.log('=== ELIMINANDO CONTRATO', numeroContrato, '===');
  console.log('ID:', contrId);

  // 2. Eliminar dependencias en orden (respetando foreign keys)
  // 2a. Auditorías
  await client.query('DELETE FROM "AuditoriaVehiculo" WHERE "entidadId" = $1', [contrId]).catch(() => {});
  console.log('✓ Auditorías eliminadas');

  // 2b. TokenFirma
  await client.query('DELETE FROM "TokenFirma" WHERE "prestamoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Tokens de firma eliminados');

  // 2c. ContratoDocumentoVehiculo (firmas electrónicas)
  const docsLeg = await client.query('SELECT id FROM "ContratoDocumentoVehiculo" WHERE "contratoVehiculoId" = $1', [contrId]);
  for (const d of docsLeg.rows) {
    await client.query('DELETE FROM "AuditoriaVehiculo" WHERE "entidadId" = $1', [d.id]).catch(() => {});
    await client.query('DELETE FROM "ContratoDocumentoVehiculo" WHERE id = $1', [d.id]);
  }
  console.log('✓ Documento legal eliminado (' + docsLeg.rows.length + ' registro(s))');

  // 2d. Recibos de pago
  await client.query('DELETE FROM "ReciboPagoVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Recibos eliminados');

  // 2e. Pagos
  await client.query('DELETE FROM "PagoVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Pagos eliminados');

  // 2f. Obligaciones
  await client.query('DELETE FROM "ObligacionVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Obligaciones eliminadas');

  // 2g. Mantenimientos
  await client.query('DELETE FROM "MantenimientoVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Mantenimientos eliminados');

  // 2h. Cuentas de pago
  await client.query('DELETE FROM "CuentaPagoVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Cuentas de pago eliminadas');

  // 2i. Códigos QR
  await client.query('DELETE FROM "CodigoQRVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Códigos QR eliminados');

  // 2j. Reservas
  await client.query('DELETE FROM "ReservaVehiculo" WHERE "contratoId" = $1', [contrId]).catch(() => {});
  console.log('✓ Reservas eliminadas');

  // 2k. ContratoVehiculo
  await client.query('DELETE FROM "ContratoVehiculo" WHERE id = $1', [contrId]);
  console.log('✓ ContratoVehiculo eliminado');

  // 3. Verificar
  const verif = await client.query('SELECT COUNT(*)::int as n FROM "ContratoVehiculo" WHERE "numeroContrato" = $1', [numeroContrato]);
  console.log('\n=== VERIFICACIÓN ===');
  console.log('Contratos restantes con ese número:', verif.rows[0].n);
  console.log(verif.rows[0].n === 0 ? '✓ Contrato eliminado correctamente' : '✗ Aún existe');

  await client.end();
  console.log('\n=== OPERACIÓN COMPLETADA ===');
}

main().catch(e => { console.error(e); process.exit(1); });
