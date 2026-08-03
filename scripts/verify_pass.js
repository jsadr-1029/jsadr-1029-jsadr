const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.usuario.findMany({ select: { username: true, passwordHash: true, rol: true } });
    console.log('--- Direct tests ---');
    const candidates = [
      ['adm-jsadr', 'JsadrAdmin2026*'],
      ['gestor-jsadr', 'JsadrGestor2026*'],
      ['consultor-jsadr', 'JsadrConsultor2026*'],
      ['abogado-jsadr', '1234567890'],
      ['abogado-jsadr', '951029'],
    ];
    for (const [username, pwd] of candidates) {
      const u = users.find(x => x.username === username);
      if (!u) { console.log(`❓ ${username} → no existe`); continue; }
      const ok = await bcrypt.compare(pwd, u.passwordHash);
      console.log(`${ok ? '✅' : '❌'} ${username} | pwd=${pwd} | hash=${u.passwordHash.substring(0,30)}...`);
    }
    console.log('\n--- Brute variants for adm-jsadr ---');
    const adm = users.find(x => x.username === 'adm-jsadr');
    if (adm) {
      for (const pwd of ['JsadrAdmin2026*', 'JsadrAdm2026*', 'Jsadr2026*', 'JsadrAdmin', 'admin', 'JsadrAdmin2026', 'JsadrAdministrador2026*', 'JsadrAdmin*', 'Admin2026*', 'Jsadr*']) {
        const ok = await bcrypt.compare(pwd, adm.passwordHash);
        if (ok) console.log(`✅ MATCH: ${pwd}`);
      }
      console.log('done');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
