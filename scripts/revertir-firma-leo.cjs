// Revertir firma a estado PENDIENTE (sin fotos, sin OTP)
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const firmaId = 'cmvs85c4x0007jm08ixlhjb0z';

  // Estado antes
  const antes = await client.query(`
    SELECT "estadoFirma", "fotoDocumento" IS NOT NULL AS tiene_foto_doc,
           "fotoSelfie" IS NOT NULL AS tiene_foto_selfie
    FROM "FirmaElectronica" WHERE id = $1
  `, [firmaId]);
  console.log('ANTES:', antes.rows[0]);

  // Revertir
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
  `, [firmaId]);

  // Estado después
  const despues = await client.query(`
    SELECT "estadoFirma", "fotoDocumento" IS NOT NULL AS tiene_foto_doc,
           "fotoSelfie" IS NOT NULL AS tiene_foto_selfie
    FROM "FirmaElectronica" WHERE id = $1
  `, [firmaId]);
  console.log('DESPUÉS:', despues.rows[0]);
  console.log('✓ Firma revertida a PENDIENTE. El cliente puede firmar desde cero.');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
