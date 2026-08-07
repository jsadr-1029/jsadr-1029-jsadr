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
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== Usuarios en BD ===\n');
  const users = await prisma.usuario.findMany();
  for (const u of users) {
    console.log({
      id: u.id,
      username: u.username,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      passwordHashPrefix: u.passwordHash?.substring(0, 25),
      passwordHashLength: u.passwordHash?.length,
      passwordHashStartsBcrypt: u.passwordHash?.startsWith('$2a$') || u.passwordHash?.startsWith('$2b$') || u.passwordHash?.startsWith('$2y$'),
      tieneClaveHash: !!u.claveHash,
      claveHashPrefix: u.claveHash?.substring(0, 25),
      claveHashBcrypt: u.claveHash?.startsWith('$2'),
      sessionToken: u.sessionToken ? '[SET len='+u.sessionToken.length+']' : null,
      ultimoAcceso: u.ultimoAcceso,
      intentosFallidos: u.intentosFallidos,
      bloqueadoHasta: u.bloqueadoHasta,
      mfaEnabled: u.mfaEnabled,
      mustChangePassword: u.mustChangePassword,
    });
  }
  
  console.log('\n=== Clientes con acceso al portal — primeros 5 ===');
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nombre: true, cedula: true, telefono: true, activo: true, claveHash: true, claveIntentos: true, claveBloqueadoHasta: true, pinHash: true, pinIntentos: true, pinBloqueadoHasta: true, tokenSesion: true, tokenExpira: true, ultimoAccesoPortal: true },
    take: 5
  });
  for (const c of clientes) {
    console.log({
      cedula: c.cedula,
      nombre: c.nombre,
      activo: c.activo,
      tieneClave: !!c.claveHash,
      claveBcrypt: c.claveHash?.startsWith('$2'),
      claveIntentos: c.claveIntentos,
      claveBloqueadoHasta: c.claveBloqueadoHasta,
      tienePin: !!c.pinHash,
      pinBcrypt: c.pinHash?.startsWith('$2'),
      pinIntentos: c.pinIntentos,
      pinBloqueadoHasta: c.pinBloqueadoHasta,
      ultimoAccesoPortal: c.ultimoAccesoPortal,
    });
  }
  
  await prisma.$disconnect();
})().catch(e => {
  console.error('ERR:', e.message);
  process.exit(1);
});
