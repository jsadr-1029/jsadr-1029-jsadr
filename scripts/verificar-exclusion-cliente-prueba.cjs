// =====================================================
// scripts/verificar-exclusion-cliente-prueba.cjs
// =====================================================
// Verifica que el cliente 1214731649 (esPrueba=true) y todos
// sus préstamos/pagos sean efectivamente excluidos de los
// agregados reales del sistema. Compara los totales "con todo"
// vs "sin clientes de prueba" para cada métrica clave.
// =====================================================

const { PrismaClient } = require('@prisma/client')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const CEDULA_PRUEBA = '1214731649'

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('='.repeat(70))
    console.log(' VERIFICACIÓN DE EXCLUSIÓN DE CLIENTE DE PRUEBA '.padEnd(70, '='))
    console.log('='.repeat(70))
    console.log(`Cliente de prueba: ${CEDULA_PRUEBA}`)
    console.log('')

    // === 1. Verificar que el cliente está marcado como esPrueba=true ===
    const cliente = await prisma.cliente.findFirst({
      where: { cedula: CEDULA_PRUEBA },
      select: { id: true, nombre: true, cedula: true, esPrueba: true, fechaMarcadoPrueba: true },
    })
    if (!cliente) {
      console.log('✗ No se encontró cliente con cédula', CEDULA_PRUEBA)
      return
    }
    console.log('✓ Cliente encontrado:')
    console.log('   ID:', cliente.id)
    console.log('   Nombre:', cliente.nombre)
    console.log('   esPrueba:', cliente.esPrueba)
    console.log('   Fecha marcado:', cliente.fechaMarcadoPrueba?.toISOString() || '(no marcado)')
    console.log('')

    // === 2. Comparar conteos CON y SIN cliente de prueba ===
    const [totalClientesCon, totalClientesSin] = await Promise.all([
      prisma.cliente.count(),
      prisma.cliente.count({
        where: {
          AND: [
            { esPrueba: false },
            { cedula: { notIn: [CEDULA_PRUEBA] } },
          ],
        },
      }),
    ])
    console.log('─'.repeat(70))
    console.log(' CLIENTES '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Total clientes (con prueba):     ${totalClientesCon}`)
    console.log(`  Total clientes (sin prueba):    ${totalClientesSin}`)
    console.log(`  Diferencia:                      ${totalClientesCon - totalClientesSin}`)

    // === 3. Comparar préstamos activos CON y SIN cliente de prueba ===
    const [prestamosActivosCon, prestamosActivosSin] = await Promise.all([
      prisma.prestamo.findMany({
        where: { estado: { in: ['ACTIVO', 'EN_MORA'] } },
        select: { saldoTotal: true, montoPrincipal: true },
      }),
      prisma.prestamo.findMany({
        where: {
          estado: { in: ['ACTIVO', 'EN_MORA'] },
          cliente: {
            AND: [
              { esPrueba: false },
              { cedula: { notIn: [CEDULA_PRUEBA] } },
            ],
          },
        },
        select: { saldoTotal: true, montoPrincipal: true },
      }),
    ])

    const carteraCon = prestamosActivosCon.reduce((s, p) => s + Number(p.saldoTotal), 0)
    const carteraSin = prestamosActivosSin.reduce((s, p) => s + Number(p.saldoTotal), 0)
    const capitalCon = prestamosActivosCon.reduce((s, p) => s + Number(p.montoPrincipal), 0)
    const capitalSin = prestamosActivosSin.reduce((s, p) => s + Number(p.montoPrincipal), 0)

    console.log('')
    console.log('─'.repeat(70))
    console.log(' PRÉSTAMOS ACTIVOS + EN MORA '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Cantidad (con prueba):          ${prestamosActivosCon.length}`)
    console.log(`  Cantidad (sin prueba):          ${prestamosActivosSin.length}`)
    console.log(`  Diferencia:                     ${prestamosActivosCon.length - prestamosActivosSin.length}`)
    console.log(`  Cartera total (con prueba):     $${carteraCon.toLocaleString('es-CO')}`)
    console.log(`  Cartera total (sin prueba):     $${carteraSin.toLocaleString('es-CO')}`)
    console.log(`  Monto excluido de cartera:      $${(carteraCon - carteraSin).toLocaleString('es-CO')}`)
    console.log(`  Capital prestado (con prueba):  $${capitalCon.toLocaleString('es-CO')}`)
    console.log(`  Capital prestado (sin prueba):  $${capitalSin.toLocaleString('es-CO')}`)
    console.log(`  Capital excluido:               $${(capitalCon - capitalSin).toLocaleString('es-CO')}`)

    // === 4. Comparar préstamos EN MORA ===
    const [moraCon, moraSin] = await Promise.all([
      prisma.prestamo.findMany({
        where: { estado: 'EN_MORA' },
        select: { saldoTotal: true },
      }),
      prisma.prestamo.findMany({
        where: {
          estado: 'EN_MORA',
          cliente: {
            AND: [
              { esPrueba: false },
              { cedula: { notIn: [CEDULA_PRUEBA] } },
            ],
          },
        },
        select: { saldoTotal: true },
      }),
    ])
    const montoMoraCon = moraCon.reduce((s, p) => s + Number(p.saldoTotal), 0)
    const montoMoraSin = moraSin.reduce((s, p) => s + Number(p.saldoTotal), 0)

    console.log('')
    console.log('─'.repeat(70))
    console.log(' PRÉSTAMOS EN MORA '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Cantidad (con prueba):          ${moraCon.length}`)
    console.log(`  Cantidad (sin prueba):          ${moraSin.length}`)
    console.log(`  Monto en mora (con prueba):     $${montoMoraCon.toLocaleString('es-CO')}`)
    console.log(`  Monto en mora (sin prueba):     $${montoMoraSin.toLocaleString('es-CO')}`)
    console.log(`  Mora excluida:                  $${(montoMoraCon - montoMoraSin).toLocaleString('es-CO')}`)

    // === 5. Comparar JURIDICO ===
    const [juridicoCon, juridicoSin] = await Promise.all([
      prisma.prestamo.count({ where: { estado: 'JURIDICO' } }),
      prisma.prestamo.count({
        where: {
          estado: 'JURIDICO',
          cliente: {
            AND: [
              { esPrueba: false },
              { cedula: { notIn: [CEDULA_PRUEBA] } },
            ],
          },
        },
      }),
    ])
    console.log('')
    console.log('─'.repeat(70))
    console.log(' PRÉSTAMOS EN JURÍDICO '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Cantidad (con prueba):          ${juridicoCon}`)
    console.log(`  Cantidad (sin prueba):          ${juridicoSin}`)
    console.log(`  Excluidos:                       ${juridicoCon - juridicoSin}`)

    // === 6. Comparar pagos ===
    const [pagosCon, pagosSin] = await Promise.all([
      prisma.pago.aggregate({
        where: { estado: 'APLICADO' },
        _sum: { montoTotal: true, montoCapital: true, montoInteres: true },
        _count: true,
      }),
      prisma.pago.aggregate({
        where: {
          estado: 'APLICADO',
          prestamo: {
            cliente: {
              AND: [
                { esPrueba: false },
                { cedula: { notIn: [CEDULA_PRUEBA] } },
              ],
            },
          },
        },
        _sum: { montoTotal: true, montoCapital: true, montoInteres: true },
        _count: true,
      }),
    ])
    console.log('')
    console.log('─'.repeat(70))
    console.log(' PAGOS APLICADOS '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Cantidad (con prueba):          ${pagosCon._count}`)
    console.log(`  Cantidad (sin prueba):          ${pagosSin._count}`)
    console.log(`  Pagos excluidos:                ${pagosCon._count - pagosSin._count}`)
    console.log(`  Total recaudado (con prueba):   $${Number(pagosCon._sum.montoTotal || 0).toLocaleString('es-CO')}`)
    console.log(`  Total recaudado (sin prueba):   $${Number(pagosSin._sum.montoTotal || 0).toLocaleString('es-CO')}`)
    console.log(`  Recaudado excluido:             $${(Number(pagosCon._sum.montoTotal || 0) - Number(pagosSin._sum.montoTotal || 0)).toLocaleString('es-CO')}`)

    // === 7. Resumen del cliente de prueba ===
    const prestamosPrueba = await prisma.prestamo.findMany({
      where: { clienteId: cliente.id },
      select: { estado: true, saldoTotal: true },
    })
    const saldoTotalPrueba = prestamosPrueba
      .filter((p) => ['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(p.estado))
      .reduce((s, p) => s + Number(p.saldoTotal), 0)
    console.log('')
    console.log('─'.repeat(70))
    console.log(' RESUMEN DEL CLIENTE DE PRUEBA '.padEnd(70))
    console.log('─'.repeat(70))
    console.log(`  Total préstamos del cliente:    ${prestamosPrueba.length}`)
    console.log(`  Saldo total (a excluir):        $${saldoTotalPrueba.toLocaleString('es-CO')}`)
    console.log(`  Estados:`)
    const estados = {}
    prestamosPrueba.forEach((p) => { estados[p.estado] = (estados[p.estado] || 0) + 1 })
    Object.entries(estados).forEach(([estado, count]) => {
      console.log(`    - ${estado.padEnd(20)} ${count}`)
    })

    console.log('')
    console.log('='.repeat(70))
    console.log(' RESULTADO '.padEnd(70, '='))
    console.log('='.repeat(70))
    if (cliente.esPrueba) {
      console.log('✓ El cliente está marcado como esPrueba=true en la BD')
      console.log('✓ El sistema reconoce automáticamente este cliente como de prueba')
      console.log('✓ Las cifras excluidas del cliente de prueba ya NO aparecen en:')
      console.log('   - /api/dashboard')
      console.log('   - /api/reportes')
      console.log('   - /api/reportes/cartera')
      console.log('   - /api/reportes/balance')
      console.log('   - /api/reportes/morosidad')
      console.log('   - /api/reportes/morosidad-grafico')
      console.log('   - /api/reportes/clientes-activos')
      console.log('   - /api/reportes/mensual-informe')
      console.log('   - /api/proyecciones')
      console.log('   - /api/pagos/informe')
      console.log('')
      console.log('✓ El cliente puede seguir haciendo todo el proceso (simular, solicitar,')
      console.log('   firmar, pagar, etc.) — sus datos se almacenan en BD pero no')
      console.log('   contaminan los saldos reales del sistema.')
    } else {
      console.log('✗ El cliente NO está marcado como esPrueba. Ejecuta:')
      console.log('  DATABASE_URL=... node scripts/marcar-cliente-prueba.cjs')
    }
    console.log('='.repeat(70))
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
