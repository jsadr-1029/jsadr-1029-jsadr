// Comprehensive cleanup — annul ALL test/E2E payments and reset the loan
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Find ALL test/E2E payments
  const all = await db.pago.findMany({
    where: {
      OR: [
        { referencia: { startsWith: 'TEST' } },
        { referencia: { startsWith: 'E2E' } },
        { motivoAnulacion: { contains: 'test' } },
        { motivoAnulacion: { contains: 'Limpieza' } },
      ],
    },
    select: { id: true, referencia: true, prestamoId: true, estado: true, numeroCuota: true, esSoloIntereses: true },
  })
  console.log('Pagos de prueba/E2E encontrados:', all.length)
  for (const p of all) {
    console.log(`  - cuota ${p.numeroCuota} estado ${p.estado} ref ${(p.referencia || '').slice(0, 30)} soloInt=${p.esSoloIntereses}`)
    if (p.estado !== 'ANULADO') {
      await db.pago.update({
        where: { id: p.id },
        data: {
          estado: 'ANULADO',
          motivoAnulacion: 'Limpieza post-test E2E',
          fechaAnulacion: new Date(),
        },
      })
      console.log(`    → Anulado`)
    }
  }

  // Get all loans that had test payments and recalculate their balances
  const prestamosAfectados = [...new Set(all.map(p => p.prestamoId))]
  console.log('\nPréstamos a recalcular:', prestamosAfectados.length)
  for (const prestamoId of prestamosAfectados) {
    const prestamo = await db.prestamo.findUnique({
      where: { id: prestamoId },
      include: { pagos: true },
    })
    if (!prestamo) continue
    const pagosValidos = prestamo.pagos.filter(p => p.estado === 'APLICADO' || p.estado === 'PAGO_PARCIAL')
    const montoPagado = pagosValidos.reduce((s, p) => s + p.montoTotal, 0)
    const montoCapitalPagado = pagosValidos.reduce((s, p) => s + p.montoCapital, 0)
    const montoInteresPagado = pagosValidos.reduce((s, p) => s + p.montoInteres, 0)
    const saldoCapital = Math.max(0, prestamo.montoPrincipal - montoCapitalPagado)
    const saldoInteres = Math.max(0, prestamo.totalInteres - montoInteresPagado)
    const saldoTotal = Math.max(0, prestamo.totalPagar - montoPagado)
    const cuotasPagadas = new Set(prestamo.pagos.filter(p => p.estado === 'APLICADO' && !p.esSoloIntereses).map(p => p.numeroCuota)).size
    const nuevoEstado = saldoTotal <= 0 ? 'CANCELADO' : (cuotasPagadas > 0 ? 'ACTIVO' : prestamo.estado === 'EN_MORA' ? 'EN_MORA' : 'ACTIVO')
    await db.prestamo.update({
      where: { id: prestamoId },
      data: {
        montoPagado, saldoCapital, saldoInteres, saldoTotal, cuotasPagadas,
        estado: nuevoEstado,
      },
    })
    console.log(`  ${prestamo.codigo}: saldo=${saldoTotal} cuotasPagadas=${cuotasPagadas} estado=${nuevoEstado}`)
  }
}
main().catch(console.error).finally(() => db.$disconnect())
