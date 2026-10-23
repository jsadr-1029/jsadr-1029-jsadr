// Diagnóstico: calcula el hash igual que descargar/route.ts y verificar-contrato/route.ts
// para identificar la diferencia.
const { Client } = require('pg');
const crypto = require('crypto');

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT "numeroContrato", "vehiculoPlaca", "propietarioCedula", "conductorCedula",
           "fechaInicio", "fechaFin", tarifa,
           "conductorOtpHash", "propietarioOtpHash",
           "conductorFechaFirma", "propietarioFechaFirma"
    FROM "ContratoDocumentoVehiculo"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);

  for (const doc of res.rows) {
    console.log('\n========================================');
    console.log('Contrato:', doc.numeroContrato, '| Placa:', doc.vehiculoPlaca);
    console.log('propietarioCedula en DB:', JSON.stringify(doc.propietarioCedula));
    console.log('conductorCedula en DB:', JSON.stringify(doc.conductorCedula));
    console.log('fechaInicio:', doc.fechaInicio);
    console.log('fechaFin:', doc.fechaFin);
    console.log('tarifa:', doc.tarifa, '(tipo:', typeof doc.tarifa, ')');
    console.log('conductorOtpHash:', doc.conductorOtpHash);
    console.log('propietarioOtpHash:', doc.propietarioOtpHash);
    console.log('conductorFechaFirma:', doc.conductorFechaFirma);
    console.log('propietarioFechaFirma:', doc.propietarioFechaFirma);

    // Caso 1: hash con cédula CRUDA de la DB
    const datosCrudo = [
      doc.numeroContrato,
      doc.vehiculoPlaca,
      doc.propietarioCedula,
      doc.conductorCedula,
      doc.fechaInicio?.toISOString() || '',
      doc.fechaFin?.toISOString() || '',
      doc.tarifa?.toString() || '',
      doc.conductorOtpHash || '',
      doc.propietarioOtpHash || '',
      doc.conductorFechaFirma?.toISOString() || '',
      doc.propietarioFechaFirma?.toISOString() || '',
    ].join('|');
    const hashCrudo = crypto.createHash('sha256').update(datosCrudo).digest('hex').toUpperCase();
    console.log('\n--- CASO 1: cédula cruda de DB ---');
    console.log('datosFirma:', datosCrudo);
    console.log('Hash corto (crudo):', hashCrudo.substring(0, 16));

    // Caso 2: hash con cédula FORZADA a 1214731649
    const propCedulaForzada = '1214731649';
    const datosForzados = [
      doc.numeroContrato,
      doc.vehiculoPlaca,
      propCedulaForzada,
      doc.conductorCedula,
      doc.fechaInicio?.toISOString() || '',
      doc.fechaFin?.toISOString() || '',
      doc.tarifa?.toString() || '',
      doc.conductorOtpHash || '',
      doc.propietarioOtpHash || '',
      doc.conductorFechaFirma?.toISOString() || '',
      doc.propietarioFechaFirma?.toISOString() || '',
    ].join('|');
    const hashForzado = crypto.createHash('sha256').update(datosForzados).digest('hex').toUpperCase();
    console.log('\n--- CASO 2: cédula forzada a 1214731649 ---');
    console.log('datosFirma:', datosForzados);
    console.log('Hash corto (forzado):', hashForzado.substring(0, 16));
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
