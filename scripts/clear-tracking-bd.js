// Limpia el tracking del hallazgo "Permisos Archivo BD" para que se muestre
// el estado del escaneo técnico (ahora 🟢 con detección de BD remota).
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient();

async function main() {
  console.log('Limpiando tracking del hallazgo "Permisos Archivo BD"...');
  const deleted = await prisma.auditoriaHallazgo.deleteMany({
    where: { control: 'Permisos Archivo BD' },
  });
  console.log(`✓ ${deleted.count} registro(s) eliminado(s) del tracking.`);

  const restantes = await prisma.auditoriaHallazgo.findMany();
  console.log(`\nHallazgos trackeados restantes: ${restantes.length}`);
  for (const h of restantes) {
    console.log(`  [${h.estado}] ${h.control}`);
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
