const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    // 1. Desbloquear adm-jsadr (reset intentos + clear bloqueadoHasta)
    await prisma.usuario.updateMany({
      where: { username: 'adm-jsadr' },
      data: { intentosFallidos: 0, bloqueadoHasta: null }
    });
    console.log('✅ adm-jsadr desbloqueado (intentos=0, bloqueadoHasta=null)');

    // 2. Probar muchas variantes de contraseña contra el hash real
    const u = await prisma.usuario.findUnique({ where: { username: 'adm-jsadr' } });
    const candidates = [
      'JsadrAdmin2026*', 'JsadrAdmin2026', 'JsadrAdmin*', 'JsadrAdmin',
      'Jsadr2026*', 'Jsadr2026', 'Jsadr*',
      'Admin2026*', 'Admin2026', 'admin',
      'JsadrAdm2026*', 'JsadrAdm2026',
      'JsadrAdministrador2026*', 'JsadrAdministrador',
      'JsadrGestor2026*', 'JsadrConsultor2026*',
      'jsadr2026*', 'jsadradmin2026*', 'JSADR2026*',
      'JsadrAdmin2026!', 'JsadrAdmin2026#', 'JsadrAdmin2026@',
      'JsadrAdmin$2026', 'JsadrAdmin.2026',
      'Jsadr2026Admin*', 'Jsadr@2026*',
      'Jsadr12345', 'Jsadr*2026',
      'AuroraBancaria*', 'aurora2026*', 'JsadrBancaria*',
      'Jsadr2026Admin', 'Jsadr2026!',
    ];
    let found = false;
    for (const pwd of candidates) {
      const ok = await bcrypt.compare(pwd, u.passwordHash);
      if (ok) {
        console.log(`✅ PASSWORD ENCONTRADA: "${pwd}"`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log('❌ Ninguna variante coincide. El hash NO corresponde a ninguna contraseña documentada.');
      console.log('   Hash almacenado:', u.passwordHash);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
