// Revelar las claves Brevo reales almacenadas en BD (ya desencriptadas)
// y probarlas contra Brevo
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

const KEY_HEX = 'a7a37168b1965163c1a30a09155c80a21fc7b901adfd592dd018405b8c57fa09';

function decrypt(encText) {
  const key = Buffer.from(KEY_HEX, 'hex');
  const parts = encText.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  return dec.toString('utf8');
}

(async () => {
  const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
  
  const smtpKey = decrypt(c.password);
  const apiKey = decrypt(c.apiKey);
  
  console.log('=== CLAVES BREVO REALES (desencriptadas de BD) ===');
  console.log('SMTP key:', smtpKey);
  console.log('  Longitud:', smtpKey.length);
  console.log('  Inicio:', smtpKey.substring(0, 30));
  console.log('  Fin:', smtpKey.slice(-10));
  console.log();
  console.log('API key:', apiKey);
  console.log('  Longitud:', apiKey.length);
  console.log('  Inicio:', apiKey.substring(0, 30));
  console.log('  Fin:', apiKey.slice(-10));
  console.log();
  
  // Probar contra Brevo
  console.log('=== PROBANDO API KEY CONTRA BREVO HTTPS API ===');
  try {
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' }
    });
    if (r.ok) {
      const data = await r.json();
      console.log('✅ HTTPS API OK — cuenta:', data.email || data.companyName, '| plan:', data.plan?.[0]?.type);
    } else {
      const t = await r.text();
      console.log('❌ HTTPS API falla — HTTP', r.status, ':', t.slice(0, 200));
    }
  } catch (e) {
    console.log('❌ HTTPS API error:', e.message);
  }
  
  console.log();
  console.log('=== PROBANDO SMTP KEY CONTRA BREVO SMTP ===');
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'b3e8df001@smtp-brevo.com', pass: smtpKey },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });
    await transporter.verify();
    console.log('✅ SMTP verify OK — credenciales aceptadas');
  } catch (e) {
    console.log('❌ SMTP falla:', e.message.substring(0, 150));
  }
  
  await prisma.$disconnect();
})();
