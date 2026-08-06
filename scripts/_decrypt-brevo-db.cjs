// Probar desencriptar password de ConexionAPI con la API_ENCRYPTION_KEY encontrada
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

const KEY_HEX = 'a7a37168b1965163c1a30a09155c80a21fc7b901adfd592dd018405b8c57fa09';

function decrypt(encText, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const parts = encText.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  return dec.toString('utf8');
}

(async () => {
  const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
  if (!c) { console.log('No conexionAPI'); return; }
  
  console.log('=== Probando desencriptar con KEY encontrada ===');
  console.log('KEY (hex):', KEY_HEX);
  console.log();
  
  try {
    const decPassword = decrypt(c.password, KEY_HEX);
    console.log('✅ Password desencriptada OK!');
    console.log('   Longitud:', decPassword.length);
    console.log('   Inicio:', decPassword.substring(0, 30));
    console.log('   Fin:', decPassword.slice(-15));
    console.log('   ¿Es xsmtpsib-...?', decPassword.startsWith('xsmtpsib-'));
    console.log('   ¿Es xkeysib-...?', decPassword.startsWith('xkeysib-'));
    console.log('   ¿Termina en bZdscE?', decPassword.endsWith('bZdscE'));
  } catch (e) {
    console.log('❌ Falló desencriptar password:', e.message);
  }
  
  try {
    const decApiKey = decrypt(c.apiKey, KEY_HEX);
    console.log('\n✅ apiKey desencriptada OK!');
    console.log('   Longitud:', decApiKey.length);
    console.log('   Inicio:', decApiKey.substring(0, 30));
    console.log('   Fin:', decApiKey.slice(-15));
    console.log('   ¿Es xkeysib-...?', decApiKey.startsWith('xkeysib-'));
    console.log('   ¿Es xsmtpsib-...?', decApiKey.startsWith('xsmtpsib-'));
    console.log('   ¿Termina en bZdscE?', decApiKey.endsWith('bZdscE'));
  } catch (e) {
    console.log('❌ Falló desencriptar apiKey:', e.message);
  }

  await prisma.$disconnect();
})();
