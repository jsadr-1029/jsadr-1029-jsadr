// =====================================================
// RESET DE CONTRASEÑAS — JSADR
// Restablece:
//   1. Admin principal (Adm-Jsadr) → Js121473164*
//   2. Gestor (P_jsadr) → Js121473164*
//   3. Abogados → Js121473164* (claveHash para portal jurídico)
//   4. Clientes → cédula como clave temporal (para portal)
// Limpia:
//   - intentosFallidos = 0
//   - bloqueadoHasta = null
//   - sessionToken = null (invalida sesiones JWT viejas)
//   - tokenSesion = null (invalida sesiones del portal jurídico)
// =====================================================
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_PASSWORD = 'Js121473164*';
const BCRYPT_ROUNDS = 12;

(async () => {
  console.log('=== RESET DE CONTRASEÑAS JSADR ===\n');
  
  const newPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  console.log(`Nuevo hash para "${ADMIN_PASSWORD}": ${newPasswordHash.substring(0, 30)}...\n`);
  
  // 1. Reset de todos los usuarios (admin, gestor, abogados, consultor)
  console.log('=== Usuarios (sistema interno) ===');
  const usuarios = await prisma.usuario.findMany();
  for (const u of usuarios) {
    const updated = await prisma.usuario.update({
      where: { id: u.id },
      data: {
        passwordHash: newPasswordHash,
        claveHash: u.rol === 'ABOGADO' ? newPasswordHash : u.claveHash, // abogados usan claveHash para portal jurídico
        intentosFallidos: 0,
        bloqueadoHasta: null,
        sessionToken: null, // invalida refresh tokens viejos
        tokenSesion: null, // invalida sesiones del portal jurídico
        tokenExpira: null,
        activo: true,
        mustChangePassword: false,
      }
    });
    console.log(`✅ ${updated.username.padEnd(20)} | rol: ${updated.rol.padEnd(10)} | password + claveHash reseteados`);
  }
  
  // 2. Reset de clientes (portal del cliente)
  console.log('\n=== Clientes (portal del cliente) ===');
  const clientes = await prisma.cliente.findMany();
  let countClientes = 0;
  for (const c of clientes) {
    // Para clientes, la clave = su cédula (temporal, deberán cambiarla)
    const claveCliente = c.cedula;
    const claveHash = await bcrypt.hash(claveCliente, BCRYPT_ROUNDS);
    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        claveHash,
        claveIntentos: 0,
        claveBloqueadoHasta: null,
        claveResetToken: null,
        claveResetExpira: null,
        pinHash: null, // limpiar PIN viejo para forzar uso de clave
        pinIntentos: 0,
        pinBloqueadoHasta: null,
        tokenSesion: null,
        tokenExpira: null,
      }
    });
    countClientes++;
    if (countClientes <= 3) {
      console.log(`✅ ${c.nombre.padEnd(30)} | cedula: ${c.cedula} | clave temporal = cédula`);
    }
  }
  console.log(`✅ Total clientes actualizados: ${countClientes}`);
  
  // 3. Resumen final
  console.log('\n=== RESUMEN FINAL ===');
  console.log(`Usuarios reseteados: ${usuarios.length}`);
  console.log(`Clientes reseteados: ${countClientes}`);
  console.log(`\nContraseñas nuevas:`);
  console.log(`  Admin/Gestor/Abogado: ${ADMIN_PASSWORD}`);
  console.log(`  Clientes (portal): su número de cédula (deberán cambiarla)`);
  console.log(`\nUsuarios disponibles para login:`);
  for (const u of usuarios) {
    console.log(`  ${u.rol.padEnd(10)} | ${u.username.padEnd(20)} | ${ADMIN_PASSWORD}`);
  }
  
  await prisma.$disconnect();
  console.log('\n✅ Reset completo. Ya puede iniciar sesión.');
})().catch(e => {
  console.error('❌ ERR:', e.message);
  process.exit(1);
});
