// Verify Prisma+PostgreSQL works locally against Neon
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Test 1: Usuario.findMany() ===');
  const users = await prisma.usuario.findMany({ select: { username: true, rol: true, activo: true } });
  console.log(`Found ${users.length} users:`);
  for (const u of users) console.log(`  - ${u.username} (${u.rol}, activo=${u.activo})`);

  console.log('\n=== Test 2: Cliente.count() ===');
  const c = await prisma.cliente.count();
  console.log(`Total clientes: ${c}`);

  console.log('\n=== Test 3: Configuracion.count() ===');
  const cfg = await prisma.configuracion.count();
  console.log(`Total configuraciones: ${cfg}`);

  console.log('\n=== Test 4: Prestamo.count() ===');
  const p = await prisma.prestamo.count();
  console.log(`Total préstamos: ${p}`);

  console.log('\n=== Test 5: SnapshotProyecto.count() ===');
  const s = await prisma.snapshotProyecto.count();
  console.log(`Total snapshots: ${s}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
