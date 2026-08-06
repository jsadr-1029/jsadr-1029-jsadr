// Recuperar VERCEL_TOKEN y WHATSAPP_TOKEN de la BD y verificar variables en Vercel
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');

// Cargar .env primero
try {
  const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
} catch (e) {}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definida');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function decryptSensitive(encText) {
  const key = getEncryptionKey();
  const parts = encText.split(':');
  if (parts.length !== 2) return encText;
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(parts[1], 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

(async () => {
  try {
    // 1. Leer PlataformaSync.VERCEL
    const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } });
    if (vercel && vercel.tokenCifrado) {
      try {
        const token = decryptSensitive(vercel.tokenCifrado);
        console.log('VERCEL_TOKEN encontrado en BD (descifrado):');
        console.log('  Longitud:', token.length);
        console.log('  Inicio:', token.substring(0, 15));
        console.log('  Fin:', token.slice(-10));
        console.log('  ¿Empieza con vcp_?', token.startsWith('vcp_'));
        
        // Guardar en .env
        const envPath = '/home/z/my-project/.env';
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (/^VERCEL_TOKEN=.*$/m.test(envContent)) {
          envContent = envContent.replace(/^VERCEL_TOKEN=.*$/m, `VERCEL_TOKEN=${token}`);
        } else {
          envContent += `\nVERCEL_TOKEN=${token}\n`;
        }
        fs.writeFileSync(envPath, envContent);
        console.log('✅ VERCEL_TOKEN agregado a .env');
        
        // 2. Probar el token contra Vercel API
        console.log('\n--- Probando token contra Vercel API ---');
        const r = await fetch('https://api.vercel.com/v2/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (r.ok) {
          const data = await r.json();
          console.log('✅ Vercel API OK — user:', data.user?.email || data.user?.username);
        } else {
          console.log('❌ Vercel API falla — HTTP', r.status, ':', (await r.text()).substring(0, 200));
        }
      } catch (e) {
        console.log('❌ Falló desencriptar VERCEL_TOKEN:', e.message);
      }
    } else {
      console.log('❌ No hay PlataformaSync.VERCEL con tokenCifrado');
    }

    // 3. Listar todas las PlataformaSync para debug
    console.log('\n--- Todas las PlataformaSync ---');
    const all = await prisma.plataformaSync.findMany();
    for (const p of all) {
      console.log(`  ${p.plataforma}: sincronizado=${p.sincronizado}, ultimoEstado=${p.ultimoEstado}, tokenCifrado=${p.tokenCifrado ? 'sí (' + p.tokenCifrado.length + ' chars)' : 'no'}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
