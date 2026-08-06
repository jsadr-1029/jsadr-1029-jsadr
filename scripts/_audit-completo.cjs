// Auditoría completa de credenciales: lista usuarios + clientes con hashes (campos correctos)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

(async () => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true, username: true, passwordHash: true, rol: true,
        nombre: true, email: true, activo: true,
        cedula: true, claveHash: true,
        intentosFallidos: true, bloqueadoHasta: true,
        mustChangePassword: true
      }
    });
    const clientes = await prisma.cliente.findMany({
      select: {
        id: true, cedula: true, nombre: true,
        email: true, telefono: true, activo: true,
        pinHash: true, claveHash: true,
        pinIntentos: true, pinBloqueadoHasta: true,
        claveIntentos: true, claveBloqueadoHasta: true
      }
    });

    console.log('=== USUARIOS DEL SISTEMA (' + usuarios.length + ') ===');
    for (const u of usuarios) {
      console.log(JSON.stringify({
        id: u.id, username: u.username, rol: u.rol,
        nombre: u.nombre, email: u.email, activo: u.activo,
        cedula: u.cedula,
        passwordHash_prefix: u.passwordHash ? u.passwordHash.substring(0, 25) : null,
        passwordHash_len: u.passwordHash ? u.passwordHash.length : 0,
        claveHash_prefix: u.claveHash ? u.claveHash.substring(0, 25) : null,
        claveHash_len: u.claveHash ? u.claveHash.length : 0,
        intentosFallidos: u.intentosFallidos,
        bloqueadoHasta: u.bloqueadoHasta,
        mustChangePassword: u.mustChangePassword
      }));
    }

    console.log('\n=== CLIENTES (' + clientes.length + ') ===');
    for (const c of clientes) {
      console.log(JSON.stringify({
        id: c.id, cedula: c.cedula, nombre: c.nombre,
        email: c.email, telefono: c.telefono, activo: c.activo,
        pinHash_prefix: c.pinHash ? c.pinHash.substring(0, 25) : null,
        pinHash_len: c.pinHash ? c.pinHash.length : 0,
        claveHash_prefix: c.claveHash ? c.claveHash.substring(0, 25) : null,
        claveHash_len: c.claveHash ? c.claveHash.length : 0,
        pinIntentos: c.pinIntentos,
        pinBloqueadoHasta: c.pinBloqueadoHasta,
        claveIntentos: c.claveIntentos,
        claveBloqueadoHasta: c.claveBloqueadoHasta
      }));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
