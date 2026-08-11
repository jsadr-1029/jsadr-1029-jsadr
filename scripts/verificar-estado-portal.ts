// Verificar estado actual de Johan Alvarez y sus préstamos para pruebas del portal
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICACIÓN ESTADO PORTAL CLIENTE ===\n')

  // 1. Cliente Johan Alvarez
  const cliente = await prisma.cliente.findFirst({
    where: { cedula: '1214731649' },
    include: {
      prestamos: {
        include: {
          pagos: { take: 5, orderBy: { fechaPago: 'desc' } },
          firmas: true,
          categoria: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      cuentaRecaudo: true,
      solicitudesWeb: { take: 5, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!cliente) {
    console.log('❌ Johan Alvarez NO existe en la BD')
    return
  }

  console.log('✅ Cliente encontrado:')
  console.log(`   - ID: ${cliente.id}`)
  console.log(`   - Nombre: ${cliente.nombre}`)
  console.log(`   - Cédula: ${cliente.cedula}`)
  console.log(`   - Teléfono: ${cliente.telefono}`)
  console.log(`   - Email: ${cliente.email || '(sin email)'}`)
  console.log(`   - PIN: ${cliente.pin ? 'SÍ' : 'NO'}`)
  console.log(`   - Categoría: ${cliente.categoriaId || '(sin categoría)'}`)
  console.log(`   - Estado: ${cliente.estado}`)
  console.log(`   - ClavePortal: ${cliente.clavePortal ? 'SÍ' : 'NO'}`)
  console.log(`   - PrimerLogin: ${cliente.primerLogin}`)
  console.log('')

  // 2. Préstamos
  console.log(`=== PRÉSTAMOS (${cliente.prestamos.length}) ===`)
  for (const p of cliente.prestamos) {
    console.log(`\n  📋 ${p.codigo} - ${p.estado}`)
    console.log(`     - Monto: $${p.montoPrincipal.toLocaleString('es-CO')}`)
    console.log(`     - Saldo: $${p.saldoTotal.toLocaleString('es-CO')}`)
    console.log(`     - Cuota: $${p.montoCuota.toLocaleString('es-CO')} / ${p.numeroCuotas} cuotas`)
    console.log(`     - Pagadas: ${p.cuotasPagadas}`)
    console.log(`     - Frecuencia: ${p.frecuencia}`)
    console.log(`     - Tasa: ${p.tasaInteresMensual}% mensual`)
    console.log(`     - TyC Aceptado: ${p.tycAceptado ? 'SÍ' : 'NO'}`)
    console.log(`     - Flexibilidad Activada: ${p.flexibilidadActivada ? 'SÍ' : 'NO'}`)
    console.log(`     - Flexibilidad Modalidad: ${p.flexibilidadModalidad || 'N/A'}`)
    console.log(`     - Flexibilidad Usos Disponibles: ${p.flexibilidadUsosDisponibles ?? 0}`)
    console.log(`     - Flexibilidad Usos Ejercidos: ${p.flexibilidadUsosEjercidos ?? 0}`)
    console.log(`     - Pagos: ${p.pagos.length} (mostrando últimos 5)`)
    console.log(`     - Firmas: ${p.firmas.length}`)
    console.log(`     - Categoria: ${p.categoria?.nombre || 'N/A'}`)
  }

  // 3. Cuenta de pago
  console.log('\n=== CUENTA DE PAGO ===')
  if (cliente.cuentaPago) {
    console.log(`   ✅ Cuenta asignada: ${cliente.cuentaPago.banco} - ${cliente.cuentaPago.numeroCuenta}`)
    console.log(`   - Tipo: ${cliente.cuentaPago.tipoCuenta}`)
    console.log(`   - QR: ${cliente.cuentaPago.qrImagen ? 'SÍ' : 'NO'}`)
  } else {
    console.log('   ❌ Sin cuenta de pago asignada')
  }

  // 4. Solicitudes web
  console.log(`\n=== SOLICITUDES WEB (${cliente.solicitudesWeb.length}) ===`)
  for (const s of cliente.solicitudesWeb) {
    console.log(`  - ${s.codigo || s.id} | estado=${s.estado} | monto=$${s.montoSolicitado?.toLocaleString('es-CO') || 0}`)
    console.log(`    flexibilidadFinanciera=${s.flexibilidadFinanciera ?? false} | modalidad=${s.flexibilidadModalidad || 'N/A'}`)
  }

  // 5. Conteos totales
  const totalPagos = await prisma.pago.count({ where: { prestamo: { clienteId: cliente.id } } })
  const totalFirmas = await prisma.firmaElectronica.count({ where: { prestamo: { clienteId: cliente.id } } })
  const totalCasosJuridicos = await prisma.casoJuridico.count({ where: { prestamo: { clienteId: cliente.id } } })

  console.log('\n=== RESUMEN ===')
  console.log(`  Total pagos: ${totalPagos}`)
  console.log(`  Total firmas: ${totalFirmas}`)
  console.log(`  Total casos jurídicos: ${totalCasosJuridicos}`)
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
