// Diagnóstico integral del estado del sistema de correos
require('dotenv').config({ path: '/home/z/my-project/.env' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'jsadr-encryption-key-32bytes!!';
// ATENCIÓN: debe coincidir EXACTAMENTE con src/lib/security.ts → BACKUP_KEY_SEED
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

function getKey(seed) { return crypto.createHash('sha256').update(seed).digest(); }
function tryDecrypt(ciphertext, key) {
  if (!ciphertext || !ciphertext.includes(':')) return null;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 2) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parts[0], 'hex'));
    return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
  } catch (e) { return null; }
}

(async () => {
  try {
    console.log('=== DIAGNÓSTICO SISTEMA DE CORREOS ===');
    console.log('API_ENCRYPTION_KEY actual:', ENCRYPTION_KEY);
    console.log('Hash SHA256:', getKey(ENCRYPTION_KEY).toString('hex').substring(0, 16) + '...');
    console.log();

    const conexion = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } });
    if (!conexion) {
      console.log('NO HAY ConexionAPI.EMAIL_SMTP registrada');
      return;
    }
    console.log('--- ConexionAPI.EMAIL_SMTP ---');
    console.log('  activa:', conexion.activa);
    console.log('  probada:', conexion.probada);
    console.log('  resultadoUltimaPrueba:', conexion.resultadoUltimaPrueba);
    console.log('  apiKey (cifrada):', conexion.apiKey?.substring(0, 40) + '...');
    console.log('  password (cifrada):', conexion.password?.substring(0, 40) + '...');
    console.log();

    const currentKey = getKey(ENCRYPTION_KEY);
    const backupKey = getKey(BACKUP_KEY_SEED);

    const apiCurrent = tryDecrypt(conexion.apiKey, currentKey);
    const apiBackup = tryDecrypt(conexion.apiKey, backupKey);
    const passCurrent = tryDecrypt(conexion.password, currentKey);
    const passBackup = tryDecrypt(conexion.password, backupKey);

    console.log('--- INTENTOS DE DESENCRIPTACIÓN ---');
    console.log('  apiKey con llave actual:', apiCurrent ? `${apiCurrent.substring(0, 20)}... ✓` : 'FALLÓ ✗');
    console.log('  apiKey con llave backup :', apiBackup ? `${apiBackup.substring(0, 20)}... ✓` : 'FALLÓ ✗');
    console.log('  password con llave actual:', passCurrent ? `${passCurrent.substring(0, 20)}... ✓` : 'FALLÓ ✗');
    console.log('  password con llave backup :', passBackup ? `${passBackup.substring(0, 20)}... ✓` : 'FALLÓ ✗');
    console.log();

    if (apiBackup && passBackup) {
      console.log('🎉 ¡CREDENCIALES RECUPERABLES VÍA BACKUP!');
      console.log('  apiKey real:', apiBackup);
      console.log('  smtpKey real:', passBackup);
      console.log();
      console.log('  → Proceder a re-cifrar con llave actual usando save-brevo-creds.js');
    } else {
      console.log('⚠️  No se pueden recuperar las credenciales con ninguna llave.');
      console.log('    El admin debe reingresar las credenciales Brevo manualmente.');
    }

    console.log();
    console.log('--- CorreoInstitucional ---');
    const correo = await prisma.correoInstitucional.findFirst({ where: { esPrincipal: true } });
    if (correo) {
      console.log('  email:', correo.email);
      console.log('  smtpHost:', correo.smtpHost);
      console.log('  smtpPort:', correo.smtpPort);
      console.log('  smtpUser:', correo.smtpUser);
      const smtpPassCurrent = tryDecrypt(correo.smtpPass, currentKey);
      const smtpPassBackup = tryDecrypt(correo.smtpPass, backupKey);
      const smtpPassBackupBackup = tryDecrypt(correo.smtpPassBackup, backupKey);
      const smtpPassBackupCurrent = tryDecrypt(correo.smtpPassBackup, currentKey);
      console.log('  smtpPass desencriptado (actual):', smtpPassCurrent ? '✓' : '✗');
      console.log('  smtpPass desencriptado (backup):', smtpPassBackup ? '✓' : '✗');
      console.log('  smtpPassBackup desencriptado (backup key):', smtpPassBackupBackup ? '✓' : '✗');
      console.log('  smtpPassBackup desencriptado (actual key):', smtpPassBackupCurrent ? '✓' : '✗');
      if (smtpPassBackup) console.log('  smtpPassBackup valor:', smtpPassBackup.substring(0, 20) + '...');
    }

    console.log();
    console.log('--- Últimos 5 EnvioCorreo ---');
    const envios = await prisma.envioCorreo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { createdAt: true, asunto: true, estado: true, destinatario: true, mensajeError: true },
    });
    if (envios.length === 0) console.log('  (sin envíos registrados)');
    envios.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.createdAt.toISOString()}] "${e.asunto}" → ${e.destinatario}`);
      console.log(`     estado: ${e.estado}`);
      if (e.mensajeError) console.log(`     error : ${(e.mensajeError || '').substring(0, 100)}`);
    });
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
