const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  console.log('=== VERIFICACIÓN DE CREDENCIALES ===\n');

  // Admin login (passwordHash field)
  const admin = await prisma.usuario.findUnique({ where: { username: 'adm-jsadr' } });
  if (admin) {
    const ok = admin.passwordHash && await bcrypt.compare('JsadrAdmin2026*', admin.passwordHash);
    console.log(`ADMIN    adm-jsadr / JsadrAdmin2026*       → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  const gestor = await prisma.usuario.findUnique({ where: { username: 'gestor-jsadr' } });
  if (gestor) {
    const ok = gestor.passwordHash && await bcrypt.compare('JsadrGestor2026*', gestor.passwordHash);
    console.log(`GESTOR   gestor-jsadr / JsadrGestor2026*   → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  const consultor = await prisma.usuario.findUnique({ where: { username: 'consultor-jsadr' } });
  if (consultor) {
    const ok = consultor.passwordHash && await bcrypt.compare('JsadrConsultor2026*', consultor.passwordHash);
    console.log(`CONSULT  consultor-jsadr / JsadrConsultor2026* → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  // Abogado (cedula + claveHash)
  const abogado = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (abogado) {
    const ok = abogado.claveHash && await bcrypt.compare('951029', abogado.claveHash);
    console.log(`ABOGADO  ced=1234567890 / 951029            → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  console.log('\n=== CLIENTES (cedula + PIN) ===');
  const clientes = await prisma.cliente.findMany({ select: { nombre: true, cedula: true, pinHash: true } });
  for (const c of clientes) {
    if (!c.pinHash) {
      console.log(`CLIENTE  ced=${c.cedula} (${c.nombre}) → ✗ SIN PIN (no puede usar portal cliente)`);
    } else {
      console.log(`CLIENTE  ced=${c.cedula} (${c.nombre}) → ✓ PIN configurado`);
    }
  }

  console.log('\n=== TOTALES ===');
  console.log(`Usuarios:  ${await prisma.usuario.count()}`);
  console.log(`Clientes:  ${await prisma.cliente.count()}`);
  console.log(`Prestamos: ${await prisma.prestamo.count()}`);
  console.log(`Pagos:     ${await prisma.pago.count()}`);

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
