// Run each query separately using Prisma to find which one fails
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();

const excluirPruebaPrestamo = () => ({
  cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] },
});

const excluirPruebaCliente = () => ({
  AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }],
});

const excluirPruebaPago = () => ({
  prestamo: excluirPruebaPrestamo(),
});

const hoy = new Date(); hoy.setHours(0,0,0,0);
const finHoy = new Date(); finHoy.setHours(23,59,59,999);

console.log('=== Test individual queries ===');

try {
  const r = await db.cliente.count({ where: { ...excluirPruebaCliente() } });
  console.log('✅ cliente.count:', r);
} catch (e) { console.log('❌ cliente.count:', e.message.substring(0, 200)); }

try {
  const r = await db.prestamo.count({ where: { ...excluirPruebaPrestamo() } });
  console.log('✅ prestamo.count:', r);
} catch (e) { console.log('❌ prestamo.count:', e.message.substring(0, 200)); }

try {
  const r = await db.prestamo.findMany({ where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, ...excluirPruebaPrestamo() } });
  console.log('✅ prestamo.findMany (activos+mora):', r.length);
} catch (e) { console.log('❌ prestamo.findMany:', e.message.substring(0, 200)); }

try {
  const r = await db.pago.findMany({ where: { fechaPago: { gte: hoy, lte: finHoy }, estado: 'APLICADO', ...excluirPruebaPago() } });
  console.log('✅ pago.findMany (hoy):', r.length);
} catch (e) { console.log('❌ pago.findToday:', e.message.substring(0, 200)); }

try {
  const r = await db.prestamo.findMany({
    where: { estado: 'ACTIVO', ...excluirPruebaPrestamo() },
    include: { cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true, activo: true } }, pagos: true },
  });
  console.log('✅ prestamo.findMany (activos with cliente+pagos):', r.length);
} catch (e) { console.log('❌ prestamo.findMany activos with include:', e.message.substring(0, 200)); }

try {
  const r = await db.casoJuridico.findMany({
    where: { estado: { not: 'CERRADO' }, prestamo: excluirPruebaPrestamo() },
  });
  console.log('✅ casoJuridico.findMany:', r.length);
} catch (e) { console.log('❌ casoJuridico:', e.message.substring(0, 200)); }

try {
  const r = await db.cajaMenor.findMany({
    include: {
      movimientos: { orderBy: { fechaMovimiento: 'desc' }, take: 10 },
      _count: { select: { movimientos: true } },
    },
  });
  console.log('✅ cajaMenor.findMany:', r.length);
} catch (e) { console.log('❌ cajaMenor:', e.message.substring(0, 200)); }

try {
  const r = await db.categoriaCliente.findMany({ include: { _count: { select: { clientes: true } } } });
  console.log('✅ categoriaCliente.findMany:', r.length);
} catch (e) { console.log('❌ categoriaCliente:', e.message.substring(0, 200)); }

try {
  const r = await db.cuentaRecaudo.findMany({ include: { _count: { select: { pagos: true } } } });
  console.log('✅ cuentaRecaudo.findMany:', r.length);
} catch (e) { console.log('❌ cuentaRecaudo:', e.message.substring(0, 200)); }

try {
  const r = await db.movimientoCaja.count();
  console.log('✅ movimientoCaja.count:', r);
} catch (e) { console.log('❌ movimientoCaja.count:', e.message.substring(0, 200)); }

try {
  const r = await db.prestamo.groupBy({
    by: ['estado'],
    where: excluirPruebaPrestamo(),
    _count: true,
    _sum: { saldoTotal: true },
  });
  console.log('✅ prestamo.groupBy:', r.length, 'estados');
} catch (e) { console.log('❌ prestamo.groupBy:', e.message.substring(0, 200)); }

try {
  const r = await db.casoJuridico.findMany({
    where: { estado: { not: 'CERRADO' }, prestamo: excluirPruebaPrestamo() },
    include: { prestamo: { include: { cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true, activo: true } } } } },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log('✅ casoJuridico.findMany with include:', r.length);
} catch (e) { console.log('❌ casoJuridico with include:', e.message.substring(0, 200)); }

await db.$disconnect();
