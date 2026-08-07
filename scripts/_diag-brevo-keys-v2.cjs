// Diagnóstico completo de credenciales Brevo en BD
// Usa tanto API_ENCRYPTION_KEY como BACKUP_KEY_SEED (igual que producción)
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Leer .env manualmente
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

function getEnvKey() {
  const raw = envVars.API_ENCRYPTION_KEY || 'dev-temp-encryption-key';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function getBackupKey() {
  const seed =
    'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
    'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
    'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';
  return crypto.createHash('sha256').update(seed).digest();
}

function tryDecrypt(encText, key, label) {
  try {
    const parts = encText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) {
    return null;
  }
}

function decryptFull(encText) {
  if (!encText) return { value: null, via: 'none' };
  const parts = encText.split(':');
  if (parts.length !== 2) return { value: encText, via: 'plain' };

  const v1 = tryDecrypt(encText, getEnvKey(), 'env');
  if (v1 !== null) return { value: v1, via: 'API_ENCRYPTION_KEY' };

  const v2 = tryDecrypt(encText, getBackupKey(), 'backup');
  if (v2 !== null) return { value: v2, via: 'BACKUP_KEY_SEED' };

  return { value: encText, via: 'FAILED' };
}

(async () => {
  try {
    console.log('=== Estado de credenciales Brevo ===\n');

    const conexiones = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } });
    console.log(`ConexionAPI.EMAIL_SMTP (${conexiones.length}):`);
    for (const c of conexiones) {
      console.log(`  - id: ${c.id}`);
      console.log(`    nombre: ${c.nombre}`);
      console.log(`    activa: ${c.activa}`);
      console.log(`    url: ${c.url}`);
      console.log(`    usuario: ${c.usuario}`);

      // Password (SMTP key)
      const p = decryptFull(c.password);
      console.log(`    password (SMTP key):`);
      console.log(`      desencriptado via: ${p.via}`);
      if (p.value) {
        const v = p.value;
        console.log(`      primeros 30 chars: "${v.substring(0, 30)}"`);
        console.log(`      últimos 10 chars: "${v.slice(-10)}"`);
        console.log(`      longitud: ${v.length}`);
        console.log(`      prefijo xsmtpsib-: ${v.startsWith('xsmtpsib-')}`);
        console.log(`      prefijo xkeysib-: ${v.startsWith('xkeysib-')}`);
      }

      // API Key (HTTPS API)
      const a = decryptFull(c.apiKey);
      console.log(`    apiKey (HTTPS API key):`);
      console.log(`      desencriptado via: ${a.via}`);
      if (a.value) {
        const v = a.value;
        console.log(`      primeros 30 chars: "${v.substring(0, 30)}"`);
        console.log(`      últimos 10 chars: "${v.slice(-10)}"`);
        console.log(`      longitud: ${v.length}`);
        console.log(`      prefijo xsmtpsib-: ${v.startsWith('xsmtpsib-')}`);
        console.log(`      prefijo xkeysib-: ${v.startsWith('xkeysib-')}`);
      }
      console.log();
    }

    // CorreoInstitucional
    const correos = await prisma.correoInstitucional.findMany({ where: { estado: 'activo' } });
    console.log(`\nCorreoInstitucional activo (${correos.length}):`);
    for (const c of correos) {
      console.log(`  - id: ${c.id}`);
      console.log(`    email: ${c.email}`);
      console.log(`    smtpHost: ${c.smtpHost}`);
      console.log(`    smtpUser: ${c.smtpUser}`);
      const s = decryptFull(c.smtpPass);
      console.log(`    smtpPass desencriptado via: ${s.via}`);
      if (s.value) {
        console.log(`      primeros 30 chars: "${s.value.substring(0, 30)}"`);
        console.log(`      últimos 10 chars: "${s.value.slice(-10)}"`);
        console.log(`      longitud: ${s.value.length}`);
        console.log(`      prefijo xsmtpsib-: ${s.value.startsWith('xsmtpsib-')}`);
        console.log(`      prefijo xkeysib-: ${s.value.startsWith('xkeysib-')}`);
      }
    }

    // Verificar .env vars
    console.log('\n=== Variables .env ===');
    console.log('  BREVO_API_KEY:', envVars.BREVO_API_KEY ? `presente (${envVars.BREVO_API_KEY.length} chars, prefijo=${envVars.BREVO_API_KEY.substring(0, 8)})` : 'AUSENTE');
    console.log('  SMTP_PASS:', envVars.SMTP_PASS ? `presente (${envVars.SMTP_PASS.length} chars)` : 'vacío');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
