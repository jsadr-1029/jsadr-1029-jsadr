// Revertir: dejar la firma como estaba antes de mi prueba
// (Yo envié un OTP accidentalmente, lo revierto a estado PENDIENTE)
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const firmaId = 'cmvjue0ul0007jq08u2ejv5uc';

  // Revertir la firma a estado PENDIENTE (como estaba antes de mi prueba)
  await client.query(`
    UPDATE "FirmaElectronica"
    SET "otpEnviado" = false,
        "otpValidado" = false,
        "otpCodigo" = null,
        "otpFechaEnvio" = null,
        "otpFechaValidacion" = null,
        "intentosOTP" = 0,
        "estadoFirma" = 'PENDIENTE',
        "updatedAt" = NOW()
    WHERE id = $1
  `, [firmaId]);

  console.log('✓ Firma revertida a estado PENDIENTE (como estaba antes de mi prueba)');
  console.log('  NOTA: El OTP ya fue enviado al correo del cliente (icbocata@gmail.com)');
  console.log('  El OTP expira en 5 minutos, así que pronto quedará sin efecto.');
  console.log('  La firma NO se completó, NO se validó, NO se activó el préstamo.');
  console.log('  El usuario puede continuar el flujo normalmente cuando quiera firmar.');

  // Verificar
  const res = await client.query(`
    SELECT "estadoFirma", "otpEnviado", "otpValidado", "intentosOTP"
    FROM "FirmaElectronica" WHERE id = $1
  `, [firmaId]);
  console.log('\nEstado final:', res.rows[0]);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
