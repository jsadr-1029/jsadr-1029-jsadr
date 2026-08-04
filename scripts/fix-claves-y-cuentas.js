// 1) Reset admin/gestor/consultor passwords to Js951029*
// 2) Update CTA-4 to Bancolombia / AHORROS / 42-000000-678
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  console.log('=== 1) RESETEAR CLAVES ADMIN A Js951029* ===');
  const USUARIOS = ['adm-jsadr', 'gestor-jsadr', 'consultor-jsadr'];
  const hash = await bcrypt.hash('Js951029*', 12);
  for (const username of USUARIOS) {
    const u = await prisma.usuario.update({
      where: { username },
      data: {
        passwordHash: hash,
        activo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
        mustChangePassword: false,
      },
    });
    console.log(`  ✓ ${username} -> Js951029*`);
  }

  console.log('\n=== 2) ACTUALIZAR CTA-4 ===');
  const cta4 = await prisma.cuentaRecaudo.update({
    where: { codigo: 'CTA-4' },
    data: {
      banco: 'Bancolombia',
      tipoCuenta: 'AHORROS',
      numeroCuenta: '42-000000-678',
      titular: 'Empresa Préstamos S.A.S',
    },
  });
  console.log(`  ✓ CTA-4 -> ${cta4.banco} | ${cta4.tipoCuenta} | ${cta4.numeroCuenta} | ${cta4.titular}`);

  console.log('\n=== 3) ESTADO FINAL DE CUENTAS ===');
  const cuentas = await prisma.cuentaRecaudo.findMany({ orderBy: { codigo: 'asc' } });
  cuentas.forEach(c => console.log(`  ${c.codigo} | ${c.banco} | ${c.tipoCuenta} | ${c.numeroCuenta} | ${c.titular}`));

  console.log('\n=== 4) VERIFICAR CLAVES ===');
  for (const username of USUARIOS) {
    const u = await prisma.usuario.findUnique({ where: { username } });
    const ok = await bcrypt.compare('Js951029*', u.passwordHash);
    console.log(`  ${username} / Js951029* -> ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  // Abogado (lo dejamos con su PIN 951029)
  const abog = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (abog) {
    const ok = await bcrypt.compare('951029', abog.claveHash);
    console.log(`  abogado (ced=1234567890) / 951029 -> ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
