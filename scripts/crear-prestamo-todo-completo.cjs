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

// Función financiera — TASA FIJA MENSUAL (réplica de /lib/finanzas.ts)
// La tasa es MENSUAL (no anual). El interés se calcula sobre el capital inicial
// multiplicado por los meses de duración.
// Ej: 500.000 al 15% mensual × 6 meses = 500.000 + (500.000 × 0.15 × 6) = 950.000
function calcularPrestamoTasaFijaMensual({ montoPrincipal, tasaMensualFija, numeroCuotas, frecuencia, fechaDesembolso }) {
  if (numeroCuotas <= 0) throw new Error('El número de cuotas debe ser mayor a 0')
  if (montoPrincipal <= 0) throw new Error('El monto principal debe ser mayor a 0')
  if (tasaMensualFija < 0) throw new Error('La tasa mensual no puede ser negativa')

  const tasaAplicada = tasaMensualFija / 100

  // === Meses de duración según frecuencia ===
  let mesesDuracion = 1
  if (frecuencia === 'MENSUAL') {
    mesesDuracion = numeroCuotas
  } else if (frecuencia === 'QUINCENAL') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 2))
  } else if (frecuencia === 'SEMANAL') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 4))
  } else if (frecuencia === 'DIARIO') {
    mesesDuracion = Math.max(1, Math.ceil(numeroCuotas / 30))
  }

  // Interés TOTAL = capital × tasa% × meses de duración
  const interesTotalFijo = Math.round(montoPrincipal * tasaAplicada * mesesDuracion * 100) / 100

  // Total a pagar = capital + interés total
  const totalPagarCalculado = Math.round((montoPrincipal + interesTotalFijo) * 100) / 100

  // Cuota constante = total a pagar / número de cuotas
  const montoCuota = Math.round((totalPagarCalculado / numeroCuotas) * 100) / 100

  // Abono a capital constante por cuota
  const abonoCapitalCuota = Math.round((montoPrincipal / numeroCuotas) * 100) / 100

  // Interés por cuota (constante, dividido equitativamente)
  const interesPorCuota = Math.round((interesTotalFijo / numeroCuotas) * 100) / 100

  // Tabla de amortización
  const fechaInicio = new Date(fechaDesembolso || Date.now())
  const tablaAmortizacion = []
  let saldoCapital = montoPrincipal
  let acumuladoInteres = 0
  let acumuladoCapital = 0
  let totalInteres = 0

  for (let i = 1; i <= numeroCuotas; i++) {
    let capitalCuota = abonoCapitalCuota
    let interesCuota = interesPorCuota
    let cuotaEsta = montoCuota

    if (i === numeroCuotas) {
      // Ajuste final: el capital restante + interés de la última cuota
      capitalCuota = Math.round(saldoCapital * 100) / 100
      interesCuota = Math.round((totalPagarCalculado - acumuladoCapital - acumuladoInteres - capitalCuota) * 100) / 100
      if (interesCuota < 0) interesCuota = 0
      cuotaEsta = Math.round((capitalCuota + interesCuota) * 100) / 100
    }

    saldoCapital = Math.round((saldoCapital - capitalCuota) * 100) / 100
    if (saldoCapital < 0) saldoCapital = 0

    acumuladoInteres = Math.round((acumuladoInteres + interesCuota) * 100) / 100
    acumuladoCapital = Math.round((acumuladoCapital + capitalCuota) * 100) / 100
    totalInteres = Math.round((totalInteres + interesCuota) * 100) / 100

    // Fecha de vencimiento según frecuencia
    const fechaVenc = new Date(fechaInicio)
    if (frecuencia === 'MENSUAL') fechaVenc.setMonth(fechaVenc.getMonth() + i)
    else if (frecuencia === 'QUINCENAL') fechaVenc.setDate(fechaVenc.getDate() + 15 * i)
    else if (frecuencia === 'SEMANAL') fechaVenc.setDate(fechaVenc.getDate() + 7 * i)
    else fechaVenc.setDate(fechaVenc.getDate() + i)

    tablaAmortizacion.push({
      numero: i,
      fechaVencimiento: fechaVenc,
      montoCuota: cuotaEsta,
      capital: capitalCuota,
      interes: interesCuota,
      saldoCapital,
      acumuladoInteres,
      acumuladoCapital,
    })
  }

  const totalPagar = Math.round((montoPrincipal + totalInteres) * 100) / 100
  const fechaVencimiento = tablaAmortizacion[tablaAmortizacion.length - 1].fechaVencimiento

  return {
    numeroCuotas,
    montoCuota,
    totalInteres,
    totalPagar,
    tasaAplicada,
    tablaAmortizacion,
    fechaVencimiento,
    fondoGarantia: Math.round(montoPrincipal * 0.05 * 100) / 100,
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
  // ⚠️ TASA MENSUAL (no anual) — modalidad TASA_FIJA
  const MONTO = 500000
  const TASA_MENSUAL = 15          // 15% mensual (no anual)
  const TASA_ANUAL_EQUIVALENTE = TASA_MENSUAL * 12  // 180% — se guarda para coherencia
  const TASA_MORA_ANUAL = TASA_ANUAL_EQUIVALENTE    // mora = tasa anual equivalente
  const NUMERO_CUOTAS = 6
  const PLAZO_MESES = 6            // 6 cuotas mensuales = 6 meses
  const FRECUENCIA = 'MENSUAL'

  // Cálculo del préstamo (modalidad TASA_FIJA mensual)
  const calculo = calcularPrestamoTasaFijaMensual({
    montoPrincipal: MONTO,
    tasaMensualFija: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    frecuencia: FRECUENCIA,
    fechaDesembolso: new Date(),
  })

  console.log('\n📊 Cálculo del préstamo (TASA FIJA MENSUAL):')
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (= ${TASA_ANUAL_EQUIVALENTE}% anual equivalente)`)
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
      // === Tasa MENSUAL del 15% ===
      // En el schema se guarda tasaInteresAnual = 180 (15 × 12) y
      // tasaInteresMensual = 15 (la tasa real mensual). La modalidad
      // TASA_FIJA indica a la API que use la tasa mensual para el cálculo.
      tasaInteresAnual: TASA_ANUAL_EQUIVALENTE,    // 180
      tasaInteresMensual: TASA_MENSUAL,            // 15 (la real)
      tasaMoraDiaria: TASA_MORA_ANUAL / 365,       // 0.493% diario
      plazoMeses: PLAZO_MESES,
      frecuencia: FRECUENCIA,
      numeroCuotas: calculo.numeroCuotas,
      montoCuota: calculo.montoCuota,
      totalInteres: calculo.totalInteres,
      totalPagar: calculo.totalPagar,
      tasaAplicada: calculo.tasaAplicada,
      modalidadAmortizacion: 'TASA_FIJA',   // ← modalidad correcta para tasa mensual
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
      notas: `PRÉSTAMO DE PRUEBA — TODO COMPLETO (TASA MENSUAL 15%).
Modalidad: TASA_FIJA mensual.
Incluye: Fondo Garantía 5%, Flexibilidad Financiera PREMIUM, Cobro Pagaré+Carta $19.900, Tarifa Plataforma $4.900, Renovación Anticipada $9.900.
Creado por script de prueba para verificar visualización en el Portal del Cliente.`,
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
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')} (capital $${cuota.capital.toLocaleString('es-CO')} + interés $${cuota.interes.toLocaleString('es-CO')})`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRÉSTAMO "TODO COMPLETO" CREADO EXITOSAMENTE')
  console.log('='.repeat(70))
  console.log(`\n📋 RESUMEN:`)
  console.log(`  Cliente: ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`  Código: ${nuevoPrestamo.codigo}`)
  console.log(`  Modalidad: TASA_FIJA MENSUAL`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')} × ${calculo.numeroCuotas}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
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
