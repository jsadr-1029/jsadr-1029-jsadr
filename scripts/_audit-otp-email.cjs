/**
 * Diagnóstico completo del estado de OTP/Email:
 * 1. Verifica credenciales Brevo en BD
 * 2. Intenta descifrar apiKey y password
 * 3. Lista EnvioCorreo recientes (últimos 20)
 * 4. Lista CorreoInstitucional activos
 * 5. Verifica .env (SMTP_PASS, BREVO_API_KEY)
 * 6. Prueba Brevo HTTPS API con la key descifrada (si funciona)
 */
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-cbc';

// Candidate keys (todas las posibles API_ENCRYPTION_KEY usadas históricamente)
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

const candidateKeys = [
  { name: 'API_ENCRYPTION_KEY (hex)', buf: Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex') },
  { name: 'API_ENCRYPTION_KEY (sha256)', buf: crypto.createHash('sha256').update(process.env.API_ENCRYPTION_KEY).digest() },
  { name: 'BACKUP_KEY_SEED (sha256)', buf: crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest() },
  { name: 'dev-temp-encryption-key (sha256)', buf: crypto.createHash('sha256').update('dev-temp-encryption-key').digest() },
  { name: 'jsadr-backup-key-recovery-2024!! (sha256)', buf: crypto.createHash('sha256').update('jsadr-backup-key-recovery-2024!!').digest() },
  { name: 'jsadr-encryption-key-32bytes!! (sha256)', buf: crypto.createHash('sha256').update('jsadr-encryption-key-32bytes!!').digest() },
];

function tryDecrypt(encrypted, keyBuf) {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const data = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) { return null; }
}

function decryptWithCandidates(encrypted) {
  for (const k of candidateKeys) {
    const d = tryDecrypt(encrypted, k.buf);
    if (d !== null) return { decrypted: d, key: k.name };
  }
  return null;
}

(async () => {
  console.log('\n========================================');
  console.log(' DIAGNÓSTICO OTP/EMAIL — JSADR');
  console.log(' ' + new Date().toISOString());
  console.log('========================================\n');

  // 1. .env
  console.log('=== 1. VARIABLES .ENV ===');
  console.log('  API_ENCRYPTION_KEY:', process.env.API_ENCRYPTION_KEY ? process.env.API_ENCRYPTION_KEY.substring(0, 16) + '...' : '(vacío)');
  console.log('  SMTP_HOST:', process.env.SMTP_HOST || '(vacío)');
  console.log('  SMTP_USER:', process.env.SMTP_USER || '(vacío)');
  console.log('  SMTP_PASS:', process.env.SMTP_PASS ? process.env.SMTP_PASS.substring(0, 10) + '...' : '(VACÍO — no fallback)');
  console.log('  BREVO_API_KEY:', process.env.BREVO_API_KEY || '(vacío — no env var)');
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('');

  // 2. ConexionAPI.EMAIL_SMTP
  console.log('=== 2. ConexionAPI.EMAIL_SMTP ===');
  const conexiones = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } });
  console.log(`  Total conexiones: ${conexiones.length}\n`);
  let workingApiKey = null;
  let workingSmtpKey = null;
  for (const c of conexiones) {
    console.log(`  [${c.nombre}] activa=${c.activa} probada=${c.probada}`);
    console.log(`    usuario: ${c.usuario}`);
    console.log(`    url: ${c.url}`);
    console.log(`    configuracionExtra: ${c.configuracionExtra}`);
    if (c.apiKey) {
      const r = decryptWithCandidates(c.apiKey);
      if (r) {
        console.log(`    apiKey DESCIFRADA con: ${r.key}`);
        console.log(`    apiKey valor: ${r.decrypted.substring(0, 20)}...${r.decrypted.slice(-8)}`);
        if (r.decrypted.startsWith('xkeysib-')) workingApiKey = r.decrypted;
        else console.log(`    ⚠️  apiKey NO empieza con xkeysib- (no es API key válida de Brevo)`);
      } else {
        console.log(`    apiKey NO descifrable con ninguna de ${candidateKeys.length} llaves candidatas`);
      }
    }
    if (c.password) {
      const r = decryptWithCandidates(c.password);
      if (r) {
        console.log(`    password DESCIFRADA con: ${r.key}`);
        console.log(`    password valor: ${r.decrypted.substring(0, 20)}...${r.decrypted.slice(-8)}`);
        if (r.decrypted.startsWith('xsmtpsib-')) workingSmtpKey = r.decrypted;
        else console.log(`    ⚠️  password NO empieza con xsmtpsib- (no es SMTP key válida de Brevo)`);
      } else {
        console.log(`    password NO descifrable con ninguna de ${candidateKeys.length} llaves candidatas`);
      }
    }
    console.log(`    fechaUltimaPrueba: ${c.fechaUltimaPrueba}`);
    console.log(`    resultadoUltimaPrueba: ${c.resultadoUltimaPrueba}`);
    console.log('');
  }

  // 3. CorreoInstitucional
  console.log('=== 3. CorreoInstitucional ===');
  try {
    const correos = await prisma.correoInstitucional.findMany();
    console.log(`  Total: ${correos.length}\n`);
    for (const c of correos) {
      console.log(`  [${c.email}] estado=${c.estado} principal=${c.esPrincipal}`);
      console.log(`    smtpHost: ${c.smtpHost}  port: ${c.smtpPort}`);
      console.log(`    smtpUser: ${c.smtpUser}`);
      if (c.smtpPass) {
        const r = decryptWithCandidates(c.smtpPass);
        if (r) console.log(`    smtpPass DESCIFRADA con ${r.key}: ${r.decrypted.substring(0, 20)}...`);
        else console.log(`    smtpPass NO descifrable`);
      }
      if (c.smtpPassBackup) {
        const r = decryptWithCandidates(c.smtpPassBackup);
        if (r) console.log(`    smtpPassBackup DESCIFRADA con ${r.key}: ${r.decrypted.substring(0, 20)}...`);
        else console.log(`    smtpPassBackup NO descifrable`);
      }
      console.log('');
    }
  } catch (e) { console.log('  (No se pudo leer CorreoInstitucional:', e.message + ')'); }

  // 4. EnvioCorreo recientes
  console.log('=== 4. Últimos 15 EnvioCorreo ===');
  try {
    const envios = await prisma.envioCorreo.findMany({
      orderBy: { fechaEnvio: 'desc' },
      take: 15,
    });
    console.log(`  Total últimos 15: ${envios.length}\n`);
    for (const e of envios) {
      console.log(`  ${e.fechaEnvio?.toISOString?.() || e.fechaEnvio} | ${e.estado} | ${e.destinatario}`);
      console.log(`    asunto: ${e.asunto}`);
      console.log(`    via: ${e.enviadoPorNombre}`);
      if (e.mensajeError) console.log(`    error: ${e.mensajeError.substring(0, 200)}`);
      console.log('');
    }
  } catch (e) { console.log('  (No se pudo leer EnvioCorreo:', e.message + ')'); }

  // 5. Probar Brevo API con la key descifrada
  if (workingApiKey) {
    console.log('=== 5. PRUEBA Brevo HTTPS API ===');
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': workingApiKey, accept: 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`  ✓ API key válida. Cuenta: ${data.email} (plan: ${data.plan?.[0]?.type || 'unknown'})`);
      } else {
        console.log(`  ✗ API key inválida. HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (e) {
      console.log('  ✗ Error al probar API:', e.message);
    }

    // 5b. Enviar un correo de prueba
    console.log('\n=== 6. ENVÍO DE PRUEBA vía Brevo API ===');
    try {
      const body = {
        sender: { name: 'JSADR Test', email: 'jsa@jsadr.com.co' },
        to: [{ email: 'jsadr23@gmail.com' }],
        subject: '[JSADR] Diagnóstico OTP ' + new Date().toISOString(),
        textContent: 'Correo de prueba generado por script de diagnóstico. Si lo recibes, Brevo API funciona correctamente.',
      };
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': workingApiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      console.log(`  HTTP ${res.status}`);
      console.log(`  Respuesta: ${txt.substring(0, 300)}`);
    } catch (e) { console.log('  ✗ Error:', e.message); }
  } else {
    console.log('\n=== 5. PRUEBA Brevo API ===');
    console.log('  ⚠ No hay API key descifrable. No se puede probar.');
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
