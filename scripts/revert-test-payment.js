// Reverse the test payment applied during diagnostic
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Find the test payment (referencia starts with TEST2-)
  const testPagos = await db.pago.findMany({
    where: { referencia: { startsWith: 'TEST2-' } },
    select: { id: true, referencia: true, prestamoId: true, montoTotal: true, numeroCuota: true, estado: true },
  })
  console.log('Pagos de prueba encontrados:', testPagos.length)
  for (const p of testPagos) {
    console.log(`  - ${p.id} cuota ${p.numeroCuota} monto ${p.montoTotal} estado ${p.estado}`)
    // Anular (soft-delete)
    await db.pago.update({
      where: { id: p.id },
      data: {
        estado: 'ANULADO',
        motivoAnulacion: 'Anulación de pago de prueba (diagnóstico)',
        fechaAnulacion: new Date(),
      },
    })
    console.log(`    → Anulado`)
  }
  // Recalcular saldos del préstamo afectado
  if (testPagos.length > 0) {
    const prestamoId = testPagos[0].prestamoId
    const prestamo = await db.prestamo.findUnique({ where: { id: prestamoId }, include: { pagos: true } })
    if (prestamo) {
      const pagosValidos = prestamo.pagos.filter(p => p.estado === 'APLICADO' || p.estado === 'PAGO_PARCIAL')
      const montoPagado = pagosValidos.reduce((s, p) => s + p.montoTotal, 0)
      const montoCapitalPagado = pagosValidos.reduce((s, p) => s + p.montoCapital, 0)
      const montoInteresPagado = pagosValidos.reduce((s, p) => s + p.montoInteres, 0)
      const saldoCapital = Math.max(0, prestamo.montoPrincipal - montoCapitalPagado)
      const saldoInteres = Math.max(0, prestamo.totalInteres - montoInteresPagado)
      const saldoTotal = Math.max(0, prestamo.totalPagar - montoPagado)
      const cuotasPagadas = new Set(prestamo.pagos.filter(p => p.estado === 'APLICADO' && !p.esSoloIntereses).map(p => p.numeroCuota)).size
      await db.prestamo.update({
        where: { id: prestamoId },
        data: {
          montoPagado, saldoCapital, saldoInteres, saldoTotal, cuotasPagadas,
          estado: saldoTotal > 0 ? 'ACTIVO' : 'CANCELADO',
        },
      })
      console.log(`Préstamo ${prestamo.codigo} actualizado: saldo=${saldoTotal} cuotasPagadas=${cuotasPagadas}`)
    }
  }
}
main().catch(console.error).finally(() => db.$disconnect())
