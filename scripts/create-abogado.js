// Create ABOGADO user for portal /juridico
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  const existente = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (existente) {
    console.log(`Usuario con cédula 1234567890 ya existe: ${existente.username} (rol=${existente.rol})`);
    const hash = await bcrypt.hash('951029', 10);
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { claveHash: hash, rol: 'ABOGADO', activo: true, bloqueadoHasta: null },
    });
    console.log(`✓ Actualizado: ced=1234567890, rol=ABOGADO, clave=951029`);
  } else {
    console.log('Creando nuevo usuario ABOGADO...');
    const passwordHash = await bcrypt.hash('JsadrAbogado2026*', 12);
    const claveHash = await bcrypt.hash('951029', 10);
    const nuevo = await prisma.usuario.create({
      data: {
        username: 'abogado-jsadr',
        nombre: 'Abogado Jsadr',
        email: 'abogado@jsadr.local',
        passwordHash,
        rol: 'ABOGADO',
        cedula: '1234567890',
        claveHash,
        activo: true,
      },
    });
    console.log(`✓ Usuario creado: ${nuevo.id} | ${nuevo.username} | ced=${nuevo.cedula} | rol=${nuevo.rol} | clave=951029`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });
