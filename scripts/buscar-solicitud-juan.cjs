// Buscar solicitud de Juan Alberto Arias Bonilla
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT id, nombre, cedula, estado,
           "fotoCedulaFrente" IS NOT NULL AS tiene_foto_doc,
           "fotoCedulaReverso" IS NOT NULL AS tiene_foto_rev,
           "fotoSelfie" IS NOT NULL AS tiene_selfie,
           "fotoLicenciaFrente" IS NOT NULL AS tiene_lic_frente,
           "fotoLicenciaReverso" IS NOT NULL AS tiene_lic_reverso,
           "firmaElectronica" IS NOT NULL AS tiene_firma,
           "otpVerificado" AS otp_ok,
           "createdAt"
    FROM "SolicitudConductorVehiculo"
    WHERE nombre ILIKE '%Juan Alberto%' OR nombre ILIKE '%Arias Bonilla%' OR nombre ILIKE '%juan%' OR nombre ILIKE '%arias%'
    ORDER BY "createdAt" DESC
  `);

  if (res.rows.length === 0) {
    // Buscar por nombre parcial
    const res2 = await client.query(`
      SELECT id, nombre, cedula, estado, "createdAt"
      FROM "SolicitudConductorVehiculo"
      WHERE nombre ILIKE '%juan%' OR nombre ILIKE '%arias%' OR nombre ILIKE '%bonilla%'
      ORDER BY "createdAt" DESC
    `);
    console.log('Búsqueda parcial:', res2.rows.length, 'resultados');
    for (const r of res2.rows) {
      console.log('  -', r.nombre, '| CC:', r.cedula, '| estado:', r.estado, '| fecha:', r.createdAt);
    }
  } else {
    for (const r of res.rows) {
      console.log('=== SOLICITUD ENCONTRADA ===');
      console.log('  ID:', r.id);
      console.log('  Nombre:', r.nombre);
      console.log('  Cédula:', r.cedula);
      console.log('  Estado:', r.estado);
      console.log('  Foto cédula frente:', r.tiene_foto_doc);
      console.log('  Foto cédula reverso:', r.tiene_foto_rev);
      console.log('  Selfie:', r.tiene_selfie);
      console.log('  Licencia frente:', r.tiene_lic_frente);
      console.log('  Licencia reverso:', r.tiene_lic_reverso);
      console.log('  Firma manuscrita:', r.tiene_firma);
      console.log('  OTP validado:', r.otp_ok);
      console.log('  Fecha:', r.createdAt);
    }
  }

  // Listar todas las solicitudes pendientes
  const pendientes = await client.query(`
    SELECT nombre, cedula, estado FROM "SolicitudConductorVehiculo" ORDER BY "createdAt" DESC LIMIT 10
  `);
  console.log('\n=== TODAS LAS SOLICITUDES ===');
  for (const p of pendientes.rows) {
    console.log('  -', p.nombre, '| CC:', p.cedula, '| estado:', p.estado);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
