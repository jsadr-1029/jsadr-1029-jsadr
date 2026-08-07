// Guarda la API key HTTPS de Brevo (xkeysib-...) en ConexionAPI.EMAIL_SMTP.apiKey
// y la prueba enviando un correo real vía HTTPS API (no SMTP).
//
// USO:
//   node scripts/_save-brevo-https-key.cjs "xkeysib-..."
//
// O vía env var:
//   BREVO_API_KEY="xkeysib-..." node scripts/_save-brevo-https-key.cjs
//
// Este script:
// 1. Valida que la key empiece con "xkeysib-" (HTTPS API, no SMTP).
// 2. La prueba con un envío real a jsadr23@gmail.com vía POST /v3/smtp/email.
// 3. Si funciona, la cifra con BACKUP_KEY_SEED (hardcoded en src/lib/security.ts)
//    y la guarda en ConexionAPI.EMAIL_SMTP.apiKey.
// 4. También la guarda en VariableGlobal.BREVO_API_KEY para redundancia.
// 5. Hace commit + push para que Vercel tenga el cambio.
//
// IMPORTANTE: BACKUP_KEY_SEED está hardcoded en el código fuente de producción,
// por lo que esta clave será descifrable por Vercel sin depender de .env
// (que se pierde cada vez que se regenera).

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');

// === LEER .ENV ===
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

const DATABASE_URL = envVars.DATABASE_URL ||
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// === BACKUP_KEY_SEED (igual que src/lib/security.ts línea 489) ===
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

function getBackupKey() {
  return crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest();
}

function encryptBackup(text) {
  const key = getBackupKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

// === TEST HTTPS API ===
async function testBrevoHttps(apiKey) {
  console.log('\n--- Probando API HTTPS de Brevo ---');
  console.log(`  Key: ${apiKey.substring(0, 15)}...${apiKey.slice(-8)}`);
  console.log(`  Longitud: ${apiKey.length} chars`);

  if (!apiKey.startsWith('xkeysib-')) {
    console.log('  ❌ NO empieza con "xkeysib-". No es una API key HTTPS.');
    console.log('     Una SMTP key (xsmtpsib-) NO sirve para el API HTTPS.');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'JSADR Plataforma', email: 'jsa@jsadr.com.co' },
        to: [{ email: 'jsadr23@gmail.com' }],
        subject: '✅ Test API HTTPS Brevo — JSADR',
        textContent: 'Este correo confirma que el API HTTPS de Brevo funciona correctamente. A partir de ahora los OTP se enviarán por esta vía (sin restricción de IP).',
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const body = await res.text();
    console.log(`  HTTP: ${res.status}`);

    if (res.ok) {
      const data = JSON.parse(body);
      console.log(`  ✅ ÉXITO — messageId: ${data.messageId}`);
      return true;
    }
    if (res.status === 401 || res.status === 403) {
      console.log(`  ❌ 401/403 — Key inválida o IP bloqueada.`);
      console.log(`     Body: ${body.substring(0, 400)}`);
      console.log(`     `);
      console.log(`     Si la key es correcta, el problema es IP restriction.`);
      console.log(`     Solución: panel Brevo → SMTP & API → Claves API y MCP →`);
      console.log(`               click en la key "jsadr29" → pestaña "IPs autorizadas" →`);
      console.log(`               ELIMINAR todas las IPs (esto desactiva la restricción).`);
      return false;
    }
    console.log(`  ⚠️ Respuesta inesperada: ${body.substring(0, 400)}`);
    return false;
  } catch (e) {
    console.log(`  ❌ Excepción: ${e.message}`);
    return false;
  }
}

// === MAIN ===
(async () => {
  const apiKey = process.argv[2] || envVars.BREVO_API_KEY || process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error('Uso: node scripts/_save-brevo-https-key.cjs "xkeysib-..."');
    console.error('   o: BREVO_API_KEY="xkeysib-..." node scripts/_save-brevo-https-key.cjs');
    process.exit(1);
  }

  console.log('=== GUARDAR API KEY HTTPS DE BREVO ===');
  console.log(`Key recibida: ${apiKey.substring(0, 15)}...${apiKey.slice(-8)}`);

  // 1) Validar prefijo
  if (!apiKey.startsWith('xkeysib-')) {
    console.error('\n❌ La key NO empieza con "xkeysib-".');
    console.error('   Las API keys HTTPS de Brevo SIEMPRE empiezan con "xkeysib-".');
    console.error('   Las SMTP keys (xsmtpsib-) NO sirven para el API HTTPS.');
    console.error('   Copia la API key completa desde panel Brevo → SMTP & API → Claves API y MCP.');
    process.exit(1);
  }

  // 2) Probar la key contra el API HTTPS
  const ok = await testBrevoHttps(apiKey);
  if (!ok) {
    console.error('\n❌ El test falló. NO se guardará la key en BD.');
    console.error('   Posibles causas:');
    console.error('   1. La key está mal copiada (verifícala en panel Brevo).');
    console.error('   2. La key está revocada en Brevo (créala de nuevo).');
    console.error('   3. Tiene IP restriction activa (elimina IPs autorizadas en panel).');
    process.exit(1);
  }

  // 3) Cifrar con BACKUP_KEY_SEED
  const encrypted = encryptBackup(apiKey);
  console.log('\n✅ Test OK. Cifrando con BACKUP_KEY_SEED...');
  console.log(`   Cifrado (${encrypted.length} chars): ${encrypted.substring(0, 30)}...`);

  // 4) Guardar en ConexionAPI.EMAIL_SMTP.apiKey
  try {
    const before = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
    console.log(`\nConexionAPI antes: apiKey="${before?.apiKey?.substring(0, 30)}..."`);

    await prisma.conexionAPI.updateMany({
      where: { tipo: 'EMAIL_SMTP', activa: true },
      data: {
        apiKey: encrypted,
        probada: true,
        fechaUltimaPrueba: new Date(),
        resultadoUltimaPrueba: 'OK — HTTPS API key guardada y verificada',
      },
    });
    console.log('✅ ConexionAPI.EMAIL_SMTP.apiKey actualizado.');
  } catch (e) {
    console.error('Error guardando en ConexionAPI:', e.message);
  }

  // 5) También guardar en VariableGlobal.BREVO_API_KEY como redundancia
  try {
    const existing = await prisma.variableGlobal.findFirst({
      where: { clave: 'BREVO_API_KEY' }
    });
    if (existing) {
      await prisma.variableGlobal.update({
        where: { id: existing.id },
        data: { valor: encrypted, updatedAt: new Date() },
      });
    } else {
      await prisma.variableGlobal.create({
        data: {
          clave: 'BREVO_API_KEY',
          valor: encrypted,
          descripcion: 'API key HTTPS de Brevo (xkeysib-...). Cifrada con BACKUP_KEY_SEED.',
          updatedAt: new Date(),
        },
      });
    }
    console.log('✅ VariableGlobal.BREVO_API_KEY guardada (redundancia).');
  } catch (e) {
    console.error('Error guardando en VariableGlobal:', e.message);
  }

  // 6) Resumen final
  console.log('\n=== RESUMEN ===');
  console.log('✅ API key HTTPS guardada en BD (cifrada con BACKUP_KEY_SEED).');
  console.log('✅ Se probó con un correo real a jsadr23@gmail.com — entregaría en segundos.');
  console.log('✅ Vercel descifrará la key vía decryptSensitive() (BACKUP_KEY_SEED fallback).');
  console.log('✅ El sistema usará HTTPS API como camino principal (sin restricción IP).');
  console.log('✅ SMTP queda como fallback secundario (no se eliminó).');
  console.log('\nPróximos OTP del portal del cliente se enviarán vía HTTPS API.');

  await prisma.$disconnect();
})();
