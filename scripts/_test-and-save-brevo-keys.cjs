/**
 * Probar las claves Brevo.
 * Uso:
 *   BREVO_SMTP_KEY=xsmtpsib-... node scripts/_test-and-save-brevo-keys.cjs
 *   BREVO_API_KEY=xkeysib-...   (opcional)
 *
 * Si las credenciales pasan la prueba, se guardan CIFRADAS en:
 *   - ConexionAPI.EMAIL_SMTP.apiKey + password
 *   - CorreoInstitucional.smtpPass
 */
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Cargar .env
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});

// Llaves desde variables de entorno (no hardcoded)
const SMTP_KEY = process.env.BREVO_SMTP_KEY;
const API_KEY = process.env.BREVO_API_KEY;

if (!SMTP_KEY && !API_KEY) {
  console.error('ERROR: Debes pasar BREVO_SMTP_KEY o BREVO_API_KEY como variable de entorno.');
  console.error('Ejemplo: BREVO_SMTP_KEY=xsmtpsib-... node scripts/_test-and-save-brevo-keys.cjs');
  process.exit(1);
}

console.log('=== Probar claves Brevo ===\n');
if (SMTP_KEY) console.log('SMTP key proporcionada: ...' + SMTP_KEY.slice(-12));
if (API_KEY) console.log('API key proporcionada: ...' + API_KEY.slice(-12));
console.log('');

async function probarApiKey(name, apiKey) {
  console.log(`--- ${name}: ${apiKey.slice(0, 30)}...${apiKey.slice(-10)} ---`);
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ VÁLIDA. Cuenta: ${data.email}  Plan: ${data.plan?.[0]?.type || '?'}`);
      return true;
    } else {
      const txt = await res.text();
      console.log(`  ✗ HTTP ${res.status}: ${txt.substring(0, 200)}`);
      return false;
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
    return false;
  }
}

async function probarSmtpKey(name, smtpKey) {
  console.log(`--- ${name}: ${smtpKey.slice(0, 30)}...${smtpKey.slice(-10)} ---`);
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'b3e8df001@smtp-brevo.com', pass: smtpKey },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transporter.verify();
    console.log('  ✓ SMTP VERIFICADA OK');
    return true;
  } catch (e) {
    console.log(`  ✗ Error: ${e.message.substring(0, 200)}`);
    return false;
  }
}

(async () => {
  let workingApiKey = null;
  let workingSmtpKey = null;

  // 1. Probar API key (si fue proporcionada)
  if (API_KEY) {
    const apiOk = await probarApiKey('API key (BREVO_API_KEY)', API_KEY);
    if (apiOk) workingApiKey = API_KEY;
  }

  // 2. Probar SMTP key (si fue proporcionada)
  if (SMTP_KEY) {
    const smtpOk = await probarSmtpKey('SMTP key (BREVO_SMTP_KEY)', SMTP_KEY);
    if (smtpOk) workingSmtpKey = SMTP_KEY;
  }

  console.log('\n=== RESUMEN ===');
  console.log('API key válida: ', workingApiKey ? '✓' : '✗');
  console.log('SMTP key válida:', workingSmtpKey ? '✓' : '✗');

  if (workingApiKey || workingSmtpKey) {
    console.log('\n=== GUARDAR EN BD ===');
    const ALGORITHM = 'aes-256-cbc';
    const keyBuf = Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex');
    function encrypt(text) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv);
      let enc = cipher.update(text, 'utf8', 'hex');
      enc += cipher.final('hex');
      return iv.toString('hex') + ':' + enc;
    }

    if (workingApiKey) {
      const enc = encrypt(workingApiKey);
      await prisma.conexionAPI.updateMany({
        where: { tipo: 'EMAIL_SMTP' },
        data: { apiKey: enc, activa: true, probada: false }
      });
      console.log('✓ API key guardada en ConexionAPI.EMAIL_SMTP.apiKey');
    }
    if (workingSmtpKey) {
      const enc = encrypt(workingSmtpKey);
      await prisma.conexionAPI.updateMany({
        where: { tipo: 'EMAIL_SMTP' },
        data: { password: enc, activa: true, probada: false }
      });
      // También en CorreoInstitucional.smtpPass
      await prisma.correoInstitucional.updateMany({
        where: { esPrincipal: true, estado: 'activo' },
        data: { smtpPass: enc }
      });
      console.log('✓ SMTP key guardada en ConexionAPI.EMAIL_SMTP.password + CorreoInstitucional.smtpPass');
    }

    // Enviar correo de prueba
    if (workingApiKey) {
      console.log('\n=== ENVÍO DE PRUEBA vía API ===');
      const body = {
        sender: { name: 'JSADR Diagnóstico', email: 'jsa@jsadr.com.co' },
        to: [{ email: 'jsadr23@gmail.com' }],
        subject: '[JSADR] OTP reparado — ' + new Date().toISOString(),
        textContent: 'Este correo confirma que el sistema de OTP está funcionando correctamente después de la reparación.',
      };
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': workingApiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      console.log(`HTTP ${res.status}`);
      console.log(`Respuesta: ${txt.substring(0, 300)}`);
    }
  } else {
    console.log('\n⚠ Ninguna clave funcionó. Verifica las credenciales en panel Brevo.');
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
