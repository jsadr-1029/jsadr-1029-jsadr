// Ver el estado actual de ConexionAPI.EMAIL_SMTP en BD
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY || 'dev-temp-encryption-key';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function decryptSensitive(encText) {
  try {
    const key = getEncryptionKey();
    const parts = encText.split(':');
    if (parts.length !== 2) return encText;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) { return encText; }
}

(async () => {
  try {
    const conexiones = await prisma.conexionAPI.findMany({
      where: { tipo: 'EMAIL_SMTP' }
    });
    console.log('=== CONEXIONES EMAIL_SMTP EN BD (' + conexiones.length + ') ===');
    for (const c of conexiones) {
      console.log({
        id: c.id,
        nombre: c.nombre,
        activa: c.activa,
        probada: c.probada,
        url: c.url,
        usuario: c.usuario,
        apiKey_prefix: c.apiKey ? c.apiKey.substring(0, 30) : null,
        apiKey_isEncrypted: c.apiKey && c.apiKey.split(':').length === 2,
        password_prefix: c.password ? c.password.substring(0, 30) : null,
        password_isEncrypted: c.password && c.password.split(':').length === 2,
        fechaUltimaPrueba: c.fechaUltimaPrueba,
        resultadoUltimaPrueba: c.resultadoUltimaPrueba
      });

      // Intentar desencriptar password
      if (c.password) {
        try {
          const dec = decryptSensitive(c.password);
          console.log('  password desencriptada:', dec.substring(0, 30) + '...' + dec.slice(-10), '(len=' + dec.length + ')');
        } catch (e) {
          console.log('  password NO cifrada (texto plano):', c.password.substring(0, 30) + '...');
        }
      }
      // Intentar desencriptar apiKey
      if (c.apiKey) {
        try {
          const dec = decryptSensitive(c.apiKey);
          console.log('  apiKey desencriptada:', dec.substring(0, 30) + '...' + dec.slice(-10), '(len=' + dec.length + ')');
        } catch (e) {
          console.log('  apiKey NO cifrada (texto plano):', c.apiKey.substring(0, 30) + '...');
        }
      }
      console.log();
    }

    // Listar también Configuración con claves BREVO
    const configs = await prisma.configuracion.findMany({
      where: { clave: { contains: 'BREVO', mode: 'insensitive' } }
    });
    console.log('=== CONFIGURACIÓN con BREVO (' + configs.length + ') ===');
    for (const c of configs) {
      console.log({ clave: c.clave, valor: c.valor ? c.valor.substring(0, 50) + '...' : null });
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
