// Decrypt Brevo SMTP key from ConexionAPI and verify it against Brevo SMTP
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
  if (!c) { console.log('No ConexionAPI found'); return; }
  
  const key = 'a7a37168b1965163c1a30a09155c80a21fc7b901adfd592dd018405b8c57fa09';
  const parts = c.password.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  const decrypted = dec.toString('utf8');
  console.log('Full Brevo SMTP key from DB:', decrypted);
  console.log('Length:', decrypted.length);
  
  // Compare with .env BREVO_SMTP_KEY
  const fs = require('fs');
  const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
  const envMatch = envContent.match(/BREVO_SMTP_KEY="?([^\\"\n]+)"?/);
  if (envMatch) {
    const envKey = envMatch[1];
    console.log('\n.env BREVO_SMTP_KEY:', envKey);
    console.log('DB key == .env key?', decrypted === envKey);
  }
  
  // Test SMTP auth directly with nodemailer
  console.log('\n=== Test SMTP connection ===');
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: 'b3e8df001@smtp-brevo.com', pass: decrypted },
  });
  
  try {
    await transporter.verify();
    console.log('✅ SMTP verify SUCCESS — Brevo accepted the credentials');
  } catch (err) {
    console.log('❌ SMTP verify FAILED:', err.message);
    console.log('Code:', err.code);
    console.log('Response:', err.response);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
