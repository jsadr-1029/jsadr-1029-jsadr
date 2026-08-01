process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.usuario.findMany({
    where: { rol: { in: ['ABOGADO', 'GESTOR'] } },
    select: {
      id: true, nombre: true, username: true, email: true, rol: true,
      cedula: true, activo: true, bloqueadoHasta: true, intentosFallidos: true,
      ultimoAcceso: true, mustChangePassword: true, claveHash: true, updatedAt: true
    }
  });
  console.log('Usuarios con rol ABOGADO o GESTOR:', users.length);
  for (const u of users) {
    console.log('---');
    console.log('  nombre:', u.nombre);
    console.log('  username:', u.username);
    console.log('  email:', u.email);
    console.log('  rol:', u.rol);
    console.log('  cedula:', u.cedula);
    console.log('  activo:', u.activo);
    console.log('  bloqueadoHasta:', u.bloqueadoHasta);
    console.log('  intentosFallidos:', u.intentosFallidos);
    console.log('  ultimoAcceso:', u.ultimoAcceso);
    console.log('  mustChangePassword:', u.mustChangePassword);
    console.log('  claveHash presente:', !!u.claveHash);
    console.log('  claveHash (primeros 30):', u.claveHash ? u.claveHash.substring(0,30) : 'NULL');
    console.log('  updatedAt:', u.updatedAt);
  }
  
  console.log('\n=== Todos los usuarios (para referencia) ===');
  const all = await prisma.usuario.findMany({
    select: { nombre: true, username: true, rol: true, cedula: true, activo: true }
  });
  console.log('Total usuarios en sistema:', all.length);
  for (const u of all) {
    console.log(`  - ${u.username} | ${u.rol} | cedula=${u.cedula} | activo=${u.activo}`);
  }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
