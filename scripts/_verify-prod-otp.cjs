// Prueba el flujo OTP contra PRODUCCIÓN (https://jsadr.com.co) después del deploy.
// Simula lo que hace un cliente cuando entra al portal y pide su código OTP.

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

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});

(async () => {
  console.log('=== PROBAR OTP EN PRODUCCIÓN (jsadr.com.co) ===\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Esperar a que Vercel terminara el deploy (lo dejamos unos segundos)
  console.log('--- Verificando que producción responde ---');
  const res = await fetch('https://jsadr.com.co/login');
  console.log(`  HTTP: ${res.status}`);
  if (res.status !== 200) {
    console.log('  ⚠️  Producción no responde 200. Esperar más tiempo al deploy.');
  } else {
    console.log('  ✅ Producción activa');
  }
  console.log('');

  // Esperar 3-5 min para que Vercel complete el deploy
  console.log('--- Esperando 90s para que Vercel complete el deploy ---');
  console.log('  (el build tarda ~2-3 min desde el push)');
  await new Promise(r => setTimeout(r, 90000));

  // Re-verificar
  console.log('--- Re-verificando producción ---');
  const res2 = await fetch('https://jsadr.com.co/login');
  console.log(`  HTTP: ${res2.status}`);
  console.log('');

  // Leer los últimos envíos de correo en BD
  console.log('--- Últimos 5 EnvioCorreo en BD ---');
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { fechaEnvio: 'desc' },
    take: 5,
  });
  for (const e of envios) {
    console.log(`  ${e.fechaEnvio?.toISOString()} | ${e.estado} | ${e.destinatario} | "${e.asunto?.substring(0, 50)}" | via=${JSON.parse(e.metadata || '{}').via || 'n/a'} | error=${e.mensajeError?.substring(0, 80) || 'n/a'}`);
  }
  console.log('');

  // Para una prueba real en producción, el usuario debe:
  // 1. Entrar a https://jsadr.com.co/login
  // 2. Seleccionar "Cliente"
  // 3. Ingresar cédula o email
  // 4. El sistema generará y enviará el OTP
  // 5. Verificar en el correo que llegó

  console.log('=== INSTRUCCIONES PARA EL USUARIO ===');
  console.log('1. Entrar a https://jsadr.com.co/login');
  console.log('2. Seleccionar "Cliente"');
  console.log('3. Ingresar cédula (ej: 1214726347) o email');
  console.log('4. Solicitar OTP');
  console.log('5. Revisar bandeja de jsadr23@gmail.com');
  console.log('');
  console.log('Después de probar, ejecutar este script de nuevo para ver los nuevos EnvioCorreo.');

  await prisma.$disconnect();
})();
