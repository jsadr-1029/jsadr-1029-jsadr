process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.usuario.findMany({
    select: {
      id: true, nombre: true, username: true, email: true, rol: true,
      cedula: true, activo: true, bloqueadoHasta: true, intentosFallidos: true,
      mustChangePassword: true, ultimoAcceso: true, claveHash: true, passwordHash: true
    },
    orderBy: { rol: 'asc' }
  });
  console.log('Total usuarios:', users.length);
  for (const u of users) {
    console.log('---');
    console.log('  nombre:        ', u.nombre);
    console.log('  username:      ', u.username);
    console.log('  email:         ', u.email);
    console.log('  rol:           ', u.rol);
    console.log('  cedula:        ', u.cedula);
    console.log('  activo:        ', u.activo);
    console.log('  bloqueadoHasta:', u.bloqueadoHasta);
    console.log('  intentosFallidos:', u.intentosFallidos);
    console.log('  mustChange:    ', u.mustChangePassword);
    console.log('  ultimoAcceso:  ', u.ultimoAcceso);
    console.log('  passwordHash:  ', u.passwordHash ? '<presente, ' + u.passwordHash.substring(0,15) + '...>' : 'NULL');
    console.log('  claveHash:     ', u.claveHash ? '<presente, ' + u.claveHash.substring(0,15) + '...>' : 'NULL');
  }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
