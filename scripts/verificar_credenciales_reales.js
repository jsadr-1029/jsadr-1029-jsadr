// =====================================================
// VERIFICA las contraseñas reales de cada usuario/cliente
// comparando los candidatos conocidos contra los hashes bcrypt almacenados.
// Esto confirma de forma criptográfica cuál es la contraseña de cada cuenta.
// =====================================================
require('dotenv').config({ path: '/home/z/my-project/.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Candidatos conocidos (de scripts/setup-credenciales-portales.js, fix-todas-claves.cjs,
// reset-todas-credenciales.js, test-login-http.cjs, setup-credenciales-portales.js)
const CANDIDATOS_SISTEMA = [
  'Js951029*',
  'JsadrAdmin2026*',
  'JsadrGestor2026*',
  'JsadrConsultor2026*',
  'JsadrAbogado2026*',
  '731649',
  'Admin-Test-2026*',
];

const CANDIDATOS_CLIENTE_PIN = ['1234', '0000', '1111', '9999', '731649'];
const CANDIDATOS_CLIENTE_CLAVE = ['Js951029*', '731649', '1234', '000000'];

async function probarHash(hash, candidatos) {
  if (!hash) return null;
  for (const c of candidatos) {
    try {
      if (await bcrypt.compare(c, hash)) return c;
    } catch (e) { /* ignorar */ }
  }
  return null;
}

(async () => {
  try {
    console.log('\n' + '='.repeat(110));
    console.log('  VERIFICACIÓN CRIPTOGRÁFICA DE CREDENCIALES (bcrypt compare)');
    console.log('='.repeat(110));

    // ===== USUARIOS DEL SISTEMA =====
    console.log('\n┌─ USUARIOS DEL SISTEMA (login con username + password) ─────────────────────────────────────────────┐');
    console.log('│ (el campo "Clave portal" aplica solo a ABOGADO: login vía cédula + clave en /api/juridico/portal/auth) │');
    console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘\n');

    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, username: true, email: true, rol: true, cedula: true, activo: true, passwordHash: true, claveHash: true, ultimoAcceso: true },
    });

    const resultadoUsuarios = [];
    for (const u of usuarios) {
      const passReal = await probarHash(u.passwordHash, CANDIDATOS_SISTEMA);
      const clavePortalReal = u.claveHash ? await probarHash(u.claveHash, CANDIDATOS_SISTEMA) : null;
      resultadoUsuarios.push({
        nombre: u.nombre,
        username: u.username,
        email: u.email,
        rol: u.rol,
        cedula: u.cedula || '-',
        activo: u.activo,
        password: passReal || '(no coincide con candidatos conocidos)',
        clavePortal: u.claveHash ? (clavePortalReal || '(no coincide)') : '(no aplica)',
        ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toISOString() : '(nunca)',
      });
    }

    console.table(resultadoUsuarios.map(r => ({
      Rol: r.rol,
      Nombre: r.nombre,
      Username: r.username,
      'Contraseña (texto plano)': r.password,
      'Cédula': r.cedula,
      'Clave Portal Jurídico': r.clavePortal,
      'Email': r.email,
      'Activo': r.activo ? 'SÍ' : 'NO',
    })));

    // ===== CLIENTES =====
    console.log('\n┌─ CLIENTES (login con cédula + PIN o cédula + clave) ─────────────────────────────┐');
    console.log('│ PIN: 4 dígitos para /api/portal/login                                            │');
    console.log('│ Clave: alfanumérica para /api/portal/login (cuando el cliente la tiene seteada)  │');
    console.log('└───────────────────────────────────────────────────────────────────────────────────┘\n');

    const clientes = await prisma.cliente.findMany({
      orderBy: [{ nombre: 'asc' }],
      select: { id: true, nombre: true, cedula: true, email: true, telefono: true, activo: true, pinHash: true, claveHash: true, ultimoAccesoPortal: true },
    });

    const resultadoClientes = [];
    for (const c of clientes) {
      const pinReal = c.pinHash ? await probarHash(c.pinHash, CANDIDATOS_CLIENTE_PIN) : null;
      const claveReal = c.claveHash ? await probarHash(c.claveHash, CANDIDATOS_CLIENTE_CLAVE) : null;
      resultadoClientes.push({
        nombre: c.nombre,
        cedula: c.cedula,
        email: c.email || '-',
        telefono: c.telefono || '-',
        activo: c.activo,
        pin: c.pinHash ? (pinReal || '(no coincide)') : '(sin setear)',
        clave: c.claveHash ? (claveReal || '(no coincide)') : '(sin setear)',
        ultimoAcceso: c.ultimoAccesoPortal ? c.ultimoAccesoPortal.toISOString() : '(nunca)',
      });
    }

    console.table(resultadoClientes.map(r => ({
      Nombre: r.nombre,
      Cédula: r.cedula,
      'PIN (4 dígitos)': r.pin,
      'Clave alfanumérica': r.clave,
      'Email': r.email,
      'Teléfono': r.telefono,
      'Activo': r.activo ? 'SÍ' : 'NO',
    })));

    // ===== Exportar a JSON =====
    const fs = require('fs');
    const path = '/home/z/my-project/download/credenciales-verificadas.json';
    fs.writeFileSync(path, JSON.stringify({
      generadoEn: new Date().toISOString(),
      notaSeguridad: 'Las contraseñas se verifican comparando candidatos conocidos contra el hash bcrypt. Las que no coinciden NO se pueden recuperar en texto plano.',
      candidatosProbadosSistema: CANDIDATOS_SISTEMA,
      candidatosProbadosClientePin: CANDIDATOS_CLIENTE_PIN,
      candidatosProbadosClienteClave: CANDIDATOS_CLIENTE_CLAVE,
      usuariosSistema: resultadoUsuarios,
      clientes: resultadoClientes,
    }, null, 2));
    console.log(`\n📄 Credenciales verificadas exportadas a: ${path}\n`);

    // ===== Resumen =====
    const usersOk = resultadoUsuarios.filter(r => !r.password.startsWith('(')).length;
    const clientsPinOk = resultadoClientes.filter(r => !r.pin.startsWith('(') && !r.pin.includes('sin')).length;
    const clientsClaveOk = resultadoClientes.filter(r => !r.clave.startsWith('(') && !r.clave.includes('sin')).length;
    console.log('─'.repeat(80));
    console.log(`  RESUMEN:`);
    console.log(`  • Usuarios sistema con contraseña verificada : ${usersOk} / ${resultadoUsuarios.length}`);
    console.log(`  • Clientes con PIN verificado                : ${clientsPinOk} / ${resultadoClientes.length}`);
    console.log(`  • Clientes con clave alfanum. verificada     : ${clientsClaveOk} / ${resultadoClientes.length}`);
    console.log('─'.repeat(80));
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
