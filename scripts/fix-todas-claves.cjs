#!/usr/bin/env node
// =====================================================
// fix-todas-claves.cjs
// =====================================================
// Reescribe TODAS las credenciales del sistema a los valores
// esperados por el usuario:
//
//   - Usuarios del sistema (ADMIN/GESTOR/CONSULTOR/ABOGADO):
//       passwordHash = bcrypt("Js951029*", rounds=12)
//       claveHash    = bcrypt("Js951029*", rounds=12) — solo si tiene cedula
//       (portal jurídico)
//       intentosFallidos = 0
//       bloqueadoHasta   = null
//       activo            = true
//       mustChangePassword = false
//
//   - Clientes (tabla Cliente):
//       pinHash   = bcrypt("1234", rounds=12)
//       claveHash = bcrypt("1234", rounds=12)
//       pinIntentos   = 0
//       claveIntentos = 0
//       pinBloqueadoHasta   = null
//       claveBloqueadoHasta = null
//       claveResetToken     = null
//       claveResetExpira    = null
//
//   También desbloquea cualquier cuenta que esté bloqueada
//   actualmente y reactiva clientes inactivos (para que el
//   usuario pueda probar login con cualquiera).
// =====================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const prisma = new PrismaClient();

const CLAVE_INTERNA = 'Js951029*';
const CLAVE_CLIENTE = '1234';

async function fixUsuarios() {
  console.log('=====================================================');
  console.log(' 1) USUARIOS DEL SISTEMA → passwordHash + claveHash');
  console.log('=====================================================');

  const hashInterno = await bcrypt.hash(CLAVE_INTERNA, 12);
  const ahora = new Date();

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, username: true, email: true, rol: true, cedula: true, activo: true },
    orderBy: { username: 'asc' },
  });
  console.log(`Total: ${usuarios.length} usuarios\n`);

  for (const u of usuarios) {
    const data = {
      passwordHash: hashInterno,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      activo: true,
      mustChangePassword: false,
    };
    // Solo setear claveHash (portal jurídico) si el usuario tiene cedula
    // (el portal jurídico requiere cedula + clave para login)
    if (u.cedula) {
      data.claveHash = hashInterno;
    }
    await prisma.usuario.update({ where: { id: u.id }, data });
    const claveStr = u.cedula ? `claveHash="${CLAVE_INTERNA}"` : 'sin claveHash (sin cedula)';
    console.log(`  ✓ [${u.rol}] @${u.username.padEnd(20)} | ${u.nombre} | pass="${CLAVE_INTERNA}" | ${claveStr}`);
  }
}

async function fixClientes() {
  console.log('\n=====================================================');
  console.log(' 2) CLIENTES → pinHash + claveHash = "1234"');
  console.log('=====================================================');

  const pinHash = await bcrypt.hash(CLAVE_CLIENTE, 12);
  const claveHash = await bcrypt.hash(CLAVE_CLIENTE, 12);
  const ahora = new Date();

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nombre: true, cedula: true, activo: true },
    orderBy: { cedula: 'asc' },
  });
  console.log(`Total: ${clientes.length} clientes\n`);

  for (const c of clientes) {
    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        pinHash,
        pinCreatedAt: agora(),
        pinIntentos: 0,
        pinBloqueadoHasta: null,
        claveHash,
        claveCreatedAt: agora(),
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        claveResetToken: null,
        claveResetExpira: null,
        // Reactivar para que el usuario pueda probar login
        activo: true,
        // Limpiar sesión previa para forzar re-login limpio
        tokenSesion: null,
        tokenExpira: null,
      },
    });
    console.log(`  ✓ ${c.cedula.padEnd(14)} | ${c.nombre}`);
  }
}

function agora() { return new Date(); }

async function fixAccesosPortalLogs() {
  // Limpiar logs de intentos fallidos recientes para que el rate-limiting no bloquee
  console.log('\n=====================================================');
  console.log(' 3) LIMPIAR LOGS DE ACCESO PORTAL (opcional)');
  console.log('=====================================================');
  try {
    const r = await prisma.accesoPortal.deleteMany({
      where: { exito: false, accion: { in: ['LOGIN_PIN', 'LOGIN_CLAVE', 'VERIFICAR_CEDULA'] } },
    });
    console.log(`  ✓ Logs de intentos fallidos eliminados: ${r.count}`);
  } catch (e) {
    console.log(`  ⚠ ${e.message}`);
  }
}

async function verificar() {
  console.log('\n=====================================================');
  console.log(' 4) VERIFICACIÓN POST-FIX');
  console.log('=====================================================');

  // Verificar usuarios
  const usuarios = await prisma.usuario.findMany({
    select: { username: true, rol: true, cedula: true, activo: true, passwordHash: true, claveHash: true, bloqueadoHasta: true, intentosFallidos: true },
    orderBy: { username: 'asc' },
  });
  console.log('\nUsuarios del sistema:');
  let passOkU = 0, claveOkU = 0;
  for (const u of usuarios) {
    const passOk = await bcrypt.compare(CLAVE_INTERNA, u.passwordHash);
    const claveOk = u.claveHash ? await bcrypt.compare(CLAVE_INTERNA, u.claveHash) : null;
    if (passOk) passOkU++;
    if (claveOk) claveOkU++;
    const claveStr = u.claveHash ? (claveOk ? '✓' : '✗') : 'n/a';
    console.log(`  ${passOk ? '✅' : '❌'} [${u.rol}] @${u.username.padEnd(20)} pass=${passOk?'OK':'FAIL'} claveHash=${claveStr} activo=${u.activo?'SÍ':'no'} bloqueado=${u.bloqueadoHasta?'SÍ':'no'}`);
  }
  console.log(`  → ${passOkU}/${usuarios.length} con passwordHash OK, ${claveOkU} con claveHash OK`);

  // Verificar clientes
  const clientes = await prisma.cliente.findMany({
    select: { cedula: true, nombre: true, activo: true, pinHash: true, claveHash: true, pinBloqueadoHasta: true, claveBloqueadoHasta: true },
    orderBy: { cedula: 'asc' },
  });
  console.log('\nClientes:');
  let pinOkC = 0, claveOkC = 0;
  for (const c of clientes) {
    const pinOk = await bcrypt.compare(CLAVE_CLIENTE, c.pinHash || '');
    const claveOk = await bcrypt.compare(CLAVE_CLIENTE, c.claveHash || '');
    if (pinOk) pinOkC++;
    if (claveOk) claveOkC++;
    const bothOk = pinOk && claveOk;
    console.log(`  ${bothOk ? '✅' : '❌'} ${c.cedula.padEnd(14)} | ${c.nombre} | PIN=${pinOk?'OK':'FAIL'} | Clave=${claveOk?'OK':'FAIL'} | activo=${c.activo?'SÍ':'no'}`);
  }
  console.log(`  → PIN: ${pinOkC}/${clientes.length} OK | Clave: ${claveOkC}/${clientes.length} OK`);
}

async function main() {
  console.log('=====================================================');
  console.log(' FIX MASIVO DE CREDENCIALES — Sistema JSADR');
  console.log('=====================================================');
  console.log(`  Usuarios internos → "${CLAVE_INTERNA}"`);
  console.log(`  Clientes (PIN+clave) → "${CLAVE_CLIENTE}"`);
  console.log('');

  await fixUsuarios();
  await fixClientes();
  await fixAccesosPortalLogs();
  await verificar();

  console.log('\n=====================================================');
  console.log(' ✅ FIX COMPLETADO');
  console.log('=====================================================');
  console.log('  Credenciales activas:');
  console.log('    • Sistema (admin/gestor/consultor/abogado): Js951029*');
  console.log('    • Portal cliente (cédula + PIN/clave): 1234');
  console.log('    • Portal jurídico (cédula + clave): Js951029*');
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
