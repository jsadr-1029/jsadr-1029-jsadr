// Resetear estados de préstamos modificados por pruebas previas y crear
// uno nuevo con 2 usos disponibles para probar el escenario PREMIUM completo
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== RESET Y PREPARACIÓN DE PRÉSTAMOS PARA PRUEBAS ===\n')

  // 1. Eliminar pagos de flexibilidad creados en pruebas previas (referencia contiene "Uso de Flexibilidad")
  const pagosFlexibilidad = await prisma.pago.findMany({
    where: {
      metodoPago: 'FLEXIBILIDAD_FINANCIERA',
      referencia: { contains: 'Uso' },
    },
    select: { id: true, prestamoId: true, numeroCuota: true, createdAt: true },
  })
  console.log(`Pagos de flexibilidad a eliminar: ${pagosFlexibilidad.length}`)

  // 2. Eliminar Otros Síes de prueba
  const otrosSi = await prisma.otroSiCambioFecha.findMany({
    where: { descripcion: { contains: 'prueba E2E' } },
    select: { id: true, codigo: true },
  })
  console.log(`Otros Síes de prueba a eliminar: ${otrosSi.length}`)
  if (otrosSi.length > 0) {
    await prisma.otroSiCambioFecha.deleteMany({
      where: { id: { in: otrosSi.map(o => o.id) } },
    })
  }

  // 3. Resetear préstamos con flexibilidad a su estado inicial
  //    Buscar todos los préstamos de Johan con flexibilidadActivada
  const prestamosFlex = await prisma.prestamo.findMany({
    where: {
      flexibilidadFinanciera: true,
      cliente: { cedula: '1214731649' },
    },
    select: {
      id: true,
      codigo: true,
      flexibilidadModalidad: true,
      flexibilidadUsosDisponibles: true,
      flexibilidadUsosEjercidos: true,
      flexibilidadActivada: true,
    },
  })

  console.log('\n=== ESTADO ACTUAL DE PRÉSTAMOS CON FLEXIBILIDAD ===')
  for (const p of prestamosFlex) {
    console.log(`  ${p.codigo} | ${p.flexibilidadModalidad} | activada=${p.flexibilidadActivada} | disponibles=${p.flexibilidadUsosDisponibles} | ejercidos=${p.flexibilidadUsosEjercidos}`)
  }

  // 4. Resetear:
  //    - PRES-PORTAL-FLEX-BASICA-MM61JH: BASICA → 1 disponible, 0 ejercidos
  //    - PRES-MSMKE9IV-HT6O: PREMIUM → 2 disponibles, 0 ejercidos
  //    - PRES-PORTAL-FLEX-PREMIUM-1-MM63WR: PREMIUM → 1 disponible, 1 ejercido (mantener)
  //    - PRES-PORTAL-FLEX-PREMIUM-AGOTADA-MM66YW: PREMIUM → 0 disponibles, 2 ejercidos (mantener)
  const resets = [
    { codigoSuffix: 'FLEX-BASICA', disponibles: 1, ejercidos: 0 },
    { codigoSuffix: 'FLEX-PREMIUM-1', disponibles: 1, ejercidos: 1 }, // mantener
    { codigoSuffix: 'FLEX-PREMIUM-AGOTADA', disponibles: 0, ejercidos: 2 }, // mantener
    { codigoSuffix: 'FLEX-NO-ACTIVADA', disponibles: 1, ejercidos: 0 },
  ]

  // También resetear el antiguo PRES-MSMKE9IV
  const prestamoPremiumOriginal = prestamosFlex.find(p => p.codigo === 'PRES-MSMKE9IV-HT6O')
  if (prestamoPremiumOriginal) {
    await prisma.prestamo.update({
      where: { id: prestamoPremiumOriginal.id },
      data: {
        flexibilidadUsosDisponibles: 2,
        flexibilidadUsosEjercidos: 0,
      },
    })
    console.log(`\n✅ ${prestamoPremiumOriginal.codigo} reseteado: 2 disponibles, 0 ejercidos`)
  }

  // Resetear los PRES-PORTAL-*
  for (const r of resets) {
    const p = prestamosFlex.find(p => p.codigo.includes(r.codigoSuffix))
    if (p) {
      await prisma.prestamo.update({
        where: { id: p.id },
        data: {
          flexibilidadUsosDisponibles: r.disponibles,
          flexibilidadUsosEjercidos: r.ejercidos,
        },
      })
      console.log(`✅ ${p.codigo} reseteado: ${r.disponibles} disponibles, ${r.ejercidos} ejercidos`)
    }
  }

  // 5. Eliminar pagos de flexibilidad de pruebas previas
  if (pagosFlexibilidad.length > 0) {
    await prisma.pago.deleteMany({
      where: { id: { in: pagosFlexibilidad.map(p => p.id) } },
    })
    console.log(`\n✅ ${pagosFlexibilidad.length} pagos de flexibilidad eliminados`)
  }

  // 6. Verificar estado final
  console.log('\n=== ESTADO FINAL TRAS RESET ===')
  const prestamosActualizados = await prisma.prestamo.findMany({
    where: {
      flexibilidadFinanciera: true,
      cliente: { cedula: '1214731649' },
    },
    select: {
      codigo: true,
      flexibilidadModalidad: true,
      flexibilidadUsosDisponibles: true,
      flexibilidadUsosEjercidos: true,
      flexibilidadActivada: true,
    },
  })
  for (const p of prestamosActualizados) {
    console.log(`  ${p.codigo} | ${p.flexibilidadModalidad} | activada=${p.flexibilidadActivada} | disponibles=${p.flexibilidadUsosDisponibles} | ejercidos=${p.flexibilidadUsosEjercidos}`)
  }

  // 7. Resetear también el préstamo PENDIENTE_ACEPTACION que se firmó en la prueba anterior
  const prestamoFirmado = await prisma.prestamo.findFirst({
    where: { codigo: 'PRES-PORTAL-PEND-FIRMA-MM69OL' },
  })
  if (prestamoFirmado?.tycAceptado) {
    // Eliminar firma creada en prueba previa
    await prisma.firmaElectronica.deleteMany({
      where: { prestamoId: prestamoFirmado.id, tipo: 'TYC' },
    })
    await prisma.prestamo.update({
      where: { id: prestamoFirmado.id },
      data: {
        tycAceptado: false,
        tycFechaAceptacion: null,
      },
    })
    console.log(`\n✅ ${prestamoFirmado.codigo} reseteado: TyC no aceptado (listo para prueba de firma)`)
  }

  console.log('\n=== RESET COMPLETADO ===')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
