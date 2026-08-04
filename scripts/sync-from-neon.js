// Sincronizar DB local con Neon (producción)
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const bcrypt = require('bcryptjs');

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  await neonClient.connect();
  console.log('=== Sincronizando Neon → SQLite local ===\n');

  // 1) CUENTAS DE RECAUDO
  console.log('1) CUENTAS DE RECAUDO');
  const { rows: cuentas } = await neonClient.query(`SELECT * FROM "CuentaRecaudo" ORDER BY codigo ASC`);
  for (const c of cuentas) {
    await prisma.cuentaRecaudo.upsert({
      where: { id: c.id },
      create: {
        id: c.id, codigo: c.codigo, nombre: c.nombre, banco: c.banco,
        tipoCuenta: c.tipoCuenta, numeroCuenta: c.numeroCuenta, titular: c.titular,
        activa: c.activa, createdAt: c.createdAt, updatedAt: c.updatedAt,
      },
      update: {
        banco: c.banco, tipoCuenta: c.tipoCuenta, numeroCuenta: c.numeroCuenta,
        titular: c.titular, activa: c.activa, updatedAt: c.updatedAt,
      },
    });
    console.log(`  ✓ ${c.codigo} | ${c.banco} | ${c.tipoCuenta} | ${c.numeroCuenta} | ${c.titular}`);
  }

  // 2) USUARIOS — limpiar primero cualquier duplicado de cedula, luego upsert
  console.log('\n2) USUARIOS');
  const { rows: users } = await neonClient.query(`SELECT * FROM "Usuario" ORDER BY rol, username`);
  const CLAVES_INTERNAS = { 'adm-jsadr': 'Js951029*', 'gestor-jsadr': 'Js951029*', 'consultor-jsadr': 'Js951029*' };
  for (const u of users) {
    // Si ya existe un usuario con la misma cédula pero distinto ID, eliminarlo
    if (u.cedula) {
      const dup = await prisma.usuario.findFirst({ where: { cedula: u.cedula, NOT: { id: u.id } } });
      if (dup) {
        await prisma.usuario.delete({ where: { id: dup.id } });
        console.log(`  (eliminado duplicado cédula ${u.cedula}: ${dup.username})`);
      }
    }
    // Si ya existe un usuario con el mismo username pero distinto ID, eliminarlo
    const dupUser = await prisma.usuario.findFirst({ where: { username: u.username, NOT: { id: u.id } } });
    if (dupUser) {
      await prisma.usuario.delete({ where: { id: dupUser.id } });
      console.log(`  (eliminado duplicado username ${u.username}: ${dupUser.id})`);
    }
    const nuevaClave = CLAVES_INTERNAS[u.username];
    const passwordHash = nuevaClave ? await bcrypt.hash(nuevaClave, 12) : u.passwordHash;
    await prisma.usuario.upsert({
      where: { id: u.id },
      create: {
        id: u.id, nombre: u.nombre, email: u.email, username: u.username,
        passwordHash, rol: u.rol, activo: u.activo !== false,
        cedula: u.cedula, claveHash: u.claveHash,
        mustChangePassword: u.mustChangePassword || false,
        intentosFallidos: 0, bloqueadoHasta: null,
        createdAt: u.createdAt, updatedAt: u.updatedAt,
      },
      update: {
        nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo !== false,
        cedula: u.cedula, claveHash: u.claveHash,
        passwordHash: nuevaClave ? passwordHash : undefined,
        mustChangePassword: false, intentosFallidos: 0, bloqueadoHasta: null,
      },
    });
    console.log(`  ✓ ${u.username} | rol=${u.rol} | ced=${u.cedula || '-'} ${nuevaClave ? '(clave: ' + nuevaClave + ')' : ''}`);
  }

  // 3) CLIENTES
  console.log('\n3) CLIENTES');
  const { rows: clientes } = await neonClient.query(`SELECT * FROM "Cliente" ORDER BY nombre`);
  for (const c of clientes) {
    const { referidoPorId, ...rest } = c;
    await prisma.cliente.upsert({
      where: { id: c.id },
      create: { ...rest, referidoPorId: null },
      update: { ...rest, referidoPorId: null },
    });
    console.log(`  ✓ ${c.nombre} | ced=${c.cedula} | pinHash=${c.pinHash ? 'preservado' : 'NULL'} | banco=${c.bancoCliente} | num=${c.numeroCuentaCliente}`);
  }
  for (const c of clientes) {
    if (c.referidoPorId) {
      await prisma.cliente.update({ where: { id: c.id }, data: { referidoPorId: c.referidoPorId } });
    }
  }

  console.log('\n=== SINCRONIZACIÓN COMPLETA ===\n');
  console.log('=== ESTADO FINAL LOCAL ===');
  const ctas = await prisma.cuentaRecaudo.findMany({ orderBy: { codigo: 'asc' } });
  ctas.forEach(c => console.log(`  ${c.codigo} | ${c.banco} | ${c.tipoCuenta} | ${c.numeroCuenta} | ${c.titular}`));

  console.log('\n=== VERIFICACIÓN DE CLAVES ===');
  for (const u of ['adm-jsadr', 'gestor-jsadr', 'consultor-jsadr']) {
    const usr = await prisma.usuario.findUnique({ where: { username: u } });
    const ok = usr && usr.passwordHash && await bcrypt.compare('Js951029*', usr.passwordHash);
    console.log(`  ${u} / Js951029* → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }
  const abog = await prisma.usuario.findFirst({ where: { cedula: '1234567890' } });
  if (abog) {
    const ok = abog.claveHash && await bcrypt.compare('951029', abog.claveHash);
    console.log(`  abogado (ced=1234567890) / 951029 → ${ok ? '✓ OK' : '✗ FALLA'}`);
  }

  await neonClient.end();
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
