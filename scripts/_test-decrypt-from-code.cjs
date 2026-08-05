// Última esperanza: usar la MISMA función decryptSensitive del src/lib/security.ts
// para intentar desencriptar. Esto valida que la implementación del código coincida.
// Si esto falla, la única solución es que el admin reingrese las credenciales.

require('dotenv').config({ path: '/home/z/my-project/.env' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-cbc';

// Réplica EXACTA de src/lib/security.ts → getEncryptionKey()
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) {
    return crypto.createHash('sha256').update('dev-temp-encryption-key').digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

// Réplica EXACTA de src/lib/security.ts → decryptSensitive()
function decryptSensitive(encryptedText) {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText; // devuelve original si falla
  }
}

(async () => {
  const key = getEncryptionKey();
  console.log('API_ENCRYPTION_KEY raw:', process.env.API_ENCRYPTION_KEY);
  console.log('Llave derivada (hex):', key.toString('hex'));
  console.log('Llave derivada (primeros 16 chars):', key.toString('hex').substring(0, 16));
  console.log();

  const conexion = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } });
  if (!conexion) {
    console.log('NO HAY ConexionAPI.EMAIL_SMTP');
    return;
  }
  console.log('ConexionAPI.EMAIL_SMTP:');
  console.log('  apiKey raw (primeros 60):', conexion.apiKey?.substring(0, 60));
  console.log('  password raw (primeros 60):', conexion.password?.substring(0, 60));

  const apiDecrypted = decryptSensitive(conexion.apiKey);
  const passDecrypted = decryptSensitive(conexion.password);

  console.log();
  console.log('Resultado desencriptación:');
  console.log('  apiKey desencriptada:', apiDecrypted.substring(0, 30) + (apiDecrypted === conexion.apiKey ? ' [FALLÓ — retornó original]' : ' [OK]'));
  console.log('  password desencriptado:', passDecrypted.substring(0, 30) + (passDecrypted === conexion.password ? ' [FALLÓ — retornó original]' : ' [OK]'));

  if (apiDecrypted !== conexion.apiKey) {
    console.log();
    console.log('=== ¡API KEY RECUPERADA! ===');
    console.log('Valor:', apiDecrypted);
    console.log('¿Empieza con xkeysib-?', apiDecrypted.startsWith('xkeysib-'));
  }

  if (passDecrypted !== conexion.password) {
    console.log();
    console.log('=== ¡SMTP KEY RECUPERADA! ===');
    console.log('Valor:', passDecrypted);
    console.log('¿Empieza con xsmtpsib-?', passDecrypted.startsWith('xsmtpsib-'));
  }

  // También probar CorreoInstitucional
  const correo = await prisma.correoInstitucional.findFirst({ where: { esPrincipal: true } });
  if (correo) {
    console.log();
    console.log('CorreoInstitucional.smtpPass raw:', correo.smtpPass?.substring(0, 60));
    const smtpPass = decryptSensitive(correo.smtpPass);
    if (smtpPass !== correo.smtpPass) {
      console.log('=== ¡SMTP PASS RECUPERADO! ===');
      console.log('Valor:', smtpPass);
    } else {
      console.log('SMTP pass no se pudo desencriptar (igual al original)');
    }
  }

  await prisma.$disconnect();
})();
