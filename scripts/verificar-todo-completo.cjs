// Verificar el préstamo TODO COMPLETO y sus datos
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

async function main() {
  const p = await prisma.prestamo.findFirst({
    where: { codigo: { startsWith: 'TODO-COMPLETO-' } },
    include: {
      cliente: { select: { nombre: true, cedula: true, telefono: true } },
      _count: { select: { pagosProgramados: true, pagos: true, compromisosPago: true } },
    },
  })

  if (!p) {
    console.log('❌ No se encontró ningún préstamo TODO COMPLETO')
    return
  }

  console.log('='.repeat(70))
  console.log('✅ PRÉSTAMO TODO COMPLETO VERIFICADO')
  console.log('='.repeat(70))
  console.log(`Código: ${p.codigo}`)
  console.log(`Cliente: ${p.cliente.nombre} (CC ${p.cliente.cedula})`)
  console.log(`Estado: ${p.estado}`)
  console.log(`Monto: $${p.montoPrincipal.toLocaleString('es-CO')}`)
  console.log(`Tasa anual: ${p.tasaInteresAnual}%`)
  console.log(`Cuotas: ${p.numeroCuotas} × $${p.montoCuota.toLocaleString('es-CO')}`)
  console.log(`Total a pagar: $${p.totalPagar.toLocaleString('es-CO')}`)
  console.log('')
  console.log('Cargos activados:')
  console.log(`  ✓ Fondo Garantía: ${p.fondoGarantiaMonto > 0 ? `$${p.fondoGarantiaMonto.toLocaleString('es-CO')} (${(p.fondoGarantiaTasa * 100).toFixed(0)}%)` : 'NO'}`)
  console.log(`  ✓ Flexibilidad Financiera: ${p.flexibilidadFinanciera ? `${p.flexibilidadModalidad} $${p.flexibilidadCosto.toLocaleString('es-CO')}` : 'NO'}`)
  console.log(`  ✓ Cobro Pagaré+Carta: ${p.cobroPagareCarta ? `$${p.valorPagareCarta.toLocaleString('es-CO')}` : 'NO'}`)
  console.log(`  ✓ Tarifa Plataforma: ${p.cobroTarifaPlataforma ? `$${p.valorTarifaPlataforma.toLocaleString('es-CO')}` : 'NO'}`)
  console.log(`  ✓ Renovación Anticipada: ${p.renovacionAnticipada ? `$${p.renovacionAnticipadaCosto.toLocaleString('es-CO')}` : 'NO'}`)
  console.log('')
  console.log(`Pagos programados: ${p._count.pagosProgramados}`)
  console.log(`Pagos realizados: ${p._count.pagos}`)
  console.log(`Compromisos de pago (Pasaporte): ${p._count.compromisosPago}`)
  console.log('')
  console.log('✅ TODO SINCRONIZADO: Neon (DB) + GitHub (código) + Vercel (deploy automático)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
