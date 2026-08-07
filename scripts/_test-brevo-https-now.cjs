// Test directo del API HTTPS de Brevo con la SMTP key actual (que está mal en apiKey)
// para confirmar que el sistema está usando el valor equivocado.
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');

const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    envVars[m[1]] = v;
  }
});

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});

function getBackupKey() {
  const seed =
    'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
    'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
    'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';
  return crypto.createHash('sha256').update(seed).digest();
}

function decryptBackup(encText) {
  try {
    const parts = encText.split(':');
    if (parts.length !== 2) return encText;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getBackupKey(), iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) { return encText; }
}

async function testBrevoApi(apiKey, label) {
  console.log(`\n--- Test Brevo HTTPS API (${label}) ---`);
  console.log(`  Key (primeros 20): "${apiKey.substring(0, 20)}..."`);
  console.log(`  Key (últimos 10):  "...${apiKey.slice(-10)}"`);
  console.log(`  longitud: ${apiKey.length}`);
  console.log(`  prefijo xkeysib-: ${apiKey.startsWith('xkeysib-')}`);
  console.log(`  prefijo xsmtpsib-: ${apiKey.startsWith('xsmtpsib-')}`);

  if (!apiKey.startsWith('xkeysib-')) {
    console.log(`  ⚠️  Esta NO es una API key HTTPS. Es una SMTP key.`);
    console.log(`     Brevo rechazará con HTTP 401 porque el header api-key requiere xkeysib-.`);
    return;
  }

  // Hacer una llamada real al API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Test JSADR', email: 'jsa@jsadr.com.co' },
        to: [{ email: 'jsadr23@gmail.com' }],
        subject: 'Test API Brevo desde diagnóstico',
        textContent: 'Si recibes esto, el API HTTPS de Brevo funciona correctamente.',
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const body = await res.text();
    console.log(`  HTTP status: ${res.status}`);
    console.log(`  Body: ${body.substring(0, 300)}`);
    if (res.ok) {
      console.log(`  ✅ API HTTPS FUNCIONA — correo encolado`);
    } else if (res.status === 401 || res.status === 403) {
      console.log(`  ❌ 401/403 — Key inválida o IP no autorizada`);
    } else {
      console.log(`  ⚠️  Respuesta inesperada`);
    }
  } catch (e) {
    console.log(`  ❌ Excepción: ${e.message}`);
  }
}

(async () => {
  try {
    const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
    if (!c) { console.log('Sin conexion EMAIL_SMTP'); return; }

    const decryptedApiKey = decryptBackup(c.apiKey);
    const decryptedPassword = decryptBackup(c.password);

    console.log('=== ESTADO ACTUAL ===');
    console.log(`conexion.apiKey desencriptado:`);
    console.log(`  primeros 30: "${decryptedApiKey.substring(0, 30)}"`);
    console.log(`  últimos 10:  "...${decryptedApiKey.slice(-10)}"`);
    console.log(`conexion.password desencriptado:`);
    console.log(`  primeros 30: "${decryptedPassword.substring(0, 30)}"`);
    console.log(`  últimos 10:  "...${decryptedPassword.slice(-10)}"`);

    // Test con el apiKey actual (que sabemos que es la SMTP key, mal puesta)
    await testBrevoApi(decryptedApiKey, 'apiKey actual en BD');

    // Test con la SMTP key tratando de usarla como API key (debe fallar)
    if (decryptedPassword !== decryptedApiKey) {
      await testBrevoApi(decryptedPassword, 'password actual en BD');
    }

    // Verificar variables de entorno
    console.log('\n=== ENV VARS ===');
    console.log(`BREVO_API_KEY en .env: ${envVars.BREVO_API_KEY ? 'PRESENTE' : 'AUSENTE'}`);
    if (envVars.BREVO_API_KEY) {
      await testBrevoApi(envVars.BREVO_API_KEY, 'BREVO_API_KEY desde .env');
    }

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
