process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Look for any user that's a lawyer
  const abogados = await prisma.usuario.findMany({
    where: { OR: [{ rol: { contains: 'ABOGADO' } }, { rol: { contains: 'JURIDICO' } }] }
  });
  console.log('Usuarios abogado/jurídico encontrados:', abogados.length);
  for (const u of abogados) {
    console.log('---');
    console.log('  id:', u.id);
    console.log('  nombre:', u.nombre);
    console.log('  usuario:', u.usuario);
    console.log('  email:', u.email);
    console.log('  rol:', u.rol);
    console.log('  activo:', u.activo);
    console.log('  bloqueado:', u.bloqueado);
    console.log('  mustChangePassword:', u.mustChangePassword);
    console.log('  ultimoAcceso:', u.ultimoAcceso);
    console.log('  updatedAt:', u.updatedAt);
  }
  
  // Also check Cliente table for any role 'abogado' or related
  console.log('\n=== Tabla Cliente (buscando tipo ABOGADO) ===');
  try {
    const clientes = await prisma.cliente.findMany({
      where: { OR: [{ tipo: { contains: 'abogado' } }, { tipo: { contains: 'ABOGADO' } }] }
    });
    console.log('Clientes con tipo abogado:', clientes.length);
    for (const c of clientes.slice(0,5)) {
      console.log('  -', c.nombre, c.email, c.tipo, c.documento);
    }
  } catch (e) {
    console.log('  Error o sin campo tipo:', e.message.substring(0,100));
  }
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
