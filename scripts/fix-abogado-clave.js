const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  // Resetear clave del abogado a 951029 (la que mencionó el usuario)
  const hash = await bcrypt.hash('951029', 10);
  const abog = await prisma.usuario.update({
    where: { username: 'abogado-jsadr' },
    data: {
      claveHash: hash,
      activo: true,
      bloqueadoHasta: null,
      intentosFallidos: 0,
    },
  });
  console.log(`✓ abogado-jsadr (ced=${abog.cedula}) → clave 951029`);

  // Verificar
  const ok = await bcrypt.compare('951029', abog.claveHash);
  console.log(`  Verificación: ${ok ? '✓ OK' : '✗ FALLA'}`);

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
