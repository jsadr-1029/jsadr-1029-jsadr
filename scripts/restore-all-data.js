// Restore ALL data from prev DB - properly ordered to satisfy FK constraints
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const bcrypt = require('bcryptjs');

const SRC_URL = 'file:' + path.resolve('/tmp/my-project/db/custom.db');
const DST_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');

const srcPrisma = new PrismaClient({ datasources: { db: { url: SRC_URL } } });
const prisma = new PrismaClient({ datasources: { db: { url: DST_URL } } });

const CLAVES = {
  'adm-jsadr':       'JsadrAdmin2026*',
  'gestor-jsadr':    'JsadrGestor2026*',
  'consultor-jsadr': 'JsadrConsultor2026*',
};

(async () => {
  console.log('=== Restoring from /tmp/my-project/db/custom.db ===\n');

  // 1) USUARIOS + reset passwords
  const usuarios = await srcPrisma.usuario.findMany();
  console.log(`Usuarios: ${usuarios.length}`);
  for (const u of usuarios) {
    const nuevaClave = CLAVES[u.username];
    const claveHash = nuevaClave ? await bcrypt.hash(nuevaClave, 10) : u.claveHash;
    await prisma.usuario.upsert({
      where: { id: u.id },
      create: { ...u, claveHash },
      update: { ...u, claveHash },
    });
    console.log(`  ${u.username} -> ${nuevaClave || '(sin cambio)'}`);
  }

  // 2) CUENTAS first (no FK)
  const cuentas = await srcPrisma.cuentaRecaudo.findMany();
  console.log(`Cuentas: ${cuentas.length}`);
  for (const c of cuentas) {
    await prisma.cuentaRecaudo.upsert({ where: { id: c.id }, create: c, update: c });
  }

  // 3) CATEGORIAS (FK to cuentaRecaudo)
  const categorias = await srcPrisma.categoriaCliente.findMany();
  console.log(`Categorias: ${categorias.length}`);
  for (const c of categorias) {
    await prisma.categoriaCliente.upsert({ where: { id: c.id }, create: c, update: c });
  }

  // 4) CLIENTES - 2-pass: first without referidoPorId, then add FKs
  const clientes = await srcPrisma.cliente.findMany();
  console.log(`Clientes: ${clientes.length}`);
  for (const c of clientes) {
    const { referidoPorId, ...rest } = c;
    await prisma.cliente.upsert({
      where: { id: c.id },
      create: { ...rest, referidoPorId: null },
      update: { ...rest, referidoPorId: null },
    });
    console.log(`  ${c.nombre} | ced=${c.cedula} | pinHash=${c.pinHash ? 'preservado' : 'NULL'}`);
  }
  for (const c of clientes) {
    if (c.referidoPorId) {
      await prisma.cliente.update({ where: { id: c.id }, data: { referidoPorId: c.referidoPorId } });
    }
  }

  // 5) PRESTAMOS (FK to cliente, categoriaCliente, cuentaRecaudo, usuario)
  const prestamos = await srcPrisma.prestamo.findMany();
  console.log(`Prestamos: ${prestamos.length}`);
  for (const p of prestamos) {
    await prisma.prestamo.upsert({ where: { id: p.id }, create: p, update: p });
  }

  // 6) PAGOS (FK to prestamo, cuentaRecaudo)
  const pagos = await srcPrisma.pago.findMany();
  console.log(`Pagos: ${pagos.length}`);
  for (const p of pagos) {
    await prisma.pago.upsert({ where: { id: p.id }, create: p, update: p });
  }

  console.log('\n=== Restauración completa ===');
  await srcPrisma.$disconnect();
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });
