// Revertir firma de Paula Andrea Cano a estado PENDIENTE
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Buscar todas las firmas del préstamo PAC-CC-1036671139-20261020-01
  const res = await client.query(`
    SELECT f.id, f."estadoFirma", f."fotoDocumento" IS NOT NULL AS tiene_foto_doc,
           f."fotoSelfie" IS NOT NULL AS tiene_foto_selfie,
           f."intentosOTP", f."otpEnviado"
    FROM "FirmaElectronica" f
    JOIN "Prestamo" p ON p.id = f."prestamoId"
    WHERE p.codigo = 'PAC-CC-1036671139-20261020-01'
    ORDER BY f."createdAt" DESC
  `);

  console.log('=== FIRMAS DE PAULA CANO ===');
  for (const f of res.rows) {
    console.log(`  ID: ${f.id} | estado: ${f.estadoFirma} | fotoDoc: ${f.tiene_foto_doc} | fotoSelfie: ${f.tiene_foto_selfie} | OTP: ${f.otpEnviado} | intentos: ${f.intentosOTP}`);

    // Revertir cada firma a estado PENDIENTE
    await client.query(`
      UPDATE "FirmaElectronica"
      SET "estadoFirma" = 'PENDIENTE',
          "fotoDocumento" = NULL,
          "fotoSelfie" = NULL,
          "fotoDocumentoHash" = NULL,
          "fotoSelfieHash" = NULL,
          "ipFirma" = NULL,
          "userAgent" = NULL,
          "fechaSubidaFotos" = NULL,
          "otpEnviado" = false,
          "otpValidado" = false,
          "otpCodigo" = NULL,
          "otpFechaEnvio" = NULL,
          "intentosOTP" = 0,
          "updatedAt" = NOW()
      WHERE id = $1
    `, [f.id]);
    console.log(`  ✓ Firma ${f.id} revertida a PENDIENTE`);
  }

  // Verificar
  const verif = await client.query(`
    SELECT id, "estadoFirma" FROM "FirmaElectronica" f
    JOIN "Prestamo" p ON p.id = f."prestamoId"
    WHERE p.codigo = 'PAC-CC-1036671139-20261020-01'
    ORDER BY f."createdAt" DESC
  `);
  console.log('\n=== ESTADO FINAL ===');
  for (const v of verif.rows) {
    console.log(`  ${v.id}: ${v.estadoFirma}`);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
