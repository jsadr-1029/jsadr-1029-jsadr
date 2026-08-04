// Reset admin/gestor/consultor passwordHash (admin login field, NOT claveHash which is for portal juridico)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

const CLAVES = {
  'adm-jsadr':       'JsadrAdmin2026*',
  'gestor-jsadr':    'JsadrGestor2026*',
  'consultor-jsadr': 'JsadrConsultor2026*',
};

(async () => {
  for (const [username, clave] of Object.entries(CLAVES)) {
    const hash = await bcrypt.hash(clave, 12);
    const updated = await prisma.usuario.update({
      where: { username },
      data: {
        passwordHash: hash,
        activo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
        mustChangePassword: false,
      },
    });
    console.log(`✓ ${username} -> passwordHash actualizado (clave: ${clave})`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
