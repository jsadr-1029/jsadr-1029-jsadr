// Lee las credenciales SMTP de la DB Neon y envía los correos de firma del contrato
// directamente usando nodemailer.
const { Client } = require('pg');
const nodemailer = require('nodemailer');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Obtener credenciales SMTP de la DB (tabla ConexionApi)
  const connRes = await client.query(`
    SELECT "servicioNombre", "smtpHost", "smtpPort", "smtpUser", "smtpPass",
           "emailFrom", "emailFromName", "config"
    FROM "ConexionApi"
    WHERE "smtpHost" IS NOT NULL AND "smtpUser" IS NOT NULL
       OR config::text ILIKE '%smtp%'
    LIMIT 5
  `);

  console.log('=== CONEXIONES API CON SMTP ===');
  for (const c of connRes.rows) {
    console.log('  Servicio:', c.servicioNombre);
    console.log('  SMTP Host:', c.smtpHost);
    console.log('  SMTP Port:', c.smtpPort);
    console.log('  SMTP User:', c.smtpUser);
    console.log('  SMTP Pass:', c.smtpPass ? '[presente]' : '[vacío]');
    console.log('  Email From:', c.emailFrom);
    console.log('  ---');
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
