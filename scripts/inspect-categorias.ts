// Listar categorías de cliente disponibles
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const db = new PrismaClient()

async function main() {
  const categorias = await db.categoriaCliente.findMany({
    take: 10,
    orderBy: { createdAt: 'asc' },
  })

  console.log('═══════════════════════════════════════')
  console.log(`📋 CATEGORÍAS DE CLIENTE (${categorias.length})`)
  console.log('═══════════════════════════════════════')
  for (const c of categorias) {
    console.log(`\n• ${c.nombre} (id: ${c.id})`)
    console.log(`  Código: ${c.codigo}`)
    console.log(`  Tasa anual: ${c.tasaInteresAnual}% | Tasa mensual: ${c.tasaInteresMensual}%`)
    console.log(`  Monto min: $${c.montoMinimo} | Monto max: $${c.montoMaximo}`)
    console.log(`  Plazos: ${c.plazoMinimoMeses}-${c.plazoMaximoMeses} meses`)
    console.log(`  Fondo garantía: ${c.fondoGarantiaPorcentaje}%`)
  }

  // También listar los préstamos activos de Johan con flexibilidad para ver el que ya tiene
  const prestamosFlex = await db.prestamo.findMany({
    where: {
      cliente: { cedula: '1214731649' },
      flexibilidadFinanciera: true,
    },
    select: {
      id: true,
      codigo: true,
      estado: true,
      flexibilidadFinanciera: true,
      flexibilidadActivada: true,
      flexibilidadModalidad: true,
      flexibilidadUsosDisponibles: true,
      flexibilidadUsosEjercidos: true,
      montoCuota: true,
      numeroCuotas: true,
      frecuencia: true,
    },
  })

  console.log('\n═══════════════════════════════════════')
  console.log(`📊 PRÉSTAMOS DE JOHAN CON FLEXIBILIDAD (${prestamosFlex.length})`)
  console.log('═══════════════════════════════════════')
  for (const p of prestamosFlex) {
    console.log(`\n• ${p.codigo} (id: ${p.id})`)
    console.log(`  Estado: ${p.estado}`)
    console.log(`  Modalidad: ${p.flexibilidadModalidad} | Activada: ${p.flexibilidadActivada}`)
    console.log(`  Usos disponibles: ${p.flexibilidadUsosDisponibles} | Ejercidos: ${p.flexibilidadUsosEjercidos}`)
    console.log(`  Cuota: $${p.montoCuota} | ${p.numeroCuotas} cuotas | ${p.frecuencia}`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
