// =====================================================
// 📦 CREAR PRÉSTAMO "TODO COMPLETO" — Script de prueba
// =====================================================
// Crea un préstamo de prueba con TODAS las opciones activadas:
//   - Fondo de Garantía al 5%
//   - Flexibilidad Financiera (PREMIUM $34.900)
//   - Cobro de Pagaré + Carta ($19.900)
//   - Renovación Anticipada ($9.900)
//   - Tarifa de Uso de Plataforma ($4.900)
//   - 6 cuotas mensuales
//   - Capital: $500.000 COP
//   - Tasa: 15% anual
//
// Uso: node scripts/crear-prestamo-todo-completo.cjs
// =====================================================

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

// Funciones financieras (réplica de /lib/finanzas.ts calcularPrestamo)
const PERIODOS_POR_ANIO = {
  MENSUAL: 12,
  QUINCENAL: 24,
  SEMANAL: 52,
  DIARIO: 360,
}

function calcularPrestamo({ montoPrincipal, tasaInteresAnual, plazoMeses, frecuencia, fechaDesembolso }) {
  const periodosAnio = PERIODOS_POR_ANIO[frecuencia]
  const tasaAplicada = tasaInteresAnual / 100 / periodosAnio

  let numeroCuotas
  switch (frecuencia) {
    case 'MENSUAL': numeroCuotas = plazoMeses; break
    case 'QUINCENAL': numeroCuotas = plazoMeses * 2; break
    case 'SEMANAL': numeroCuotas = Math.round(plazoMeses * 4.345); break
    case 'DIARIO': numeroCuotas = plazoMeses * 30; break
    default: numeroCuotas = plazoMeses
  }

  // Cuota fija sobre capital inicial (sistema francés simplificado):
  // M = P * r * (1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + tasaAplicada, numeroCuotas)
  const montoCuota = Math.round((montoPrincipal * tasaAplicada * factor) / (factor - 1))

  // Tabla de amortización (sistema francés)
  const tabla = []
  let saldoCapital = montoPrincipal
  let acumuladoInteres = 0
  let acumuladoCapital = 0
  const fechaBase = new Date(fechaDesembolso || Date.now())

  for (let i = 1; i <= numeroCuotas; i++) {
    const interes = Math.round(montoPrincipal * tasaAplicada)
    const capital = montoCuota - interes
    saldoCapital -= capital
    acumuladoInteres += interes
    acumuladoCapital += capital

    // Fecha de vencimiento
    const fechaVenc = new Date(fechaBase)
    fechaVenc.setMonth(fechaVenc.getMonth() + i)

    tabla.push({
      numero: i,
      fechaVencimiento: fechaVenc,
      montoCuota,
      capital,
      interes,
      saldoCapital: Math.max(0, saldoCapital),
      acumuladoInteres,
      acumuladoCapital,
    })
  }

  const totalInteres = acumuladoInteres
  const totalPagar = montoPrincipal + totalInteres
  const fechaVencimiento = tabla[tabla.length - 1].fechaVencimiento

  return {
    numeroCuotas,
    montoCuota,
    totalInteres,
    totalPagar,
    tasaAplicada,
    tablaAmortizacion: tabla,
    fechaVencimiento,
    fondoGarantia: montoPrincipal * 0.05,
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('📦 CREAR PRÉSTAMO "TODO COMPLETO"')
  console.log('='.repeat(70))

  // === Buscar cliente por cédula (argumento CLI) o listar los disponibles ===
  // Uso: node scripts/crear-prestamo-todo-completo.cjs [cedula]
  const cedulaParam = process.argv[2]

  let cliente
  if (cedulaParam) {
    cliente = await prisma.cliente.findFirst({
      where: { cedula: cedulaParam },
      select: { id: true, nombre: true, cedula: true, telefono: true },
    })
    if (!cliente) {
      console.error(`❌ No se encontró cliente con cédula ${cedulaParam}`)
      console.log('\nClientes disponibles en la base de datos:')
      const todos = await prisma.cliente.findMany({
        select: { nombre: true, cedula: true, telefono: true },
        orderBy: { nombre: 'asc' },
      })
      todos.forEach((c, i) => console.log(`  ${i + 1}. ${c.nombre} — CC ${c.cedula} — Tel ${c.telefono}`))
      process.exit(1)
    }
  } else {
    // Sin parámetro: usar el cliente más reciente (comportamiento original)
    const clientes = await prisma.cliente.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, cedula: true, telefono: true },
    })

    if (!clientes.length) {
      console.error('❌ No hay clientes en la base de datos. Crea un cliente primero.')
      process.exit(1)
    }

    console.log('\n👥 Clientes disponibles (primeros 5):')
    clientes.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.nombre} — CC ${c.cedula} — Tel ${c.telefono} — ID ${c.id}`)
    })

    cliente = clientes[0]
  }

  console.log(`\n✅ Usando cliente: ${cliente.nombre} (CC ${cliente.cedula})`)

  // === Parámetros del préstamo ===
  const MONTO = 500000
  const TASA_ANUAL = 15
  const TASA_MORA_ANUAL = 36 // estándar
  const PLAZO_MESES = 6
  const FRECUENCIA = 'MENSUAL'

  // Cálculo del préstamo
  const calculo = calcularPrestamo({
    montoPrincipal: MONTO,
    tasaInteresAnual: TASA_ANUAL,
    plazoMeses: PLAZO_MESES,
    frecuencia: FRECUENCIA,
    fechaDesembolso: new Date(),
  })

  console.log('\n📊 Cálculo del préstamo:')
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa anual: ${TASA_ANUAL}%`)
  console.log(`  Plazo: ${PLAZO_MESES} meses (${calculo.numeroCuotas} cuotas ${FRECUENCIA.toLowerCase()})`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Vence: ${calculo.fechaVencimiento.toISOString().slice(0, 10)}`)

  // === Generar código único ===
  const fecha = new Date()
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  const codigo = `TODO-COMPLETO-${yyyy}${mm}${dd}-${random}`

  // === Verificar que no exista ya un préstamo con ese código ===
  const existente = await prisma.prestamo.findFirst({
    where: {
      OR: [
        { codigo: { startsWith: 'TODO-COMPLETO-' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existente) {
    console.log(`\nℹ️  Ya existe un préstamo 'TODO COMPLETO' previo: ${existente.codigo} (estado: ${existente.estado})`)
    console.log('   Se creará uno nuevo con código diferente.')
  }

  // === Cargos opcionales (TODOS activados) ===
  const FONDO_GARANTIA_TASA = 0.05  // 5%
  const fondoGarantiaMonto = Math.round(MONTO * FONDO_GARANTIA_TASA * 100) / 100

  const FLEXIBILIDAD_MODALIDAD = 'PREMIUM'
  const FLEXIBILIDAD_COSTO = 34900

  const COBRO_PAGARE_CARTA = true
  const VALOR_PAGARE_CARTA = 19900

  const COBRO_TARIFA_PLATAFORMA = true
  const VALOR_TARIFA_PLATAFORMA = 4900

  const RENOVACION_ANTICIPADA = true
  const RENOVACION_ANTICIPADA_COSTO = 9900

  console.log('\n💰 Cargos activados:')
  console.log(`  ✓ Fondo de Garantía (5%): $${fondoGarantiaMonto.toLocaleString('es-CO')}`)
  console.log(`  ✓ Flexibilidad Financiera PREMIUM: $${FLEXIBILIDAD_COSTO.toLocaleString('es-CO')}`)
  console.log(`  ✓ Cobro Pagaré + Carta: $${VALOR_PAGARE_CARTA.toLocaleString('es-CO')}`)
  console.log(`  ✓ Tarifa Uso Plataforma: $${VALOR_TARIFA_PLATAFORMA.toLocaleString('es-CO')}`)
  console.log(`  ✓ Renovación Anticipada: $${RENOVACION_ANTICIPADA_COSTO.toLocaleString('es-CO')}`)
  const totalCargos = fondoGarantiaMonto + FLEXIBILIDAD_COSTO + VALOR_PAGARE_CARTA + VALOR_TARIFA_PLATAFORMA + RENOVACION_ANTICIPADA_COSTO
  console.log(`  📊 TOTAL cargos iniciales: $${totalCargos.toLocaleString('es-CO')}`)

  // === Crear el préstamo ===
  const nuevoPrestamo = await prisma.prestamo.create({
    data: {
      codigo,
      clienteId: cliente.id,
      montoPrincipal: MONTO,
      tasaInteresAnual: TASA_ANUAL,
      tasaInteresMensual: TASA_ANUAL / 12,
      tasaMoraDiaria: TASA_MORA_ANUAL / 365,  // 0.0986% diario
      plazoMeses: PLAZO_MESES,
      frecuencia: FRECUENCIA,
      numeroCuotas: calculo.numeroCuotas,
      montoCuota: calculo.montoCuota,
      totalInteres: calculo.totalInteres,
      totalPagar: calculo.totalPagar,
      tasaAplicada: calculo.tasaAplicada,
      modalidadAmortizacion: 'FRANCES',
      moraCompuestaDiaria: true,
      // === Estado: ACTIVO para que sea visible en el portal del cliente ===
      // (PENDIENTE_ACEPTACION requeriría que el cliente firme TyC; ACTIVO lo muestra directamente)
      estado: 'ACTIVO',
      fechaSolicitud: fecha,
      fechaDesembolso: fecha,
      fechaAprobacion: fecha,
      fechaVencimiento: calculo.fechaVencimiento,
      tycEnviado: true,
      tycAceptado: true,
      tycFechaAceptacion: fecha,
      requiereDocumentos: true,
      generarPagare: true,
      generarCarta: true,
      // Saldo
      saldoCapital: MONTO,
      saldoInteres: calculo.totalInteres,
      saldoTotal: calculo.totalPagar,
      cuotasPagadas: 0,
      montoPagado: 0,
      // === Fondo de Garantía al 5% ===
      fondoGarantiaCargado: false,  // false = se cobra al cliente en la primera cuota
      fondoGarantiaMonto,
      fondoGarantiaTasa: FONDO_GARANTIA_TASA,
      // === Flexibilidad Financiera PREMIUM ===
      flexibilidadFinanciera: true,
      flexibilidadCosto: FLEXIBILIDAD_COSTO,
      flexibilidadModalidad: FLEXIBILIDAD_MODALIDAD,
      flexibilidadUsosDisponibles: 2,  // PREMIUM = 2 usos
      flexibilidadUsosEjercidos: 0,
      flexibilidadActivada: true,
      flexibilidadFechaActivacion: fecha,
      flexibilidadCobroAplicado: false,
      // === Cobro Pagaré + Carta ===
      cobroPagareCarta: COBRO_PAGARE_CARTA,
      valorPagareCarta: VALOR_PAGARE_CARTA,
      // === Tarifa Uso Plataforma ===
      cobroTarifaPlataforma: COBRO_TARIFA_PLATAFORMA,
      valorTarifaPlataforma: VALOR_TARIFA_PLATAFORMA,
      tarifaPlataformaCargada: false,
      // === Renovación Anticipada ===
      renovacionAnticipada: RENOVACION_ANTICIPADA,
      renovacionAnticipadaCosto: RENOVACION_ANTICIPADA_COSTO,
      // Notas
      notas: 'PRÉSTAMO DE PRUEBA — TODO COMPLETO.\nIncluye: Fondo Garantía 5%, Flexibilidad Financiera PREMIUM, Cobro Pagaré+Carta $19.900, Tarifa Plataforma $4.900, Renovación Anticipada $9.900.\nCreado por script de prueba para verificar visualización en el Portal del Cliente.',
    },
  })

  console.log(`\n✅ Préstamo creado: ${nuevoPrestamo.codigo}`)
  console.log(`   ID: ${nuevoPrestamo.id}`)
  console.log(`   Estado: ${nuevoPrestamo.estado}`)

  // === Crear pagos programados ===
  console.log('\n📅 Creando pagos programados...')
  for (const cuota of calculo.tablaAmortizacion) {
    await prisma.pagoProgramado.create({
      data: {
        prestamoId: nuevoPrestamo.id,
        numeroCuota: cuota.numero,
        fechaVencimiento: cuota.fechaVencimiento,
        montoCuota: cuota.montoCuota,
        montoCapital: cuota.capital,
        montoInteres: cuota.interes,
        saldoCapitalDespues: cuota.saldoCapital,
        estado: 'PROGRAMADO',
      },
    })
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')}`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRÉSTAMO "TODO COMPLETO" CREADO EXITOSAMENTE')
  console.log('='.repeat(70))
  console.log(`\n📋 RESUMEN:`)
  console.log(`  Cliente: ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`  Código: ${nuevoPrestamo.codigo}`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')} × ${calculo.numeroCuotas}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Cargos iniciales: $${totalCargos.toLocaleString('es-CO')}`)
  console.log(`  Estado: ${nuevoPrestamo.estado}`)
  console.log(`\n💡 El préstamo está visible en el Portal del Cliente en:`)
  console.log(`   - Sección "Créditos" (porque estado = ACTIVO)`)
  console.log(`   - Sección "Próximos" (cuotas programadas)`)
  console.log(`   - Sección "Historial"`)
  console.log(`   - "Pasaporte de Confianza" (trayectoria del cliente)`)
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
