const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  // Abogado: cedula 1234567890 — debería tener clave 951029 según el usuario
  // Pero también puede usar la unificada Js951029* si la cuenta es interno
  const abogado = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (!abogado) {
    console.log('No existe usuario con cédula 1234567890');
  } else {
    console.log(`Abogado: ${abogado.username} | rol=${abogado.rol}`);
    const ok951029 = abogado.claveHash && await bcrypt.compare('951029', abogado.claveHash);
    const okJs951029 = abogado.claveHash && await bcrypt.compare('Js951029*', abogado.claveHash);
    const passJs951029 = abogado.passwordHash && await bcrypt.compare('Js951029*', abogado.passwordHash);
    console.log(`  claveHash == '951029'    → ${ok951029 ? '✓' : '✗'}`);
    console.log(`  claveHash == 'Js951029*' → ${okJs951029 ? '✓' : '✗'}`);
    console.log(`  passwordHash == 'Js951029*' → ${passJs951029 ? '✓' : '✗'}`);
    
    // Set both to Js951029* to be consistent with the user's request
    const hash = await bcrypt.hash('Js951029*', 10);
    const passHash = await bcrypt.hash('Js951029*', 12);
    await prisma.usuario.update({
      where: { id: abogado.id },
      data: {
        claveHash: hash,
        passwordHash: passHash,
        activo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
      },
    });
    console.log(`  → Actualizado: claveHash=Js951029*, passwordHash=Js951029*`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
