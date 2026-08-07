// =====================================================
// RESET UNIFICADO DE CLAVES — JSADR
// =====================================================
//  - Usuarios del sistema (Admin/Gestor/Consultor/Abogado): Js951029*
//  - Clientes (portal cliente): 4321  (usuario = cédula)
// Limpia:
//   - intentosFallidos = 0
//   - bloqueadoHasta = null
//   - sessionToken = null (invalida sesiones JWT viejas)
//   - tokenSesion = null (invalida sesiones del portal jurídico)
//   - activo = true
// =====================================================
const fs = require('fs');
const path = require('path');

// Cargar .env manualmente
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
});

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SISTEMA_CLAVE = 'Js951029*';
const CLIENTE_CLAVE = '4321';
const BCRYPT_ROUNDS = 12;

(async () => {
  console.log('=====================================================');
  console.log(' RESET UNIFICADO DE CLAVES — JSADR                   ');
  console.log('=====================================================');
  console.log(`  Sistema (Admin/Gestor/Consultor/Abogado): "${SISTEMA_CLAVE}"`);
  console.log(`  Clientes (Portal): "${CLIENTE_CLAVE}"  (usuario = cédula)`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL.split('@')[0]}...@${process.env.DATABASE_URL.split('@')[1]?.substring(0, 50)}`);
  console.log('');

  // ===== 1. USUARIOS DEL SISTEMA =====
  console.log('═══════════════════════════════════════════════════');
  console.log(' 1. USUARIOS DEL SISTEMA');
  console.log('═══════════════════════════════════════════════════');
  const newHash = await bcrypt.hash(SISTEMA_CLAVE, BCRYPT_ROUNDS);
  console.log(`  Hash bcrypt("${SISTEMA_CLAVE}"): ${newHash.substring(0, 30)}... (${newHash.length} chars)\n`);

  const usuarios = await prisma.usuario.findMany();
  const usuariosActualizados = [];
  for (const u of usuarios) {
    const updated = await prisma.usuario.update({
      where: { id: u.id },
      data: {
        passwordHash: newHash,
        // Abogados usan claveHash para el portal jurídico (login independiente)
        claveHash: u.rol === 'ABOGADO' ? newHash : u.claveHash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        sessionToken: null,
        tokenSesion: null,
        tokenExpira: null,
        activo: true,
        mustChangePassword: false,
      }
    });
    // Verificación
    const check = await prisma.usuario.findUnique({ where: { id: u.id } });
    const passOk = check.passwordHash && bcrypt.compareSync(SISTEMA_CLAVE, check.passwordHash);
    const claveOk = check.claveHash && bcrypt.compareSync(SISTEMA_CLAVE, check.claveHash);
    usuariosActualizados.push({
      id: u.id,
      rol: u.rol,
      username: u.username,
      email: u.email,
      cedula: u.cedula,
      nombre: u.nombre,
      passwordMatch: passOk,
      claveHashMatch: claveOk,
    });
    console.log(`  ✅ [${u.rol.padEnd(10)}] ${u.username.padEnd(20)} email=${u.email.padEnd(35)} cedula=${u.cedula || '-'}  pass=✓${passOk ? 'OK' : 'FAIL'}  claveHash=${u.rol === 'ABOGADO' ? (claveOk ? '✓OK' : '✗FAIL') : 'N/A'}`);
  }
  console.log(`\n  Total usuarios sistema actualizados: ${usuariosActualizados.length}`);

  // ===== 2. CLIENTES =====
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' 2. CLIENTES (Portal del Cliente)');
  console.log('═══════════════════════════════════════════════════');
  const clienteHash = await bcrypt.hash(CLIENTE_CLAVE, BCRYPT_ROUNDS);
  console.log(`  Hash bcrypt("${CLIENTE_CLAVE}"): ${clienteHash.substring(0, 30)}... (${clienteHash.length} chars)\n`);

  const clientes = await prisma.cliente.findMany();
  const clientesActualizados = [];
  for (const c of clientes) {
    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        claveHash: clienteHash,
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        claveResetToken: null,
        claveResetExpira: null,
        pinHash: null,
        pinIntentos: 0,
        pinBloqueadoHasta: null,
        tokenSesion: null,
        tokenExpira: null,
      }
    });
    // Verificación
    const check = await prisma.cliente.findUnique({ where: { id: c.id } });
    const claveOk = check.claveHash && bcrypt.compareSync(CLIENTE_CLAVE, check.claveHash);
    clientesActualizados.push({
      id: c.id,
      nombre: c.nombre,
      cedula: c.cedula,
      email: c.email,
      telefono: c.telefono,
      claveMatch: claveOk,
    });
    console.log(`  ✅ ${c.nombre.padEnd(25)} cedula=${c.cedula.padEnd(15)} tel=${c.telefono || '-'}  clave=✓${claveOk ? 'OK' : 'FAIL'}`);
  }
  console.log(`\n  Total clientes actualizados: ${clientesActualizados.length}`);

  // ===== 3. RESUMEN FINAL =====
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' 3. RESUMEN FINAL');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Usuarios sistema reseteados: ${usuariosActualizados.length}`);
  console.log(`    - ADMIN     : ${usuariosActualizados.filter(u => u.rol === 'ADMIN').length}`);
  console.log(`    - GESTOR    : ${usuariosActualizados.filter(u => u.rol === 'GESTOR').length}`);
  console.log(`    - CONSULTOR : ${usuariosActualizados.filter(u => u.rol === 'CONSULTOR').length}`);
  console.log(`    - ABOGADO   : ${usuariosActualizados.filter(u => u.rol === 'ABOGADO').length}`);
  console.log(`  Clientes reseteados: ${clientesActualizados.length}`);
  console.log(`\n  Credenciales unificadas:`);
  console.log(`    Sistema (Admin/Gestor/Consultor/Abogado): ${SISTEMA_CLAVE}`);
  console.log(`    Clientes (Portal): ${CLIENTE_CLAVE} (usuario = cédula)`);

  console.log(`\n  Listado completo de usuarios para login:`);
  console.log('  ─────────────────────────────────────────────────');
  for (const u of usuariosActualizados) {
    console.log(`  [${u.rol.padEnd(10)}] ${u.username.padEnd(20)} | email=${u.email.padEnd(35)} | clave="${SISTEMA_CLAVE}"`);
  }
  console.log('  ─────────────────────────────────────────────────');
  for (const c of clientesActualizados) {
    console.log(`  [CLIENTE   ] ${c.cedula.padEnd(20)} | nombre=${c.nombre.padEnd(25)} | clave="${CLIENTE_CLAVE}"`);
  }

  // Guardar JSON para auditoría
  const resumen = {
    generadoEn: new Date().toISOString(),
    claveSistema: SISTEMA_CLAVE,
    claveClientes: CLIENTE_CLAVE,
    usuariosSistema: usuariosActualizados,
    clientes: clientesActualizados,
  };
  const outPath = '/home/z/my-project/download/reset-claves-unificado.json';
  fs.writeFileSync(outPath, JSON.stringify(resumen, null, 2));
  console.log(`\n  Resumen JSON guardado: ${outPath}`);

  await prisma.$disconnect();
  console.log('\n✅ Reset unificado completado.');
})().catch(e => {
  console.error('❌ ERR:', e.message);
  process.exit(1);
});
