const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // === USUARIOS INTERNOS (Usuario table) ===
    console.log('====================================================');
    console.log('USUARIOS INTERNOS (tabla Usuario)');
    console.log('====================================================');
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true, username: true, nombre: true, email: true, cedula: true,
        rol: true, activo: true, passwordHash: true,
        intentosFallidos: true, bloqueadoHasta: true,
        mfaEnabled: true, mustChangePassword: true, ultimoAcceso: true,
        createdAt: true
      },
      orderBy: { rol: 'asc' }
    });
    console.log(`Total: ${usuarios.length} usuarios internos\n`);
    for (const u of usuarios) {
      console.log(`── ${u.nombre} ────────────────────`);
      console.log(`  Username:    ${u.username}`);
      console.log(`  Rol:         ${u.rol}`);
      console.log(`  Email:       ${u.email || '(no asignado)'}`);
      console.log(`  Cédula:      ${u.cedula || '(no asignada)'}`);
      console.log(`  Activo:      ${u.activo ? 'SÍ' : 'NO'}`);
      console.log(`  MFA:         ${u.mfaEnabled ? 'ACTIVO' : 'No'}`);
      console.log(`  Bloqueado:   ${u.bloqueadoHasta ? `HASTA ${u.bloqueadoHasta.toISOString()}` : 'No'}`);
      console.log(`  Intentos:    ${u.intentosFallidos}`);
      console.log(`  Últ. acceso: ${u.ultimoAcceso ? u.ultimoAcceso.toISOString() : 'Nunca'}`);
      console.log(`  Creado:      ${u.createdAt.toISOString()}`);
      console.log(`  Hash:        ${u.passwordHash}`);
      console.log(`  Debe cambiar pwd: ${u.mustChangePassword ? 'SÍ' : 'No'}`);
      // Probar contraseñas documentadas
      const candidates = [
        'JsadrAdmin2026*', 'JsadrGestor2026*', 'JsadrConsultor2026*', 'JsadrAbogado2026*',
        '1234', '123456', 'admin', 'Jsadr2026*', 'Jsadr2026',
        'JsadrAdmin2026', 'JsadrAdm2026*', 'JsadrAdm2026',
      ];
      let match = null;
      for (const c of candidates) {
        if (await bcrypt.compare(c, u.passwordHash)) { match = c; break; }
      }
      console.log(`  Contraseña:  ${match ? `✅ ${match}` : '❌ No documentada (hash no coincide con ninguna contraseña conocida)'}`);
      console.log('');
    }

    // === CLIENTES (Cliente table) ===
    console.log('====================================================');
    console.log('CLIENTAS / CLIENTES (tabla Cliente) — acceso al Portal del Cliente');
    console.log('====================================================');
    const clientes = await prisma.cliente.findMany({
      select: {
        id: true, nombre: true, cedula: true, telefono: true, email: true,
        activo: true, pinHash: true, claveHash: true,
        pinIntentos: true, pinBloqueadoHasta: true,
        claveIntentos: true, claveBloqueadoHasta: true,
        pinCreatedAt: true, claveCreatedAt: true,
        ultimoAccesoPortal: true, createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    console.log(`Total: ${clientes.length} clientes\n`);
    for (const c of clientes) {
      console.log(`── ${c.nombre} ────────────────────`);
      console.log(`  Cédula:      ${c.cedula}`);
      console.log(`  Teléfono:    ${c.telefono || '(no asignado)'}`);
      console.log(`  Email:       ${c.email || '(no asignado)'}`);
      console.log(`  Activo:      ${c.activo ? 'SÍ' : 'NO'}`);
      console.log(`  Últ. acceso: ${c.ultimoAccesoPortal ? c.ultimoAccesoPortal.toISOString() : 'Nunca'}`);
      console.log(`  Creado:      ${c.createdAt.toISOString()}`);
      // PIN
      if (c.pinHash) {
        const pinCandidates = ['1234', '0000', '1111', '9999', '12345', '123456', '4321', '000000'];
        let pinMatch = null;
        for (const p of pinCandidates) {
          if (await bcrypt.compare(p, c.pinHash)) { pinMatch = p; break; }
        }
        console.log(`  PIN:         ${pinMatch ? `✅ ${pinMatch}` : '❌ No encontrado en candidatos comunes'}`);
        console.log(`  PIN creado:  ${c.pinCreatedAt ? c.pinCreatedAt.toISOString() : 'N/A'}`);
        console.log(`  PIN intentos:${c.pinIntentos}, bloqueado hasta: ${c.pinBloqueadoHasta || 'No'}`);
      } else {
        console.log(`  PIN:         (sin PIN asignado)`);
      }
      // Clave
      if (c.claveHash) {
        const claveCandidates = ['1234', 'JsadrCliente2026*', 'cliente2026', 'Cliente2026*', '123456', 'Jsadr2026*'];
        let claveMatch = null;
        for (const k of claveCandidates) {
          if (await bcrypt.compare(k, c.claveHash)) { claveMatch = k; break; }
        }
        console.log(`  Clave:       ${claveMatch ? `✅ ${claveMatch}` : '❌ No encontrada en candidatos comunes'}`);
        console.log(`  Clave creada:${c.claveCreatedAt ? c.claveCreatedAt.toISOString() : 'N/A'}`);
        console.log(`  Clave intentos:${c.claveIntentos}, bloqueada hasta: ${c.claveBloqueadoHasta || 'No'}`);
      } else {
        console.log(`  Clave:       (sin clave asignada — usan PIN)`);
      }
      console.log('');
    }

    // === RESUMEN ===
    console.log('====================================================');
    console.log('RESUMEN');
    console.log('====================================================');
    console.log(`Usuarios internos: ${usuarios.length} (${usuarios.filter(u=>u.activo).length} activos)`);
    console.log(`  Por rol:`);
    const porRol = {};
    for (const u of usuarios) porRol[u.rol] = (porRol[u.rol] || 0) + 1;
    for (const [rol, count] of Object.entries(porRol)) console.log(`    ${rol}: ${count}`);
    console.log(`Clientes: ${clientes.length} (${clientes.filter(c=>c.activo).length} activos)`);
    console.log(`  Con PIN asignado: ${clientes.filter(c=>c.pinHash).length}`);
    console.log(`  Con clave asignada: ${clientes.filter(c=>c.claveHash).length}`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
