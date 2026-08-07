// Verificación real de credenciales — intenta bcrypt.compare con varias claves conocidas
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

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

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLAVES_CANDIDATAS = [
  'Js951029*',
  'Js121473164*',
  '4321',
  '731649',
  '7316490',
  'Jsadr',
  'jsadr',
  'admin',
  'Admin123',
  '123456',
];

(async () => {
  console.log('=== VERIFICACIÓN DE CREDENCIALES REALES EN NEON ===\n');

  // 1. Usuarios del sistema
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true, nombre: true, email: true, username: true, cedula: true,
      rol: true, activo: true, passwordHash: true, claveHash: true,
      mustChangePassword: true, createdAt: true, ultimoAcceso: true,
      intentosFallidos: true, bloqueadoHasta: true,
    },
    orderBy: [{ rol: 'asc' }, { createdAt: 'asc' }]
  });

  console.log(`👥 USUARIOS DEL SISTEMA (${usuarios.length}):\n`);
  const usuariosResumen = [];
  for (const u of usuarios) {
    // Probar cada clave candidata contra passwordHash y claveHash
    let passMatch = null;
    let claveMatch = null;
    for (const c of CLAVES_CANDIDATAS) {
      if (!passMatch && u.passwordHash && bcrypt.compareSync(c, u.passwordHash)) passMatch = c;
      if (!claveMatch && u.claveHash && bcrypt.compareSync(c, u.claveHash)) claveMatch = c;
      if (passMatch && claveMatch) break;
    }
    usuariosResumen.push({
      rol: u.rol,
      username: u.username,
      email: u.email,
      nombre: u.nombre,
      cedula: u.cedula,
      activo: u.activo,
      passwordClaro: passMatch || '(desconocida)',
      clavePortalJuridico: claveMatch || (u.rol === 'ABOGADO' ? '(desconocida)' : 'N/A'),
      ultimoAcceso: u.ultimoAcceso,
      createdAt: u.createdAt,
    });
    console.log(`  [${u.rol.padEnd(10)}] username=${u.username.padEnd(20)} email=${u.email.padEnd(35)} cedula=${u.cedula || '-'}`);
    console.log(`               password="${passMatch || '?'}"  clavePortalJuridico="${claveMatch || (u.rol === 'ABOGADO' ? '?' : 'N/A')}"  activo=${u.activo}`);
  }

  // 2. Clientes (portal cliente)
  console.log(`\n👥 CLIENTES (Portal Cliente):\n`);
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true, nombre: true, cedula: true, email: true, telefono: true,
      activo: true, claveHash: true, pinHash: true, ultimoAccesoPortal: true,
      createdAt: true
    },
    orderBy: [{ nombre: 'asc' }]
  });
  const clientesResumen = [];
  for (const c of clientes) {
    // La clave del portal del cliente = cédula (según _reset-all-passwords.cjs)
    let claveMatch = null;
    if (c.claveHash) {
      // Probar cédula y claves candidatas
      const candidatasCliente = [c.cedula, ...CLAVES_CANDIDATAS];
      for (const cand of candidatasCliente) {
        if (bcrypt.compareSync(cand, c.claveHash)) { claveMatch = cand; break; }
      }
    }
    let pinMatch = null;
    if (c.pinHash) {
      // PIN usualmente 4 dígitos = últimos 4 de cédula
      const pinCands = [c.cedula.slice(-4), '1234', '0000'];
      for (const cand of pinCands) {
        if (bcrypt.compareSync(cand, c.pinHash)) { pinMatch = cand; break; }
      }
    }
    clientesResumen.push({
      nombre: c.nombre,
      cedula: c.cedula,
      email: c.email,
      telefono: c.telefono,
      activo: c.activo,
      clavePortal: claveMatch || (c.claveHash ? '(hash no coincide con cédula ni candidatas)' : '(sin clave)'),
      pin: pinMatch || (c.pinHash ? '(hash no coincide)' : '(sin PIN)'),
      ultimoAcceso: c.ultimoAccesoPortal,
    });
    console.log(`  ${c.nombre.padEnd(25)} cedula=${c.cedula.padEnd(15)} tel=${c.telefono || '-'}  clavePortal="${claveMatch || '?'}"  pin="${pinMatch || '-'}"`);
  }

  // 3. Guardar resumen JSON
  const resumen = {
    generadoEn: new Date().toISOString(),
    clavesProbadas: CLAVES_CANDIDATAS,
    usuariosSistema: usuariosResumen,
    clientesPortal: clientesResumen,
  };
  const outPath = '/home/z/my-project/download/listado-usuarios-credenciales.json';
  fs.writeFileSync(outPath, JSON.stringify(resumen, null, 2));
  console.log(`\n✅ Resumen guardado en: ${outPath}`);

  // 4. Tabla resumen final
  console.log('\n=== RESUMEN FINAL ===');
  const conteo = usuariosResumen.reduce((acc, u) => { acc[u.rol] = (acc[u.rol] || 0) + 1; return acc; }, {});
  Object.entries(conteo).forEach(([r, n]) => console.log(`  ${r.padEnd(12)}: ${n}`));
  console.log(`  CLIENTES     : ${clientesResumen.length}`);
  console.log(`  TOTAL usuarios + clientes: ${usuariosResumen.length + clientesResumen.length}`);

  await prisma.$disconnect();
})().catch(e => {
  console.error('❌ ERR:', e.message);
  process.exit(1);
});
