// Envía los enlaces de firma del contrato CONTR-20261028-001 por email
// - Al conductor: yoimanfranco72@gmail.com
// - Copia al propietario: jsadr23@outlook.com
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Obtener tokens completos del documento legal
  const res = await client.query(`
    SELECT cd."conductorToken", cd."propietarioToken",
           cd."conductorNombre", cd."conductorEmail",
           cd."propietarioNombre", cd."propietarioEmail",
           cd."vehiculoPlaca", cd."vehiculoMarca", cd."vehiculoModelo",
           cd."modalidadPago", cd.tarifa
    FROM "ContratoDocumentoVehiculo" cd
    JOIN "ContratoVehiculo" cv ON cv.id = cd."contratoVehiculoId"
    WHERE cv."numeroContrato" = 'CONTR-20261028-001'
  `);

  if (res.rows.length === 0) {
    console.log('✗ No se encontró documento legal');
    await client.end();
    return;
  }

  const d = res.rows[0];
  console.log('=== ENLACES DE FIRMA DEL CONTRATO CONTR-20261028-001 ===\n');
  console.log('Conductor:', d.conductorNombre, '|', d.conductorEmail);
  console.log('Propietario:', d.propietarioNombre, '|', d.propietarioEmail);
  console.log('Vehículo:', d.vehiculoMarca, d.vehiculoModelo, '| Placa:', d.vehiculoPlaca);
  console.log('Tarifa: $' + d.tarifa + ' / ' + d.modalidadPago);

  const linkConductor = `https://jsadr.com.co/firma-contrato-vehiculo/${d.conductorToken}`;
  const linkPropietario = `https://jsadr.com.co/firma-contrato-vehiculo/${d.propietarioToken}`;

  console.log('\n=== ENLACES ===');
  console.log('Conductor:', linkConductor);
  console.log('Propietario:', linkPropietario);

  // Verificar que los enlaces funcionan
  console.log('\n=== VERIFICANDO ENLACES ===');
  const fetch = require('node-fetch') || globalThis.fetch;

  try {
    const resConductor = await fetch(`https://jsadr.com.co/api/vehiculos/contrato-legal/estado?token=${d.conductorToken}`);
    const jsonCond = await resConductor.json();
    console.log('Conductor:', jsonCond.success ? '✓ Válido' : '✗ Inválido', '| estado:', jsonCond.data?.estado);
  } catch (e) {
    console.log('Conductor: Error al verificar -', e.message);
  }

  try {
    const resProp = await fetch(`https://jsadr.com.co/api/vehiculos/contrato-legal/estado?token=${d.propietarioToken}`);
    const jsonProp = await resProp.json();
    console.log('Propietario:', jsonProp.success ? '✓ Válido' : '✗ Inválido', '| estado:', jsonProp.data?.estado);
  } catch (e) {
    console.log('Propietario: Error al verificar -', e.message);
  }

  // Guardar datos para el endpoint de envío
  console.log('\n=== DATOS PARA ENVÍO ===');
  console.log('Email conductor:', d.conductorEmail);
  console.log('Email propietario (copia):', d.propietarioEmail);
  console.log('Link conductor:', linkConductor);
  console.log('Link propietario:', linkPropietario);
  console.log('Token conductor:', d.conductorToken);
  console.log('Token propietario:', d.propietarioToken);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
