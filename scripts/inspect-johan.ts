// Inspeccionar estado actual de Johan Alvarez en BD
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const db = new PrismaClient()

async function main() {
  const cliente = await db.cliente.findFirst({
    where: { cedula: '1214731649' },
    include: {
      prestamos: {
        include: {
          pagos: true,
          firmas: true,
          otrosSi: true,
        },
      },
    },
  })

  if (!cliente) {
    console.log('❌ Cliente no encontrado')
    return
  }

  console.log('═══════════════════════════════════════')
  console.log('👤 CLIENTE:', cliente.nombre)
  console.log('   Cédula:', cliente.cedula)
  console.log('   Teléfono:', cliente.telefono)
  console.log('   Email:', cliente.email)
  console.log('   PIN:', cliente.pin ? 'SÍ' : 'NO')
  console.log('   Token sesión:', cliente.tokenSesion ? 'SÍ' : 'NO')
  console.log('═══════════════════════════════════════')
  console.log(`📊 PRÉSTAMOS: ${cliente.prestamos.length}`)
  console.log('═══════════════════════════════════════')

  for (const p of cliente.prestamos) {
    console.log(`\n• ${p.codigo} | Estado: ${p.estado}`)
    console.log(`  Monto: $${p.montoPrincipal} | Cuota: $${p.montoCuota} | ${p.numeroCuotas} cuotas | ${p.frecuencia}`)
    console.log(`  Tasa mensual: ${p.tasaInteresMensual}% | Tasa anual: ${p.tasaInteresAnual}%`)
    console.log(`  Flexibilidad financiera: ${p.flexibilidadFinanciera} | Activada: ${p.flexibilidadActivada}`)
    console.log(`  Modalidad: ${p.flexibilidadModalidad} | Costo: ${p.flexibilidadCosto} | Usos disponibles: ${p.flexibilidadUsosDisponibles} | Ejercidos: ${p.flexibilidadUsosEjercidos}`)
    console.log(`  TyC aceptado: ${p.tycAceptado ? 'SÍ' : 'NO'} | Fecha: ${p.tycFechaAceptacion}`)
    console.log(`  Pagos: ${p.pagos.length}`)
    console.log(`  Firmas: ${p.firmas.length}`)
    console.log(`  Otros Sí: ${p.otrosSi.length}`)
  }

  // Conteos totales
  const totalPagos = await db.pago.count({ where: { prestamo: { clienteId: cliente.id } } })
  const totalFirmas = await db.firmaElectronica.count({ where: { clienteId: cliente.id } })
  const totalOtrosSi = await db.otroSiCambioFecha.count({ where: { prestamo: { clienteId: cliente.id } } })
  const totalTokensFirma = await db.tokenFirma.count({ where: { clienteId: cliente.id } })

  console.log('\n═══════════════════════════════════════')
  console.log('📊 TOTALES')
  console.log('═══════════════════════════════════════')
  console.log(`Total pagos: ${totalPagos}`)
  console.log(`Total firmas electrónicas: ${totalFirmas}`)
  console.log(`Total Otros Sí: ${totalOtrosSi}`)
  console.log(`Total tokens de firma: ${totalTokensFirma}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
