// Abogado: passwordHash = Js951029* (consistente con otros usuarios)
//          claveHash    = 951029    (PIN original del portal /juridico)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  const abogado = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (!abogado) {
    console.log('No existe abogado con cédula 1234567890');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash('Js951029*', 12);
  const claveHash = await bcrypt.hash('951029', 10);
  await prisma.usuario.update({
    where: { id: abogado.id },
    data: {
      passwordHash,
      claveHash,
      activo: true,
      bloqueadoHasta: null,
      intentosFallidos: 0,
    },
  });
  console.log(`✓ Abogado actualizado:`);
  console.log(`  username:     ${abogado.username}`);
  console.log(`  cedula:       1234567890`);
  console.log(`  passwordHash: Js951029* (login admin-style)`);
  console.log(`  claveHash:    951029    (portal /juridico)`);
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
