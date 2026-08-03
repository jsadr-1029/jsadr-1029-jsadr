// Marca el hallazgo "Permisos Archivo BD" como descartado en el tracking
// Razón: la BD es PostgreSQL remoto en Neon (no hay archivo local db/custom.db)
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient();

async function main() {
  console.log('Marcando "Permisos Archivo BD" como descartado...');

  // Descartar el hallazgo de Permisos Archivo BD
  const resultado = await prisma.auditoriaHallazgo.upsert({
    where: { control: 'Permisos Archivo BD' },
    create: {
      control: 'Permisos Archivo BD',
      estado: 'descartado',
      nivelRiesgo: 'Medio',
      notasTrabajo: 'Descartado: la BD es PostgreSQL remoto en Neon (sin archivo local db/custom.db). El control no aplica a esta arquitectura.',
      fechaResolucion: new Date(),
    },
    update: {
      estado: 'descartado',
      nivelRiesgo: 'Medio',
      notasTrabajo: 'Descartado: la BD es PostgreSQL remoto en Neon (sin archivo local db/custom.db). El control no aplica a esta arquitectura.',
      fechaResolucion: new Date(),
    },
  });

  console.log('✓ Hallazgo actualizado:');
  console.log('  Control:', resultado.control);
  console.log('  Estado:', resultado.estado);
  console.log('  Notas:', resultado.notasTrabajo);

  // Listar todos los hallazgos trackeados para verificación
  const todos = await prisma.auditoriaHallazgo.findMany();
  console.log('\n=== Hallazgos trackeados ===');
  for (const h of todos) {
    console.log(`  [${h.estado}] ${h.control} (${h.nivelRiesgo})`);
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
