#!/usr/bin/env node
// =====================================================
// reset-todas-credenciales.js
// =====================================================
// Resetea TODAS las credenciales del sistema a valores de prueba:
//
//   - Usuarios internos (adm-jsadr, gestor-jsadr, consultor-jsadr):
//       passwordHash = bcrypt("Js951029*", rounds=12)
//
//   - TODOS los clientes (tabla Cliente):
//       pinHash   = bcrypt("1234", rounds=12)
//       claveHash = bcrypt("1234", rounds=12)
//       pinIntentos   = 0
//       claveIntentos = 0
//       pinBloqueadoHasta   = null
//       claveBloqueadoHasta = null
//       claveResetToken     = null
//       claveResetExpira    = null
//
//   Esto es solo para entorno de PRUEBAS. NO usar en producción.
// =====================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CLAVE_INTERNA = 'Js951029*';
const CLAVE_CLIENTE = '1234'; // mismo valor para PIN y clave

async function resetInternos() {
  console.log('========================================');
  console.log('1) USUARIOS INTERNOS → passwordHash = Js951029*');
  console.log('========================================');

  const hash = await bcrypt.hash(CLAVE_INTERNA, 12);

  const usuarios = [
    { username: 'adm-jsadr',       rol: 'ADMIN' },
    { username: 'gestor-jsadr',    rol: 'GESTOR' },
    { username: 'consultor-jsadr', rol: 'CONSULTOR' },
  ];

  for (const u of usuarios) {
    const existente = await prisma.usuario.findUnique({
      where: { username: u.username },
      select: { id: true, nombre: true, username: true, rol: true, activo: true },
    });
    if (!existente) {
      console.log(`  ⚠️  @${u.username} NO existe en la BD — se omite`);
      continue;
    }
    const actualizado = await prisma.usuario.update({
      where: { username: u.username },
      data: {
        passwordHash: hash,
        mustChangePassword: false,
        activo: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
      select: { id: true, nombre: true, username: true, rol: true, activo: true },
    });
    console.log(`  ✓ [${actualizado.rol}] @${actualizado.username} → ${actualizado.nombre} (activo=${actualizado.activo})`);
  }
}

async function resetClientes() {
  console.log('\n========================================');
  console.log('2) CLIENTES → pinHash=1234 Y claveHash=1234');
  console.log('========================================');

  const pinHash   = await bcrypt.hash(CLAVE_CLIENTE, 12);
  const claveHash = await bcrypt.hash(CLAVE_CLIENTE, 12);
  const ahora     = new Date();

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nombre: true, cedula: true, activo: true, pinHash: true, claveHash: true },
    orderBy: { cedula: 'asc' },
  });
  console.log(`Total de clientes en BD: ${clientes.length}\n`);

  let conPinPrevio = 0;
  let conClavePrevia = 0;
  let sinPinPrevio   = 0;
  let sinClavePrevia = 0;

  for (const c of clientes) {
    if (c.pinHash)   conPinPrevio++;   else sinPinPrevio++;
    if (c.claveHash) conClavePrevia++; else sinClavePrevia++;

    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        // PIN
        pinHash:             pinHash,
        pinCreatedAt:        ahora,
        pinIntentos:         0,
        pinBloqueadoHasta:   null,
        // Clave alfanumérica
        claveHash:           claveHash,
        claveCreatedAt:      ahora,
        claveIntentos:       0,
        claveBloqueadoHasta: null,
        claveResetToken:     null,
        claveResetExpira:    null,
      },
    });
    console.log(`  ✓ ${c.cedula.padEnd(12)} | ${c.nombre?.substring(0, 40).padEnd(40)} | activo=${c.activo}`);
  }

  console.log('');
  console.log(`  Resumen clientes:`);
  console.log(`    - PIN previamente presentes:  ${conPinPrevio}`);
  console.log(`    - PIN previamente ausentes:   ${sinPinPrevio}`);
  console.log(`    - Clave previamente presente: ${conClavePrevia}`);
  console.log(`    - Clave previamente ausente:  ${sinClavePrevia}`);
  console.log(`    - Total actualizados:         ${clientes.length}`);
}

async function verificar() {
  console.log('\n========================================');
  console.log('3) VERIFICACIÓN POST-RESET');
  console.log('========================================');

  // Verificar usuarios internos
  const usuarios = await prisma.usuario.findMany({
    where: { username: { in: ['adm-jsadr', 'gestor-jsadr', 'consultor-jsadr'] } },
    select: { username: true, rol: true, passwordHash: true, activo: true, intentosFallidos: true, bloqueadoHasta: true },
  });
  console.log('\nUsuarios internos:');
  for (const u of usuarios) {
    const ok = await bcrypt.compare(CLAVE_INTERNA, u.passwordHash);
    console.log(`  ${ok ? '✅' : '❌'} [${u.rol}] @${u.username} — activo=${u.activo}, intentos=${u.intentosFallidos}, bloqueado=${u.bloqueadoHasta ? 'SÍ' : 'no'}, pass="${CLAVE_INTERNA}"`);
  }

  // Verificar todos los clientes (resumen + algunos específicos)
  const clientes = await prisma.cliente.findMany({
    select: { cedula: true, nombre: true, pinHash: true, claveHash: true, activo: true, pinIntentos: true, claveIntentos: true, pinBloqueadoHasta: true, claveBloqueadoHasta: true },
    orderBy: { cedula: 'asc' },
  });

  let pinOk = 0, pinFail = 0;
  let claveOk = 0, claveFail = 0;
  for (const c of clientes) {
    const pinOk_   = await bcrypt.compare(CLAVE_CLIENTE, c.pinHash || '');
    const claveOk_ = await bcrypt.compare(CLAVE_CLIENTE, c.claveHash || '');
    if (pinOk_)   pinOk++;   else pinFail++;
    if (claveOk_) claveOk++; else claveFail++;
  }
  console.log('\nClientes (verificación de hashes):');
  console.log(`  PIN 1234:    ${pinOk} OK / ${pinFail} fail  (de ${clientes.length})`);
  console.log(`  Clave 1234:  ${claveOk} OK / ${claveFail} fail  (de ${clientes.length})`);

  // Listar clientes específicos mencionados por el usuario
  const cedulasEspecificas = ['9000000002', '9000000004', '9000000005', '8888888888', '123456789'];
  console.log('\nClientes específicos mencionados por el usuario:');
  for (const cedula of cedulasEspecificas) {
    const c = clientes.find(x => x.cedula === cedula);
    if (!c) {
      console.log(`  ⚠️  cedula=${cedula} → NO encontrada en la BD`);
      continue;
    }
    const pinOk_   = await bcrypt.compare(CLAVE_CLIENTE, c.pinHash || '');
    const claveOk_ = await bcrypt.compare(CLAVE_CLIENTE, c.claveHash || '');
    console.log(`  ${pinOk_ && claveOk_ ? '✅' : '❌'} ${c.cedula} | ${c.nombre} | activo=${c.activo} | PIN=${pinOk_ ? 'OK' : 'FAIL'} | Clave=${claveOk_ ? 'OK' : 'FAIL'}`);
  }
}

async function main() {
  console.log('=====================================================');
  console.log(' RESETEO MASIVO DE CREDENCIALES (ENTORNO PRUEBAS) ');
  console.log('=====================================================');
  console.log(`  Usuarios internos: ${CLAVE_INTERNA}`);
  console.log(`  Clientes (PIN+clave): ${CLAVE_CLIENTE}`);
  console.log('');

  await resetInternos();
  await resetClientes();
  await verificar();

  console.log('\n=====================================================');
  console.log(' RESET COMPLETADO');
  console.log('=====================================================');
  console.log('Credenciales finales:');
  console.log('  ADMIN:     adm-jsadr       / Js951029*');
  console.log('  GESTOR:    gestor-jsadr    / Js951029*');
  console.log('  CONSULTOR: consultor-jsadr / Js951029*');
  console.log('  CLIENTES:  <cédula>        / 1234 (sirve como PIN y como clave)');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
