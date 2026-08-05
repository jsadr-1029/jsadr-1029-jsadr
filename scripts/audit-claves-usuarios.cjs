#!/usr/bin/env node
// =====================================================
// audit-claves-usuarios.cjs
// =====================================================
// Lista TODOS los usuarios y clientes de la BD Neon,
// verifica sus hashes contra las claves esperadas:
//   - Usuarios del sistema (ADMIN/GESTOR/CONSULTOR/ABOGADO):
//       passwordHash debe validar "Js951029*"
//       + claveHash (portal jurídico) debe validar "Js951029*"
//   - Clientes: pinHash Y claveHash deben validar "1234"
// Reporta cuáles están OK y cuáles están rotos.
// =====================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const prisma = new PrismaClient();

const CLAVE_INTERNA = 'Js951029*';
const CLAVE_CLIENTE = '1234';

async function main() {
  console.log('=====================================================');
  console.log(' AUDITORÍA DE CREDENCIALES — Sistema JSADR');
  console.log('=====================================================');
  console.log(`  Clave esperada usuarios internos: "${CLAVE_INTERNA}"`);
  console.log(`  Clave esperada clientes (PIN+clave): "${CLAVE_CLIENTE}"`);
  console.log('');

  // ===== 1) USUARIOS DEL SISTEMA =====
  console.log('=====================================================');
  console.log(' 1) USUARIOS DEL SISTEMA (tabla Usuario)');
  console.log('=====================================================');
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true, nombre: true, username: true, email: true, rol: true,
      cedula: true, activo: true,
      passwordHash: true, claveHash: true,
      intentosFallidos: true, bloqueadoHasta: true,
      mustChangePassword: true,
      mfaEnabled: true, mfaSecret: true,
    },
    orderBy: { username: 'asc' },
  });
  console.log(`Total: ${usuarios.length} usuarios\n`);
  console.log(
    'username'.padEnd(22) +
    'rol'.padEnd(12) +
    'cedula'.padEnd(14) +
    'activo'.padEnd(8) +
    'passOK'.padEnd(8) +
    'claveOK'.padEnd(9) +
    'bloqueado'.padEnd(11) +
    'intentos'.padEnd(10) +
    'mfa'
  );
  console.log('-'.repeat(110));

  let passOkCount = 0, passFailCount = 0;
  let claveOkCount = 0, claveFailCount = 0;
  let bloqueadosCount = 0;
  let inactivosCount = 0;
  let mfaCount = 0;

  for (const u of usuarios) {
    let passOk = false;
    let claveOk = false;
    try { passOk = await bcrypt.compare(CLAVE_INTERNA, u.passwordHash); } catch {}
    try { claveOk = u.claveHash ? await bcrypt.compare(CLAVE_INTERNA, u.claveHash) : false; } catch {}

    if (passOk) passOkCount++; else passFailCount++;
    if (u.claveHash) { if (claveOk) claveOkCount++; else claveFailCount++; }
    if (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()) bloqueadosCount++;
    if (!u.activo) inactivosCount++;
    if (u.mfaEnabled && u.mfaSecret) mfaCount++;

    const cedula = (u.cedula || '-').padEnd(12);
    const activo = (u.activo ? 'SÍ' : 'no').padEnd(6);
    const passStr = (passOk ? '✓' : '✗').padEnd(6);
    const claveStr = (!u.claveHash ? 'n/a' : (claveOk ? '✓' : '✗')).padEnd(7);
    const bloq = (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date() ? 'SÍ' : 'no').padEnd(9);
    const intentos = String(u.intentosFallidos || 0).padEnd(8);
    const mfa = u.mfaEnabled ? 'SÍ' : 'no';

    console.log(
      (u.username || '-').padEnd(22) +
      (u.rol || '-').padEnd(12) +
      cedula +
      activo +
      passStr +
      claveStr +
      bloq +
      intentos +
      mfa +
      '   ' + u.nombre
    );
  }

  console.log('\nResumen usuarios:');
  console.log(`  passwordHash válido:        ${passOkCount}/${usuarios.length} OK, ${passFailCount} FAIL`);
  console.log(`  claveHash (portal juríd):   ${claveOkCount} OK, ${claveFailCount} FAIL, ${usuarios.length - claveOkCount - claveFailCount} sin clave`);
  console.log(`  Bloqueados ahora:           ${bloqueadosCount}`);
  console.log(`  Inactivos:                  ${inactivosCount}`);
  console.log(`  Con MFA activo:             ${mfaCount}`);

  // ===== 2) CLIENTES =====
  console.log('\n=====================================================');
  console.log(' 2) CLIENTES (tabla Cliente)');
  console.log('=====================================================');
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true, nombre: true, cedula: true, activo: true,
      pinHash: true, claveHash: true,
      pinIntentos: true, claveIntentos: true,
      pinBloqueadoHasta: true, claveBloqueadoHasta: true,
    },
    orderBy: { cedula: 'asc' },
  });
  console.log(`Total: ${clientes.length} clientes\n`);

  let pinOk = 0, pinFail = 0, sinPin = 0;
  let claveOkC = 0, claveFailC = 0, sinClaveC = 0;
  let bloqPin = 0, bloqClave = 0, inactivosCli = 0;
  const clientesRotos = [];

  for (const c of clientes) {
    let pinOk_ = false, claveOk_ = false;
    if (c.pinHash) {
      try { pinOk_ = await bcrypt.compare(CLAVE_CLIENTE, c.pinHash); } catch {}
      if (pinOk_) pinOk++; else { pinFail++; clientesRotos.push({ cedula: c.cedula, nombre: c.nombre, tipo: 'PIN', activo: c.activo }); }
    } else sinPin++;
    if (c.claveHash) {
      try { claveOk_ = await bcrypt.compare(CLAVE_CLIENTE, c.claveHash); } catch {}
      if (claveOk_) claveOkC++; else { claveFailC++; clientesRotos.push({ cedula: c.cedula, nombre: c.nombre, tipo: 'CLAVE', activo: c.activo }); }
    } else sinClaveC++;
    if (c.pinBloqueadoHasta && new Date(c.pinBloqueadoHasta) > new Date()) bloqPin++;
    if (c.claveBloqueadoHasta && new Date(c.claveBloqueadoHasta) > new Date()) bloqClave++;
    if (!c.activo) inactivosCli++;
  }

  console.log(`  PIN 1234:        ${pinOk} OK / ${pinFail} FAIL / ${sinPin} sin PIN`);
  console.log(`  Clave 1234:      ${claveOkC} OK / ${claveFailC} FAIL / ${sinClaveC} sin clave`);
  console.log(`  Bloqueados PIN:  ${bloqPin}`);
  console.log(`  Bloqueados Clv:  ${bloqClave}`);
  console.log(`  Inactivos:       ${inactivosCli}`);

  if (clientesRotos.length > 0) {
    console.log('\n--- Clientes con credenciales ROTAS (primeros 30) ---');
    for (const r of clientesRotos.slice(0, 30)) {
      console.log(`  ✗ ${r.cedula.padEnd(14)} | ${r.tipo.padEnd(6)} | activo=${r.activo ? 'SÍ' : 'no'} | ${r.nombre}`);
    }
    if (clientesRotos.length > 30) console.log(`  ... y ${clientesRotos.length - 30} más`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
