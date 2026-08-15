// =====================================================
// 📦 CREAR PRÉSTAMO "TODO COMPLETO" — VERSIÓN EN MORA
// =====================================================
// Crea el préstamo "TODO COMPLETO" para un cliente con la primera cuota
// vencida hace 7 días. Simula el estado real que tendría un préstamo
// cuando el cliente entra en mora.
//
// Estados simulados:
//   - Préstamo: EN_MORA
//   - Cuota 1: VENCIDA (diasMora=7, moraCalculada=mora compuesta)
//   - Cuotas 2-6: PROGRAMADAS (pendientes)
//   - diasMora del préstamo: 7
//   - montoMora del préstamo: mora compuesta sobre capital inicial
//
// Uso: node scripts/crear-prestamo-todo-completo-mora.cjs [cedula]
// =====================================================

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

// === Función financiera TASA FIJA MENSUAL (réplica de /lib/finanzas.ts) ===
function calcularPrestamoTasaFijaMensual({ montoPrincipal, tasaMensualFija, numeroCuotas, frecuencia, fechaDesembolso }) {
  if (numeroCuotas <= 0) throw new Error('El número de cuotas debe ser mayor a 0')
  if (montoPrincipal <= 0) throw new Error('El monto principal debe ser mayor a 0')
  if (tasaMensualFija < 0) throw new Error('La tasa mensual no puede ser negativa')

  const tasaAplicada = tasaMensualFija / 100

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

  const interesTotalFijo = Math.round(montoPrincipal * tasaAplicada * mesesDuracion * 100) / 100
  const totalPagarCalculado = Math.round((montoPrincipal + interesTotalFijo) * 100) / 100
  const montoCuota = Math.round((totalPagarCalculado / numeroCuotas) * 100) / 100
  const abonoCapitalCuota = Math.round((montoPrincipal / numeroCuotas) * 100) / 100
  const interesPorCuota = Math.round((interesTotalFijo / numeroCuotas) * 100) / 100

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

// === Función mora compuesta diaria (réplica de /lib/finanzas.ts) ===
// M = S * [(1 + r)^d - 1]  donde r = tasaMoraDiaria/100
function calcularMoraCompuesta(saldoPendiente, tasaMoraDiaria, diasMora) {
  if (diasMora <= 0 || saldoPendiente <= 0) return 0
  const tasaDiariaDecimal = tasaMoraDiaria / 100
  const mora = saldoPendiente * (Math.pow(1 + tasaDiariaDecimal, diasMora) - 1)
  return Math.round(mora * 100) / 100
}

async function main() {
  console.log('='.repeat(70))
  console.log('📦 CREAR PRÉSTAMO "TODO COMPLETO" — VERSIÓN EN MORA (7 días)')
  console.log('='.repeat(70))

  // === Buscar cliente por cédula ===
  const cedulaParam = process.argv[2]
  if (!cedulaParam) {
    console.error('❌ Debes especificar la cédula del cliente')
    console.log('Uso: node scripts/crear-prestamo-todo-completo-mora.cjs <cedula>')
    process.exit(1)
  }

  const cliente = await prisma.cliente.findFirst({
    where: { cedula: cedulaParam },
    select: { id: true, nombre: true, cedula: true, telefono: true },
  })

  if (!cliente) {
    console.error(`❌ No se encontró cliente con cédula ${cedulaParam}`)
    process.exit(1)
  }

  console.log(`\n✅ Usando cliente: ${cliente.nombre} (CC ${cliente.cedula})`)

  // === Limpiar préstamos TODO COMPLETO previos del cliente ===
  const previos = await prisma.prestamo.findMany({
    where: { codigo: { startsWith: 'TODO-COMPLETO-' }, clienteId: cliente.id },
    select: { id: true, codigo: true },
  })
  if (previos.length) {
    console.log(`\n🧹 Eliminando ${previos.length} préstamo(s) TODO COMPLETO previo(s) del cliente...`)
    for (const p of previos) {
      await prisma.pagoProgramado.deleteMany({ where: { prestamoId: p.id } })
      await prisma.prestamo.delete({ where: { id: p.id } })
      console.log(`   ✗ ${p.codigo}`)
    }
  }

  // === Parámetros del préstamo ===
  const MONTO = 500000
  const TASA_MENSUAL = 15
  const TASA_ANUAL_EQUIVALENTE = TASA_MENSUAL * 12  // 180
  const TASA_MORA_ANUAL = TASA_ANUAL_EQUIVALENTE
  const TASA_MORA_DIARIA = TASA_MORA_ANUAL / 365  // 0.4931% diario
  const NUMERO_CUOTAS = 6
  const PLAZO_MESES = 6
  const FRECUENCIA = 'MENSUAL'
  const DIAS_MORA = 7  // ← Simular 7 días de atraso en la primera cuota

  // === Calcular fecha de desembolso para que la 1ra cuota venza hace 7 días ===
  // Si la 1ra cuota vence 1 mes después del desembolso, y queremos que venza
  // hace DIAS_MORA días, entonces el desembolso fue hace (1 mes + DIAS_MORA) días.
  const hoy = new Date()
  const fechaVencimientoCuota1 = new Date(hoy)
  fechaVencimientoCuota1.setDate(fechaVencimientoCuota1.getDate() - DIAS_MORA)
  // Ajustar a mediodía UTC para evitar cambios de día por zona horaria
  fechaVencimientoCuota1.setUTCHours(12, 0, 0, 0)

  const fechaDesembolso = new Date(fechaVencimientoCuota1)
  fechaDesembolso.setMonth(fechaDesembolso.getMonth() - 1)

  console.log(`\n📅 Simulación temporal:`)
  console.log(`  Hoy: ${hoy.toISOString().slice(0, 10)}`)
  console.log(`  Fecha desembolso: ${fechaDesembolso.toISOString().slice(0, 10)}`)
  console.log(`  Vencimiento cuota 1: ${fechaVencimientoCuota1.toISOString().slice(0, 10)} (hace ${DIAS_MORA} días)`)

  // === Cálculo del préstamo ===
  const calculo = calcularPrestamoTasaFijaMensual({
    montoPrincipal: MONTO,
    tasaMensualFija: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    frecuencia: FRECUENCIA,
    fechaDesembolso,
  })

  // === Mora compuesta sobre capital inicial ===
  // Política: % diario sobre capital inicial (ver /api/notificaciones/route.ts línea 99)
  const moraGenerada = calcularMoraCompuesta(MONTO, TASA_MORA_DIARIA, DIAS_MORA)
  const totalAdeudadoCuota1 = calculo.tablaAmortizacion[0].montoCuota + moraGenerada

  console.log(`\n📊 Cálculo del préstamo (TASA FIJA MENSUAL):`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Tasa mora diaria: ${TASA_MORA_DIARIA.toFixed(4)}%`)
  console.log(`  Plazo: ${PLAZO_MESES} meses (${calculo.numeroCuotas} cuotas ${FRECUENCIA.toLowerCase()})`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Vence: ${calculo.fechaVencimiento.toISOString().slice(0, 10)}`)

  console.log(`\n⚠️  MORA SIMULADA:`)
  console.log(`  Días de mora: ${DIAS_MORA}`)
  console.log(`  Mora compuesta sobre $${MONTO.toLocaleString('es-CO')}: $${moraGenerada.toLocaleString('es-CO')}`)
  console.log(`  Cuota 1 + mora: $${totalAdeudadoCuota1.toLocaleString('es-CO')}`)

  // === Generar código único ===
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  const codigo = `TODO-COMPLETO-${yyyy}${mm}${dd}-${random}`

  // === Cargos opcionales (TODOS activados) ===
  const FONDO_GARANTIA_TASA = 0.05
  const fondoGarantiaMonto = Math.round(MONTO * FONDO_GARANTIA_TASA * 100) / 100
  const FLEXIBILIDAD_MODALIDAD = 'PREMIUM'
  const FLEXIBILIDAD_COSTO = 34900
  const VALOR_PAGARE_CARTA = 19900
  const VALOR_TARIFA_PLATAFORMA = 4900
  const RENOVACION_ANTICIPADA_COSTO = 9900
  const totalCargos = fondoGarantiaMonto + FLEXIBILIDAD_COSTO + VALOR_PAGARE_CARTA + VALOR_TARIFA_PLATAFORMA + RENOVACION_ANTICIPADA_COSTO

  console.log(`\n💰 Cargos activados:`)
  console.log(`  ✓ Fondo de Garantía (5%): $${fondoGarantiaMonto.toLocaleString('es-CO')}`)
  console.log(`  ✓ Flexibilidad Financiera PREMIUM: $${FLEXIBILIDAD_COSTO.toLocaleString('es-CO')}`)
  console.log(`  ✓ Cobro Pagaré + Carta: $${VALOR_PAGARE_CARTA.toLocaleString('es-CO')}`)
  console.log(`  ✓ Tarifa Uso Plataforma: $${VALOR_TARIFA_PLATAFORMA.toLocaleString('es-CO')}`)
  console.log(`  ✓ Renovación Anticipada: $${RENOVACION_ANTICIPADA_COSTO.toLocaleString('es-CO')}`)
  console.log(`  📊 TOTAL cargos iniciales: $${totalCargos.toLocaleString('es-CO')}`)

  // === Crear el préstamo EN MORA ===
  const nuevoPrestamo = await prisma.prestamo.create({
    data: {
      codigo,
      clienteId: cliente.id,
      montoPrincipal: MONTO,
      tasaInteresAnual: TASA_ANUAL_EQUIVALENTE,
      tasaInteresMensual: TASA_MENSUAL,
      tasaMoraDiaria: TASA_MORA_DIARIA,
      plazoMeses: PLAZO_MESES,
      frecuencia: FRECUENCIA,
      numeroCuotas: calculo.numeroCuotas,
      montoCuota: calculo.montoCuota,
      totalInteres: calculo.totalInteres,
      totalPagar: calculo.totalPagar,
      tasaAplicada: calculo.tasaAplicada,
      modalidadAmortizacion: 'TASA_FIJA',
      moraCompuestaDiaria: true,
      // === ESTADO EN MORA ===
      estado: 'EN_MORA',
      fechaSolicitud: fechaDesembolso,
      fechaDesembolso,
      fechaAprobacion: fechaDesembolso,
      fechaVencimiento: calculo.fechaVencimiento,
      tycEnviado: true,
      tycAceptado: true,
      tycFechaAceptacion: fechaDesembolso,
      requiereDocumentos: true,
      generarPagare: true,
      generarCarta: true,
      // Saldo (no se ha pagado nada)
      saldoCapital: MONTO,
      saldoInteres: calculo.totalInteres,
      saldoTotal: calculo.totalPagar,
      cuotasPagadas: 0,
      montoPagado: 0,
      // === Campos de mora ===
      diasMora: DIAS_MORA,
      montoMora: moraGenerada,
      montoMoraAcumulado: moraGenerada,
      // Fondo de Garantía al 5%
      fondoGarantiaCargado: false,
      fondoGarantiaMonto,
      fondoGarantiaTasa: FONDO_GARANTIA_TASA,
      // Flexibilidad Financiera PREMIUM
      flexibilidadFinanciera: true,
      flexibilidadCosto: FLEXIBILIDAD_COSTO,
      flexibilidadModalidad: FLEXIBILIDAD_MODALIDAD,
      flexibilidadUsosDisponibles: 2,
      flexibilidadUsosEjercidos: 0,
      flexibilidadActivada: true,
      flexibilidadFechaActivacion: fechaDesembolso,
      flexibilidadCobroAplicado: false,
      // Cobro Pagaré + Carta
      cobroPagareCarta: true,
      valorPagareCarta: VALOR_PAGARE_CARTA,
      // Tarifa Uso Plataforma
      cobroTarifaPlataforma: true,
      valorTarifaPlataforma: VALOR_TARIFA_PLATAFORMA,
      tarifaPlataformaCargada: false,
      // Renovación Anticipada
      renovacionAnticipada: true,
      renovacionAnticipadaCosto: RENOVACION_ANTICIPADA_COSTO,
      // Notas
      notas: `PRÉSTAMO DE PRUEBA — TODO COMPLETO (TASA MENSUAL 15%) — SIMULACIÓN MORA ${DIAS_MORA} días.
Modalidad: TASA_FIJA mensual.
Estado: EN_MORA (cuota 1 vencida hace ${DIAS_MORA} días).
Mora compuesta: $${moraGenerada.toLocaleString('es-CO')} sobre capital inicial.
Incluye: Fondo Garantía 5%, Flexibilidad Financiera PREMIUM, Cobro Pagaré+Carta $19.900, Tarifa Plataforma $4.900, Renovación Anticipada $9.900.
Creado por script de prueba para verificar visualización en el Portal del Cliente.`,
    },
  })

  console.log(`\n✅ Préstamo creado EN MORA: ${nuevoPrestamo.codigo}`)
  console.log(`   ID: ${nuevoPrestamo.id}`)
  console.log(`   Estado: ${nuevoPrestamo.estado}`)

  // === Crear pagos programados — Cuota 1 VENCIDA, Cuotas 2-6 PROGRAMADAS ===
  console.log('\n📅 Creando pagos programados...')
  for (const cuota of calculo.tablaAmortizacion) {
    const esCuota1Vencida = cuota.numero === 1
    const estado = esCuota1Vencida ? 'VENCIDO' : 'PROGRAMADO'
    const diasMoraCuota = esCuota1Vencida ? DIAS_MORA : 0
    const moraCalculadaCuota = esCuota1Vencida ? moraGenerada : 0

    await prisma.pagoProgramado.create({
      data: {
        prestamoId: nuevoPrestamo.id,
        numeroCuota: cuota.numero,
        fechaVencimiento: cuota.fechaVencimiento,
        montoCuota: cuota.montoCuota,
        montoCapital: cuota.capital,
        montoInteres: cuota.interes,
        saldoCapitalDespues: cuota.saldoCapital,
        estado,
        montoPagado: 0,
        moraCalculada: moraCalculadaCuota,
        diasMora: diasMoraCuota,
        fechaUltimaActualizacion: new Date(),
      },
    })

    const marca = esCuota1Vencida ? '⚠️ VENCIDA' : '✓ PROGRAMADA'
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')} ${marca}${esCuota1Vencida ? ` (+$${moraCalculadaCuota.toLocaleString('es-CO')} mora × ${diasMoraCuota}d)` : ''}`)
  }

  // === Crear notificación de mora (para que aparezca en avisos del portal) ===
  console.log('\n🔔 Creando notificación de mora...')
  await prisma.notificacionLog.create({
    data: {
      prestamoId: nuevoPrestamo.id,
      clienteTelefono: cliente.telefono,
      tipo: 'MORA',
      mensaje: `Hola ${cliente.nombre}, tu cuota 1 del préstamo ${nuevoPrestamo.codigo} por $${calculo.montoCuota.toLocaleString('es-CO')} venció hace ${DIAS_MORA} días. Mora generada: $${moraGenerada.toLocaleString('es-CO')}. Total a pagar: $${totalAdeudadoCuota1.toLocaleString('es-CO')}. Por favor regulariza tu pago lo antes posible.`,
      estado: 'PENDIENTE',
      canal: 'PORTAL',
      fechaEnvio: new Date(),
    },
  })
  console.log(`   ✓ Notificación de mora creada (visible en "Avisos" del portal)`)

  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRÉSTAMO "TODO COMPLETO" EN MORA CREADO EXITOSAMENTE')
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
  console.log(`  Estado: ${nuevoPrestamo.estado}`)
  console.log(`  Días de mora: ${DIAS_MORA}`)
  console.log(`  Mora acumulada: $${moraGenerada.toLocaleString('es-CO')}`)
  console.log(`  Cuota 1 vencida + mora: $${totalAdeudadoCuota1.toLocaleString('es-CO')}`)
  console.log(`  Cargos iniciales: $${totalCargos.toLocaleString('es-CO')}`)
  console.log(`\n💡 El préstamo está visible en el Portal del Cliente en:`)
  console.log(`   - Sección "Créditos" con badge EN MORA (rojo)`)
  console.log(`   - Sección "Próximos" con cuota 1 VENCIDA resaltada`)
  console.log(`   - Sección "Avisos" con notificación de mora`)
  console.log(`   - "🏆 Pasaporte de Confianza" con novedad detectada (vencido)`)
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
