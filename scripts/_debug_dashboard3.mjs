// Debug: test the Promise.all + the loop
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const { calcularPrestamo, calcularDiasMora, getTasaMoraDiaria } = await import('../src/lib/finanzas.ts');

const excluirPruebaPrestamo = () => ({
  cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] },
});
const excluirPruebaPago = () => ({ prestamo: excluirPruebaPrestamo() });
const hoy = new Date(); hoy.setHours(0,0,0,0);
const finHoy = new Date(); finHoy.setHours(23,59,59,999);

// Run the exact same Promise.all as the dashboard
console.log('=== Running Promise.all ===');
const [
  totalClientes,
  totalPrestamos,
  todosPrestamos,
  prestamosMora,
  prestamosJuridico,
  pagosHoy,
  prestamosActivos,
  casosJuridicos,
  cajas,
  categorias,
  cuentas,
  totalMovimientos,
] = await Promise.all([
  db.cliente.count({ where: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } }),
  db.prestamo.count({ where: { cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } }),
  db.prestamo.findMany({ where: { estado: { in: ['ACTIVO', 'EN_MORA'] }, cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } }),
  db.prestamo.findMany({ where: { estado: 'EN_MORA', cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } }),
  db.prestamo.count({ where: { estado: 'JURIDICO', cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } }),
  db.pago.findMany({ where: { fechaPago: { gte: hoy, lte: finHoy }, estado: 'APLICADO', prestamo: { cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } } }),
  db.prestamo.findMany({
    where: { estado: 'ACTIVO', cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } },
    include: { cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true, activo: true } }, pagos: true },
  }),
  db.casoJuridico.findMany({ where: { estado: { not: 'CERRADO' }, prestamo: { cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } } }),
  db.cajaMenor.findMany({ include: { movimientos: { orderBy: { fechaMovimiento: 'desc' }, take: 10 }, _count: { select: { movimientos: true } } } }),
  db.categoriaCliente.findMany({ include: { _count: { select: { clientes: true } } } }),
  db.cuentaRecaudo.findMany({ include: { _count: { select: { pagos: true } } } }),
  db.movimientoCaja.count(),
]);
console.log('✅ Promise.all completed');
console.log('prestamosMora count:', prestamosMora.length);

// Now test the loop that calls calcularDiasMoraPrestamo
console.log('\n=== Testing calcularDiasMoraPrestamo loop ===');
for (const p of prestamosMora) {
  try {
    const prestamo = await db.prestamo.findUnique({
      where: { id: p.id },
      include: { pagos: true },
    });
    if (!prestamo) continue;
    
    const calculo = calcularPrestamo({
      montoPrincipal: prestamo.montoPrincipal,
      tasaInteresAnual: prestamo.tasaInteresAnual,
      tasaMoraAnual: getTasaMoraDiaria(prestamo),
      plazoMeses: prestamo.plazoMeses,
      frecuencia: prestamo.frecuencia as any,
      fechaDesembolso: prestamo.fechaDesembolso || undefined,
    });
    
    let maxDiasMora = 0;
    for (const cuota of calculo.tablaAmortizacion) {
      const pagada = prestamo.pagos.some((pg) => pg.numeroCuota === cuota.numero && pg.estado === 'APLICADO');
      if (!pagada) {
        const dias = calcularDiasMora(cuota.fechaVencimiento);
        if (dias > maxDiasMora) maxDiasMora = dias;
      }
    }
    console.log(`✅ ${p.codigo}: ${maxDiasMora} días mora`);
  } catch (e) {
    console.log(`❌ ${p.codigo}: ${e.message.substring(0, 200)}`);
  }
}

// Test groupBy
console.log('\n=== Testing groupBy ===');
try {
  const r = await db.prestamo.groupBy({
    by: ['estado'],
    where: { cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } },
    _count: true,
    _sum: { saldoTotal: true },
  });
  console.log('✅ groupBy:', JSON.stringify(r));
} catch (e) {
  console.log('❌ groupBy:', e.message.substring(0, 300));
}

// Test casoJuridico with include
console.log('\n=== Testing casoJuridico with include ===');
try {
  const r = await db.casoJuridico.findMany({
    where: { estado: { not: 'CERRADO' }, prestamo: { cliente: { AND: [{ esPrueba: false }, { cedula: { notIn: ['1214731649'] } }] } } },
    include: { prestamo: { include: { cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, email: true, activo: true } } } } },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log('✅ casoJuridico:', r.length);
} catch (e) {
  console.log('❌ casoJuridico:', e.message.substring(0, 300));
}

await db.$disconnect();
