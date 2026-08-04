const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

function getBackupKey() {
  return crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest();
}
function decryptBackup(encText) {
  const parts = encText.split(':');
  if (parts.length !== 2) return encText;
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getBackupKey(), iv);
  let dec = decipher.update(parts[1], 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

(async () => {
  const correo = await prisma.correoInstitucional.findFirst({ where: { esPrincipal: true } });
  if (!correo) { console.log('no hay correo'); return; }
  console.log('smtpPass (encrypted, len):', correo.smtpPass?.length || 0);
  console.log('smtpPassBackup (encrypted, len):', correo.smtpPassBackup?.length || 0);
  if (correo.smtpPassBackup) {
    try {
      const dec = decryptBackup(correo.smtpPassBackup);
      console.log('smtpPassBackup desencriptado (primeros 4 / últimos 4):');
      console.log('  ' + dec.substring(0, 4) + '...' + dec.substring(dec.length - 4));
    } catch (e) {
      console.log('  no se pudo desencriptar backup:', e.message);
    }
  }
  await prisma.$disconnect();
})();
