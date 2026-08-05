// =====================================================
// Lista TODOS los usuarios del sistema (Admin/Gestor/Consultor/Abogado + Clientes)
// con su información de autenticación.
//
// NOTA DE SEGURIDAD:
// - Las contraseñas se almacenan como hash bcrypt (rounds=12), son ONE-WAY.
// - NO es posible recuperar la contraseña en texto plano desde la BD.
// - Este script muestra: usuario/email/rol + SI tiene contraseña + el hash (para auditoría).
// - Para clientes: cédula + si tiene PIN + si tiene clave alfanumérica.
// =====================================================
require('dotenv').config({ path: '/home/z/my-project/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n' + '='.repeat(100));
    console.log('  USUARIOS DEL SISTEMA (Admin / Gestor / Consultor / Abogado)');
    console.log('='.repeat(100));

    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        email: true,
        username: true,
        rol: true,
        activo: true,
        cedula: true,
        passwordHash: true,
        claveHash: true,
        mfaEnabled: true,
        mustChangePassword: true,
        ultimoAcceso: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
        createdAt: true,
      },
    });

    if (usuarios.length === 0) {
      console.log('  (No hay usuarios del sistema registrados)');
    } else {
      console.log(`  Total: ${usuarios.length} usuario(s)\n`);
      usuarios.forEach((u, i) => {
        console.log(`  ─── Usuario #${i + 1} ───────────────────────────────────────────`);
        console.log(`  Nombre           : ${u.nombre}`);
        console.log(`  Username (login) : ${u.username}`);
        console.log(`  Email            : ${u.email || '-'}`);
        console.log(`  Cédula           : ${u.cedula || '-'}`);
        console.log(`  Rol              : ${u.rol}`);
        console.log(`  Activo           : ${u.activo ? 'SÍ' : 'NO'}`);
        console.log(`  Contraseña (hash): ${u.passwordHash ? u.passwordHash.substring(0, 25) + '...' : '(sin setear)'}`);
        console.log(`  Clave portal     : ${u.claveHash ? u.claveHash.substring(0, 25) + '...' : '(no aplica)'}`);
        console.log(`  MFA habilitado   : ${u.mfaEnabled ? 'SÍ' : 'NO'}`);
        console.log(`  Debe cambiar pass: ${u.mustChangePassword ? 'SÍ' : 'NO'}`);
        console.log(`  Intentos fallidos: ${u.intentosFallidos}`);
        console.log(`  Bloqueado hasta  : ${u.bloqueadoHasta ? u.bloqueadoHasta.toISOString() : '-'}`);
        console.log(`  Último acceso    : ${u.ultimoAcceso ? u.ultimoAcceso.toISOString() : '(nunca)'}`);
        console.log(`  Creado           : ${u.createdAt.toISOString()}`);
        console.log('');
      });
    }

    console.log('\n' + '='.repeat(100));
    console.log('  CLIENTES (Portal de Clientes)');
    console.log('='.repeat(100));

    const clientes = await prisma.cliente.findMany({
      orderBy: [{ nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        cedula: true,
        email: true,
        telefono: true,
        activo: true,
        pinHash: true,
        pinCreatedAt: true,
        pinIntentos: true,
        pinBloqueadoHasta: true,
        claveHash: true,
        claveCreatedAt: true,
        claveIntentos: true,
        claveBloqueadoHasta: true,
        ultimoAccesoPortal: true,
      },
    });

    if (clientes.length === 0) {
      console.log('  (No hay clientes registrados)');
    } else {
      console.log(`  Total: ${clientes.length} cliente(s)\n`);
      clientes.forEach((c, i) => {
        console.log(`  ─── Cliente #${i + 1} ───────────────────────────────────────────`);
        console.log(`  Nombre           : ${c.nombre}`);
        console.log(`  Cédula (login)   : ${c.cedula}`);
        console.log(`  Email            : ${c.email || '-'}`);
        console.log(`  Teléfono         : ${c.telefono || '-'}`);
        console.log(`  Activo           : ${c.activo ? 'SÍ' : 'NO'}`);
        console.log(`  PIN (4 dígitos)  : ${c.pinHash ? c.pinHash.substring(0, 20) + '...' : '(sin setear)'}`);
        console.log(`  Clave alfanum.   : ${c.claveHash ? c.claveHash.substring(0, 20) + '...' : '(sin setear)'}`);
        console.log(`  PIN intentos     : ${c.pinIntentos}`);
        console.log(`  Clave intentos   : ${c.claveIntentos}`);
        console.log(`  PIN bloqueado    : ${c.pinBloqueadoHasta ? c.pinBloqueadoHasta.toISOString() : '-'}`);
        console.log(`  Clave bloqueada  : ${c.claveBloqueadoHasta ? c.claveBloqueadoHasta.toISOString() : '-'}`);
        console.log(`  Último acceso    : ${c.ultimoAccesoPortal ? c.ultimoAccesoPortal.toISOString() : '(nunca)'}`);
        console.log('');
      });
    }

    // ===== Resumen ejecutivo =====
    console.log('\n' + '='.repeat(100));
    console.log('  RESUMEN EJECUTIVO');
    console.log('='.repeat(100));
    const adminCount = usuarios.filter(u => u.rol === 'ADMIN').length;
    const gestorCount = usuarios.filter(u => u.rol === 'GESTOR').length;
    const consultorCount = usuarios.filter(u => u.rol === 'CONSULTOR').length;
    const abogadoCount = usuarios.filter(u => u.rol === 'ABOGADO').length;
    const clientesConClave = clientes.filter(c => c.claveHash).length;
    const clientesConPin = clientes.filter(c => c.pinHash).length;
    const clientesSinAuth = clientes.filter(c => !c.pinHash && !c.claveHash).length;

    console.log(`  Usuarios Sistema : ${usuarios.length}`);
    console.log(`    - ADMIN        : ${adminCount}`);
    console.log(`    - GESTOR       : ${gestorCount}`);
    console.log(`    - CONSULTOR    : ${consultorCount}`);
    console.log(`    - ABOGADO      : ${abogadoCount}`);
    console.log(`  Clientes         : ${clientes.length}`);
    console.log(`    - Con PIN      : ${clientesConPin}`);
    console.log(`    - Con clave    : ${clientesConClave}`);
    console.log(`    - Sin auth     : ${clientesSinAuth}`);
    console.log('');
    console.log('  ⚠️  NOTA DE SEGURIDAD:');
    console.log('  Las contraseñas están almacenadas como HASH BCRYPT (one-way, rounds=12).');
    console.log('  NO es técnicamente posible recuperar la contraseña original en texto plano.');
    console.log('  Si necesitas acceso de testing, usa el script reset-credential.cjs para');
    console.log('  regenerar una contraseña conocida temporal.');
    console.log('');

    // ===== Exportar a JSON para auditoría =====
    const fs = require('fs');
    const path = '/home/z/my-project/download/listado-usuarios-auditoria.json';
    fs.mkdirSync('/home/z/my-project/download', { recursive: true });
    fs.writeFileSync(path, JSON.stringify({
      generadoEn: new Date().toISOString(),
      usuariosSistema: usuarios.map(u => ({
        nombre: u.nombre,
        username: u.username,
        email: u.email,
        rol: u.rol,
        activo: u.activo,
        cedula: u.cedula,
        tienePassword: !!u.passwordHash,
        passwordHashBcrypt: u.passwordHash,
        tieneClavePortal: !!u.claveHash,
        mfa: u.mfaEnabled,
        ultimoAcceso: u.ultimoAcceso,
      })),
      clientes: clientes.map(c => ({
        nombre: c.nombre,
        cedula: c.cedula,
        email: c.email,
        telefono: c.telefono,
        activo: c.activo,
        tienePin: !!c.pinHash,
        pinHashBcrypt: c.pinHash,
        tieneClave: !!c.claveHash,
        claveHashBcrypt: c.claveHash,
        ultimoAccesoPortal: c.ultimoAccesoPortal,
      })),
    }, null, 2));
    console.log(`  📄 Listado completo exportado a: ${path}`);
    console.log('');

  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
