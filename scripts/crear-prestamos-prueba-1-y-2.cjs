// =====================================================
// 🧪 CREAR DOS PRÉSTAMOS DE PRUEBA — PRUEBA-1 y PRUEBA-2
// =====================================================
// Este script crea DOS préstamos de prueba con TODOS los cobros activados:
//
//   📌 PRUEBA-1 — Préstamo CON mora en cuota actual
//      - 8 cuotas mensuales a $500.000 al 15% mensual
//      - Cuotas 1, 2, 3: PAGADAS (trazabilidad de pagos)
//      - Cuota 4: VENCIDA con 12 días de mora
//      - Cuotas 5-8: PROGRAMADAS (pendientes)
//      - Estado préstamo: EN_MORA
//      - Genera: notificación de mora + novedad de Pasaporte de Confianza
//
//   📌 PRUEBA-2 — Préstamo al día (trazabilidad perfecta)
//      - 6 cuotas mensuales a $500.000 al 15% mensual
//      - Cuotas 1, 2, 3: PAGADAS (trazabilidad de pagos al día)
//      - Cuotas 4-6: PROGRAMADAS (pendientes)
//      - Estado préstamo: ACTIVO
//      - NO genera mora ni novedades negativas
//
// Ambos préstamos incluyen TODOS los cobros activados:
//   ✓ Fondo de Garantía al 5%
//   ✓ Flexibilidad Financiera PREMIUM ($34.900)
//   ✓ Cobro Pagaré + Carta ($19.900)
//   ✓ Tarifa Uso de Plataforma ($4.900)
//   ✓ Renovación Anticipada ($9.900)
//   ✓ Mora compuesta diaria activada
//
// Uso: node scripts/crear-prestamos-prueba-1-y-2.cjs [cedula]
//   (si no se pasa cédula, usa a Johan por defecto)
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

// === Función mora compuesta diaria ===
function calcularMoraCompuesta(saldoPendiente, tasaMoraDiaria, diasMora) {
  if (diasMora <= 0 || saldoPendiente <= 0) return 0
  const tasaDiariaDecimal = tasaMoraDiaria / 100
  const mora = saldoPendiente * (Math.pow(1 + tasaDiariaDecimal, diasMora) - 1)
  return Math.round(mora * 100) / 100
}

// === Limpiar préstamos PRUEBA-* previos del cliente ===
async function limpiarPrestamosPruebaPrevios(clienteId) {
  const previos = await prisma.prestamo.findMany({
    where: { codigo: { startsWith: 'PRUEBA-' }, clienteId },
    select: { id: true, codigo: true },
  })
  if (previos.length) {
    console.log(`\n🧹 Eliminando ${previos.length} préstamo(s) PRUEBA-* previo(s) del cliente...`)
    for (const p of previos) {
      await prisma.pagoProgramado.deleteMany({ where: { prestamoId: p.id } })
      await prisma.pago.deleteMany({ where: { prestamoId: p.id } })
      await prisma.notificacionLog.deleteMany({ where: { prestamoId: p.id } })
      await prisma.compromisoPago.deleteMany({ where: { prestamoId: p.id } })
      await prisma.pasaporteAuditoria.deleteMany({ where: { prestamoId: p.id } })
      await prisma.prestamo.delete({ where: { id: p.id } })
      console.log(`   ✗ ${p.codigo}`)
    }
  }
}

// === Datos comunes de cargos (todos activados) ===
const CARGOS = {
  FONDO_GARANTIA_TASA: 0.05,
  FLEXIBILIDAD_COSTO: 34900,
  FLEXIBILIDAD_MODALIDAD: 'PREMIUM',
  VALOR_PAGARE_CARTA: 19900,
  VALOR_TARIFA_PLATAFORMA: 4900,
  RENOVACION_ANTICIPADA_COSTO: 9900,
}

function calcularTotalCargos(montoPrincipal) {
  const fondoGarantia = Math.round(montoPrincipal * CARGOS.FONDO_GARANTIA_TASA * 100) / 100
  return {
    fondoGarantia,
    flexibilidad: CARGOS.FLEXIBILIDAD_COSTO,
    pagareCarta: CARGOS.VALOR_PAGARE_CARTA,
    tarifaPlataforma: CARGOS.VALOR_TARIFA_PLATAFORMA,
    renovacionAnticipada: CARGOS.RENOVACION_ANTICIPADA_COSTO,
    total: fondoGarantia + CARGOS.FLEXIBILIDAD_COSTO + CARGOS.VALOR_PAGARE_CARTA + CARGOS.VALOR_TARIFA_PLATAFORMA + CARGOS.RENOVACION_ANTICIPADA_COSTO,
  }
}

// =====================================================
// 📌 CREAR PRUEBA-1 — Con mora en cuota actual
// =====================================================
async function crearPrueba1(cliente) {
  console.log('\n' + '='.repeat(70))
  console.log('🧪 CREAR PRUEBA-1 — Préstamo CON mora en cuota 4')
  console.log('='.repeat(70))

  const MONTO = 500000
  const TASA_MENSUAL = 15
  const TASA_ANUAL_EQUIVALENTE = TASA_MENSUAL * 12 // 180
  const TASA_MORA_ANUAL = TASA_ANUAL_EQUIVALENTE
  const TASA_MORA_DIARIA = TASA_MORA_ANUAL / 365 // 0.4931% diario
  const NUMERO_CUOTAS = 8
  const PLAZO_MESES = 8
  const FRECUENCIA = 'MENSUAL'
  const CUOTAS_PAGADAS = 3 // cuotas 1, 2, 3 pagadas
  const CUOTA_VENCIDA_NUMERO = 4 // cuota 4 vencida
  const DIAS_MORA = 12 // 12 días de mora en cuota 4

  // === Calcular fecha de desembolso para que la cuota 4 venza hace DIAS_MORA días ===
  // Si desembolso = hoy - 3 meses - DIAS_MORA días, entonces:
  //   cuota 1 vence: hoy - 2 meses - DIAS_MORA días (pagada)
  //   cuota 2 vence: hoy - 1 mes - DIAS_MORA días (pagada)
  //   cuota 3 vence: hoy - DIAS_MORA días (pagada)
  //   cuota 4 vence: hoy + (1 mes - DIAS_MORA días)... no, recalculando:
  //
  // Mejor: desembolso fue hace (4 meses - DIAS_MORA días) desde hoy.
  // Entonces:
  //   cuota 1 vence: desembolso + 1 mes = hoy - 3 meses - DIAS_MORA días → PAGADA
  //   cuota 2 vence: desembolso + 2 meses = hoy - 2 meses - DIAS_MORA días → PAGADA
  //   cuota 3 vence: desembolso + 3 meses = hoy - 1 mes - DIAS_MORA días → PAGADA
  //   cuota 4 vence: desembolso + 4 meses = hoy - DIAS_MORA días → VENCIDA (hace 12 días)
  //   cuota 5 vence: desembolso + 5 meses = hoy + (1 mes - DIAS_MORA días) → PROGRAMADA
  //   ...
  const hoy = new Date()
  hoy.setUTCHours(12, 0, 0, 0)
  const fechaDesembolso = new Date(hoy)
  fechaDesembolso.setMonth(fechaDesembolso.getMonth() - CUOTA_VENCIDA_NUMERO)
  fechaDesembolso.setDate(fechaDesembolso.getDate() - DIAS_MORA)

  console.log(`\n📅 Simulación temporal:`)
  console.log(`  Hoy: ${hoy.toISOString().slice(0, 10)}`)
  console.log(`  Fecha desembolso: ${fechaDesembolso.toISOString().slice(0, 10)}`)
  console.log(`  Vencimiento cuota 4: hace ${DIAS_MORA} días (VENCIDA)`)

  // === Cálculo del préstamo ===
  const calculo = calcularPrestamoTasaFijaMensual({
    montoPrincipal: MONTO,
    tasaMensualFija: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    frecuencia: FRECUENCIA,
    fechaDesembolso,
  })

  // === Mora sobre capital pendiente después de cuota 3 ===
  // Después de pagar 3 cuotas, el saldo de capital es: MONTO - (3 × abonoCapital)
  // Pero la mora se calcula sobre el SALDO PENDIENTE de la cuota vencida
  const saldoCapitalPendiente = calculo.tablaAmortizacion[CUOTA_VENCIDA_NUMERO - 1].saldoCapital + calculo.tablaAmortizacion[CUOTA_VENCIDA_NUMERO - 1].capital
  // (saldo después de pagar cuota 4 + capital de cuota 4 = saldo antes de pagar cuota 4)
  const moraGenerada = calcularMoraCompuesta(saldoCapitalPendiente, TASA_MORA_DIARIA, DIAS_MORA)
  const montoCuotaVencida = calculo.tablaAmortizacion[CUOTA_VENCIDA_NUMERO - 1].montoCuota
  const totalAdeudadoCuotaVencida = montoCuotaVencida + moraGenerada

  console.log(`\n📊 Cálculo del préstamo (TASA FIJA MENSUAL):`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Tasa mora diaria: ${TASA_MORA_DIARIA.toFixed(4)}%`)
  console.log(`  Plazo: ${PLAZO_MESES} meses (${calculo.numeroCuotas} cuotas ${FRECUENCIA.toLowerCase()})`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)

  console.log(`\n⚠️  MORA SIMULADA en cuota ${CUOTA_VENCIDA_NUMERO}:`)
  console.log(`  Días de mora: ${DIAS_MORA}`)
  console.log(`  Mora compuesta sobre $${saldoCapitalPendiente.toLocaleString('es-CO')}: $${moraGenerada.toLocaleString('es-CO')}`)
  console.log(`  Cuota ${CUOTA_VENCIDA_NUMERO} + mora: $${totalAdeudadoCuotaVencida.toLocaleString('es-CO')}`)

  // === Cargos ===
  const cargos = calcularTotalCargos(MONTO)
  console.log(`\n💰 Cargos activados:`)
  console.log(`  ✓ Fondo de Garantía (5%): $${cargos.fondoGarantia.toLocaleString('es-CO')}`)
  console.log(`  ✓ Flexibilidad Financiera PREMIUM: $${cargos.flexibilidad.toLocaleString('es-CO')}`)
  console.log(`  ✓ Cobro Pagaré + Carta: $${cargos.pagareCarta.toLocaleString('es-CO')}`)
  console.log(`  ✓ Tarifa Uso Plataforma: $${cargos.tarifaPlataforma.toLocaleString('es-CO')}`)
  console.log(`  ✓ Renovación Anticipada: $${cargos.renovacionAnticipada.toLocaleString('es-CO')}`)
  console.log(`  📊 TOTAL cargos iniciales: $${cargos.total.toLocaleString('es-CO')}`)

  // === Calcular saldos después de 3 cuotas pagadas ===
  const capitalPagado = calculo.tablaAmortizacion
    .filter((c) => c.numero <= CUOTAS_PAGADAS)
    .reduce((sum, c) => sum + c.capital, 0)
  const interesPagado = calculo.tablaAmortizacion
    .filter((c) => c.numero <= CUOTAS_PAGADAS)
    .reduce((sum, c) => sum + c.interes, 0)
  const montoPagadoTotal = capitalPagado + interesPagado
  const saldoCapitalActual = MONTO - capitalPagado
  const saldoInteresActual = calculo.totalInteres - interesPagado
  const saldoTotalActual = calculo.totalPagar - montoPagadoTotal + moraGenerada

  console.log(`\n📈 Saldos después de ${CUOTAS_PAGADAS} cuotas pagadas:`)
  console.log(`  Capital pagado: $${capitalPagado.toLocaleString('es-CO')}`)
  console.log(`  Interés pagado: $${interesPagado.toLocaleString('es-CO')}`)
  console.log(`  Monto total pagado: $${montoPagadoTotal.toLocaleString('es-CO')}`)
  console.log(`  Saldo capital pendiente: $${saldoCapitalActual.toLocaleString('es-CO')}`)
  console.log(`  Saldo interés pendiente: $${saldoInteresActual.toLocaleString('es-CO')}`)
  console.log(`  Mora acumulada: $${moraGenerada.toLocaleString('es-CO')}`)
  console.log(`  Saldo TOTAL con mora: $${saldoTotalActual.toLocaleString('es-CO')}`)

  // === Generar código único ===
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  const codigo = `PRUEBA-1-${yyyy}${mm}${dd}-${random}`

  // === Crear el préstamo EN_MORA ===
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
      // === Saldo actualizado (3 cuotas pagadas + mora) ===
      saldoCapital: saldoCapitalActual,
      saldoInteres: saldoInteresActual,
      saldoTotal: saldoTotalActual,
      cuotasPagadas: CUOTAS_PAGADAS,
      montoPagado: montoPagadoTotal,
      // === Campos de mora ===
      diasMora: DIAS_MORA,
      montoMora: moraGenerada,
      montoMoraAcumulado: moraGenerada,
      // Fondo de Garantía al 5%
      fondoGarantiaCargado: true, // ya cargado en la primera cuota
      fondoGarantiaMonto: cargos.fondoGarantia,
      fondoGarantiaTasa: CARGOS.FONDO_GARANTIA_TASA,
      // Flexibilidad Financiera PREMIUM
      flexibilidadFinanciera: true,
      flexibilidadCosto: CARGOS.FLEXIBILIDAD_COSTO,
      flexibilidadModalidad: CARGOS.FLEXIBILIDAD_MODALIDAD,
      flexibilidadUsosDisponibles: 2,
      flexibilidadUsosEjercidos: 0,
      flexibilidadActivada: true,
      flexibilidadFechaActivacion: fechaDesembolso,
      flexibilidadCobroAplicado: true, // ya cobrado en la primera cuota
      // Cobro Pagaré + Carta
      cobroPagareCarta: true,
      valorPagareCarta: CARGOS.VALOR_PAGARE_CARTA,
      // Tarifa Uso Plataforma
      cobroTarifaPlataforma: true,
      valorTarifaPlataforma: CARGOS.VALOR_TARIFA_PLATAFORMA,
      tarifaPlataformaCargada: true, // ya cargada
      // Renovación Anticipada
      renovacionAnticipada: true,
      renovacionAnticipadaCosto: CARGOS.RENOVACION_ANTICIPADA_COSTO,
      // Notas
      notas: `PRÉSTAMO DE PRUEBA 1 — TASA MENSUAL 15% — CON MORA EN CUOTA ${CUOTA_VENCIDA_NUMERO}.
Modalidad: TASA_FIJA mensual.
Estado: EN_MORA (cuota ${CUOTA_VENCIDA_NUMERO} vencida hace ${DIAS_MORA} días).
Trayectoria: ${CUOTAS_PAGADAS} cuotas pagadas al día, cuota ${CUOTA_VENCIDA_NUMERO} vencida con ${DIAS_MORA} días de mora.
Mora compuesta: $${moraGenerada.toLocaleString('es-CO')} sobre saldo pendiente $${saldoCapitalPendiente.toLocaleString('es-CO')}.
Cargos activados: Fondo Garantía 5% ($${cargos.fondoGarantia.toLocaleString('es-CO')}), Flexibilidad PREMIUM ($${cargos.flexibilidad.toLocaleString('es-CO')}), Pagaré+Carta ($${cargos.pagareCarta.toLocaleString('es-CO')}), Tarifa Plataforma ($${cargos.tarifaPlataforma.toLocaleString('es-CO')}), Renovación Anticipada ($${cargos.renovacionAnticipada.toLocaleString('es-CO')}).
Creado por script de prueba para verificar visualización en el Portal del Cliente.`,
    },
  })

  console.log(`\n✅ Préstamo PRUEBA-1 creado: ${nuevoPrestamo.codigo}`)
  console.log(`   ID: ${nuevoPrestamo.id}`)
  console.log(`   Estado: ${nuevoPrestamo.estado}`)

  // === Crear pagos programados ===
  console.log('\n📅 Creando pagos programados...')
  for (const cuota of calculo.tablaAmortizacion) {
    let estado, montoPagadoCuota, moraCalculadaCuota, diasMoraCuota, fechaPagoCuota

    if (cuota.numero <= CUOTAS_PAGADAS) {
      // Cuota pagada
      estado = 'PAGADO'
      montoPagadoCuota = cuota.montoCuota
      moraCalculadaCuota = 0
      diasMoraCuota = 0
      // Fecha de pago: 2 días antes del vencimiento (pago puntual)
      fechaPagoCuota = new Date(cuota.fechaVencimiento)
      fechaPagoCuota.setDate(fechaPagoCuota.getDate() - 2)
    } else if (cuota.numero === CUOTA_VENCIDA_NUMERO) {
      // Cuota vencida con mora
      estado = 'VENCIDO'
      montoPagadoCuota = 0
      moraCalculadaCuota = moraGenerada
      diasMoraCuota = DIAS_MORA
      fechaPagoCuota = null
    } else {
      // Cuota programada (pendiente)
      estado = 'PROGRAMADO'
      montoPagadoCuota = 0
      moraCalculadaCuota = 0
      diasMoraCuota = 0
      fechaPagoCuota = null
    }

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
        montoPagado: montoPagadoCuota,
        moraCalculada: moraCalculadaCuota,
        diasMora: diasMoraCuota,
        fechaUltimaActualizacion: new Date(),
      },
    })

    let marca = '✓ PAGADA'
    if (estado === 'VENCIDO') marca = `⚠️ VENCIDA (+$${moraCalculadaCuota.toLocaleString('es-CO')} mora × ${diasMoraCuota}d)`
    else if (estado === 'PROGRAMADO') marca = '📅 PROGRAMADA'
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')} ${marca}`)
  }

  // === Crear registros de Pago (historial) para las cuotas pagadas ===
  console.log('\n💰 Creando registros de pago históricos...')
  const metodos = ['EFECTIVO', 'PSE', 'BANCOLOMBIA_TRANSFERENCIA', 'DAVIVIENDA_TRANSFERENCIA']
  for (let i = 1; i <= CUOTAS_PAGADAS; i++) {
    const cuota = calculo.tablaAmortizacion[i - 1]
    const fechaPago = new Date(cuota.fechaVencimiento)
    fechaPago.setDate(fechaPago.getDate() - 2)
    const metodo = metodos[(i - 1) % metodos.length]
    const referencia = `PAY-${codigo.slice(-6)}-C${i}`

    await prisma.pago.create({
      data: {
        prestamoId: nuevoPrestamo.id,
        numeroCuota: cuota.numero,
        montoCapital: cuota.capital,
        montoInteres: cuota.interes,
        montoMora: 0,
        montoTotal: cuota.montoCuota,
        fechaPago,
        fechaVencimiento: cuota.fechaVencimiento,
        metodoPago: metodo,
        referencia,
        estado: 'APLICADO',
        notas: `Pago puntual de cuota ${cuota.numero} — PRUEBA-1`,
      },
    })
    console.log(`   ✓ Pago cuota ${cuota.numero}: $${cuota.montoCuota.toLocaleString('es-CO')} (${metodo}) — ${fechaPago.toISOString().slice(0, 10)}`)
  }

  // === Crear notificación de mora ===
  console.log('\n🔔 Creando notificación de mora...')
  await prisma.notificacionLog.create({
    data: {
      prestamoId: nuevoPrestamo.id,
      clienteTelefono: cliente.telefono,
      tipo: 'MORA',
      mensaje: `Hola ${cliente.nombre}, tu cuota ${CUOTA_VENCIDA_NUMERO} del préstamo ${nuevoPrestamo.codigo} por $${montoCuotaVencida.toLocaleString('es-CO')} venció hace ${DIAS_MORA} días. Mora generada: $${moraGenerada.toLocaleString('es-CO')}. Total a pagar: $${totalAdeudadoCuotaVencida.toLocaleString('es-CO')}. Por favor regulariza tu pago lo antes posible.`,
      estado: 'PENDIENTE',
      canal: 'PORTAL',
      fechaEnvio: new Date(),
    },
  })
  console.log(`   ✓ Notificación de mora creada (visible en "Avisos" del portal)`)

  // === Crear novedad de Pasaporte de Confianza ===
  console.log('\n🏆 Creando novedad de Pasaporte de Confianza...')
  await prisma.pasaporteAuditoria.create({
    data: {
      clienteId: cliente.id,
      prestamoId: nuevoPrestamo.id,
      tipoAccion: 'NOVEDAD_DETECTADA',
      descripcion: `Pago vencido — Cuota ${CUOTA_VENCIDA_NUMERO} del préstamo ${nuevoPrestamo.codigo} con ${DIAS_MORA} días de atraso. Mora acumulada: $${moraGenerada.toLocaleString('es-CO')}.`,
      valor: moraGenerada,
      fechaComprometida: calculo.tablaAmortizacion[CUOTA_VENCIDA_NUMERO - 1].fechaVencimiento,
      estado: 'VENCIDO',
      fecha: new Date(),
    },
  })
  console.log(`   ✓ Novedad de Pasaporte de Confianza registrada`)

  // === Resumen PRUEBA-1 ===
  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRUEBA-1 CREADO EXITOSAMENTE')
  console.log('='.repeat(70))
  console.log(`\n📋 RESUMEN PRUEBA-1:`)
  console.log(`  Cliente: ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`  Código: ${nuevoPrestamo.codigo}`)
  console.log(`  Modalidad: TASA_FIJA MENSUAL`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')} × ${calculo.numeroCuotas}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Estado: ${nuevoPrestamo.estado}`)
  console.log(`  Cuotas pagadas: ${CUOTAS_PAGADAS} (1, 2, 3)`)
  console.log(`  Cuota vencida: ${CUOTA_VENCIDA_NUMERO} (hace ${DIAS_MORA} días)`)
  console.log(`  Mora acumulada: $${moraGenerada.toLocaleString('es-CO')}`)
  console.log(`  Saldo pendiente: $${saldoTotalActual.toLocaleString('es-CO')}`)

  return nuevoPrestamo
}

// =====================================================
// 📌 CREAR PRUEBA-2 — Al día (trazabilidad perfecta)
// =====================================================
async function crearPrueba2(cliente) {
  console.log('\n' + '='.repeat(70))
  console.log('🧪 CREAR PRUEBA-2 — Préstamo al día (trazabilidad perfecta)')
  console.log('='.repeat(70))

  const MONTO = 500000
  const TASA_MENSUAL = 15
  const TASA_ANUAL_EQUIVALENTE = TASA_MENSUAL * 12 // 180
  const TASA_MORA_ANUAL = TASA_ANUAL_EQUIVALENTE
  const TASA_MORA_DIARIA = TASA_MORA_ANUAL / 365 // 0.4931% diario
  const NUMERO_CUOTAS = 6
  const PLAZO_MESES = 6
  const FRECUENCIA = 'MENSUAL'
  const CUOTAS_PAGADAS = 3 // cuotas 1, 2, 3 pagadas

  // === Calcular fecha de desembolso: hace 3 meses y 5 días ===
  // Así:
  //   cuota 1 vence: hace 2 meses y 5 días → PAGADA
  //   cuota 2 vence: hace 1 mes y 5 días → PAGADA
  //   cuota 3 vence: hace 5 días → PAGADA (al día)
  //   cuota 4 vence: en ~25 días → PROGRAMADA
  //   cuota 5 vence: en ~55 días → PROGRAMADA
  //   cuota 6 vence: en ~85 días → PROGRAMADA
  const hoy = new Date()
  hoy.setUTCHours(12, 0, 0, 0)
  const fechaDesembolso = new Date(hoy)
  fechaDesembolso.setMonth(fechaDesembolso.getMonth() - CUOTAS_PAGADAS)
  fechaDesembolso.setDate(fechaDesembolso.getDate() - 5)

  console.log(`\n📅 Simulación temporal:`)
  console.log(`  Hoy: ${hoy.toISOString().slice(0, 10)}`)
  console.log(`  Fecha desembolso: ${fechaDesembolso.toISOString().slice(0, 10)}`)

  // === Cálculo del préstamo ===
  const calculo = calcularPrestamoTasaFijaMensual({
    montoPrincipal: MONTO,
    tasaMensualFija: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    frecuencia: FRECUENCIA,
    fechaDesembolso,
  })

  console.log(`\n📊 Cálculo del préstamo (TASA FIJA MENSUAL):`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Tasa mora diaria: ${TASA_MORA_DIARIA.toFixed(4)}%`)
  console.log(`  Plazo: ${PLAZO_MESES} meses (${calculo.numeroCuotas} cuotas ${FRECUENCIA.toLowerCase()})`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)

  // === Cargos ===
  const cargos = calcularTotalCargos(MONTO)
  console.log(`\n💰 Cargos activados:`)
  console.log(`  ✓ Fondo de Garantía (5%): $${cargos.fondoGarantia.toLocaleString('es-CO')}`)
  console.log(`  ✓ Flexibilidad Financiera PREMIUM: $${cargos.flexibilidad.toLocaleString('es-CO')}`)
  console.log(`  ✓ Cobro Pagaré + Carta: $${cargos.pagareCarta.toLocaleString('es-CO')}`)
  console.log(`  ✓ Tarifa Uso Plataforma: $${cargos.tarifaPlataforma.toLocaleString('es-CO')}`)
  console.log(`  ✓ Renovación Anticipada: $${cargos.renovacionAnticipada.toLocaleString('es-CO')}`)
  console.log(`  📊 TOTAL cargos iniciales: $${cargos.total.toLocaleString('es-CO')}`)

  // === Calcular saldos después de 3 cuotas pagadas ===
  const capitalPagado = calculo.tablaAmortizacion
    .filter((c) => c.numero <= CUOTAS_PAGADAS)
    .reduce((sum, c) => sum + c.capital, 0)
  const interesPagado = calculo.tablaAmortizacion
    .filter((c) => c.numero <= CUOTAS_PAGADAS)
    .reduce((sum, c) => sum + c.interes, 0)
  const montoPagadoTotal = capitalPagado + interesPagado
  const saldoCapitalActual = MONTO - capitalPagado
  const saldoInteresActual = calculo.totalInteres - interesPagado
  const saldoTotalActual = calculo.totalPagar - montoPagadoTotal

  console.log(`\n📈 Saldos después de ${CUOTAS_PAGADAS} cuotas pagadas:`)
  console.log(`  Capital pagado: $${capitalPagado.toLocaleString('es-CO')}`)
  console.log(`  Interés pagado: $${interesPagado.toLocaleString('es-CO')}`)
  console.log(`  Monto total pagado: $${montoPagadoTotal.toLocaleString('es-CO')}`)
  console.log(`  Saldo capital pendiente: $${saldoCapitalActual.toLocaleString('es-CO')}`)
  console.log(`  Saldo interés pendiente: $${saldoInteresActual.toLocaleString('es-CO')}`)
  console.log(`  Saldo TOTAL: $${saldoTotalActual.toLocaleString('es-CO')}`)

  // === Generar código único ===
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  const codigo = `PRUEBA-2-${yyyy}${mm}${dd}-${random}`

  // === Crear el préstamo ACTIVO (al día) ===
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
      // === ESTADO ACTIVO (al día) ===
      estado: 'ACTIVO',
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
      // === Saldo actualizado (3 cuotas pagadas, sin mora) ===
      saldoCapital: saldoCapitalActual,
      saldoInteres: saldoInteresActual,
      saldoTotal: saldoTotalActual,
      cuotasPagadas: CUOTAS_PAGADAS,
      montoPagado: montoPagadoTotal,
      // === Sin mora ===
      diasMora: 0,
      montoMora: 0,
      montoMoraAcumulado: 0,
      // Fondo de Garantía al 5%
      fondoGarantiaCargado: true,
      fondoGarantiaMonto: cargos.fondoGarantia,
      fondoGarantiaTasa: CARGOS.FONDO_GARANTIA_TASA,
      // Flexibilidad Financiera PREMIUM
      flexibilidadFinanciera: true,
      flexibilidadCosto: CARGOS.FLEXIBILIDAD_COSTO,
      flexibilidadModalidad: CARGOS.FLEXIBILIDAD_MODALIDAD,
      flexibilidadUsosDisponibles: 2,
      flexibilidadUsosEjercidos: 0,
      flexibilidadActivada: true,
      flexibilidadFechaActivacion: fechaDesembolso,
      flexibilidadCobroAplicado: true,
      // Cobro Pagaré + Carta
      cobroPagareCarta: true,
      valorPagareCarta: CARGOS.VALOR_PAGARE_CARTA,
      // Tarifa Uso Plataforma
      cobroTarifaPlataforma: true,
      valorTarifaPlataforma: CARGOS.VALOR_TARIFA_PLATAFORMA,
      tarifaPlataformaCargada: true,
      // Renovación Anticipada
      renovacionAnticipada: true,
      renovacionAnticipadaCosto: CARGOS.RENOVACION_ANTICIPADA_COSTO,
      // Notas
      notas: `PRÉSTAMO DE PRUEBA 2 — TASA MENSUAL 15% — TRAYECTORIA AL DÍA.
Modalidad: TASA_FIJA mensual.
Estado: ACTIVO (al día, sin mora).
Trayectoria: ${CUOTAS_PAGADAS} cuotas pagadas puntualmente, ${NUMERO_CUOTAS - CUOTAS_PAGADAS} cuotas programadas pendientes.
Cargos activados: Fondo Garantía 5% ($${cargos.fondoGarantia.toLocaleString('es-CO')}), Flexibilidad PREMIUM ($${cargos.flexibilidad.toLocaleString('es-CO')}), Pagaré+Carta ($${cargos.pagareCarta.toLocaleString('es-CO')}), Tarifa Plataforma ($${cargos.tarifaPlataforma.toLocaleString('es-CO')}), Renovación Anticipada ($${cargos.renovacionAnticipada.toLocaleString('es-CO')}).
Creado por script de prueba para verificar visualización en el Portal del Cliente.`,
    },
  })

  console.log(`\n✅ Préstamo PRUEBA-2 creado: ${nuevoPrestamo.codigo}`)
  console.log(`   ID: ${nuevoPrestamo.id}`)
  console.log(`   Estado: ${nuevoPrestamo.estado}`)

  // === Crear pagos programados ===
  console.log('\n📅 Creando pagos programados...')
  for (const cuota of calculo.tablaAmortizacion) {
    let estado, montoPagadoCuota

    if (cuota.numero <= CUOTAS_PAGADAS) {
      // Cuota pagada puntualmente
      estado = 'PAGADO'
      montoPagadoCuota = cuota.montoCuota
    } else {
      // Cuota programada
      estado = 'PROGRAMADO'
      montoPagadoCuota = 0
    }

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
        montoPagado: montoPagadoCuota,
        moraCalculada: 0,
        diasMora: 0,
        fechaUltimaActualizacion: new Date(),
      },
    })

    const marca = estado === 'PAGADO' ? '✓ PAGADA' : '📅 PROGRAMADA'
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')} ${marca}`)
  }

  // === Crear registros de Pago (historial) para las cuotas pagadas ===
  console.log('\n💰 Creando registros de pago históricos...')
  const metodos = ['EFECTIVO', 'PSE', 'BANCOLOMBIA_TRANSFERENCIA', 'DAVIVIENDA_TRANSFERENCIA']
  for (let i = 1; i <= CUOTAS_PAGADAS; i++) {
    const cuota = calculo.tablaAmortizacion[i - 1]
    const fechaPago = new Date(cuota.fechaVencimiento)
    fechaPago.setDate(fechaPago.getDate() - 3) // pagó 3 días antes del vencimiento
    const metodo = metodos[(i - 1) % metodos.length]
    const referencia = `PAY-${codigo.slice(-6)}-C${i}`

    await prisma.pago.create({
      data: {
        prestamoId: nuevoPrestamo.id,
        numeroCuota: cuota.numero,
        montoCapital: cuota.capital,
        montoInteres: cuota.interes,
        montoMora: 0,
        montoTotal: cuota.montoCuota,
        fechaPago,
        fechaVencimiento: cuota.fechaVencimiento,
        metodoPago: metodo,
        referencia,
        estado: 'APLICADO',
        notas: `Pago puntual de cuota ${cuota.numero} — PRUEBA-2 (trayectoria al día)`,
      },
    })
    console.log(`   ✓ Pago cuota ${cuota.numero}: $${cuota.montoCuota.toLocaleString('es-CO')} (${metodo}) — ${fechaPago.toISOString().slice(0, 10)}`)
  }

  // === Crear notificación positiva (recordatorio de próxima cuota) ===
  console.log('\n🔔 Creando notificación de próxima cuota...')
  const proximaCuota = calculo.tablaAmortizacion[CUOTAS_PAGADAS]
  const diasParaProxima = Math.ceil((proximaCuota.fechaVencimiento - hoy) / (1000 * 60 * 60 * 24))
  await prisma.notificacionLog.create({
    data: {
      prestamoId: nuevoPrestamo.id,
      clienteTelefono: cliente.telefono,
      tipo: 'RECORDATORIO',
      mensaje: `Hola ${cliente.nombre}, tu cuota ${CUOTAS_PAGADAS + 1} del préstamo ${nuevoPrestamo.codigo} vence en ${diasParaProxima} días. Monto: $${proximaCuota.montoCuota.toLocaleString('es-CO')}. ¡Gracias por tus pagos puntuales!`,
      estado: 'PENDIENTE',
      canal: 'PORTAL',
      fechaEnvio: new Date(),
    },
  })
  console.log(`   ✓ Notificación de recordatorio creada (próxima cuota en ${diasParaProxima} días)`)

  // === Crear auditoría positiva de Pasaporte de Confianza ===
  console.log('\n🏆 Creando auditoría positiva de Pasaporte de Confianza...')
  await prisma.pasaporteAuditoria.create({
    data: {
      clienteId: cliente.id,
      prestamoId: nuevoPrestamo.id,
      tipoAccion: 'NOVEDAD_INFORMADA',
      descripcion: `Trayectoria al día — ${CUOTAS_PAGADAS} cuotas pagadas puntualmente en préstamo ${nuevoPrestamo.codigo}. Cliente mantiene buen historial de pago.`,
      valor: montoPagadoTotal,
      estado: 'AL_DIA',
      fecha: new Date(),
    },
  })
  console.log(`   ✓ Novedad positiva de Pasaporte de Confianza registrada`)

  // === Resumen PRUEBA-2 ===
  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRUEBA-2 CREADO EXITOSAMENTE')
  console.log('='.repeat(70))
  console.log(`\n📋 RESUMEN PRUEBA-2:`)
  console.log(`  Cliente: ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`  Código: ${nuevoPrestamo.codigo}`)
  console.log(`  Modalidad: TASA_FIJA MENSUAL`)
  console.log(`  Capital: $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual: ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Cuota: $${calculo.montoCuota.toLocaleString('es-CO')} × ${calculo.numeroCuotas}`)
  console.log(`  Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Estado: ${nuevoPrestamo.estado}`)
  console.log(`  Cuotas pagadas: ${CUOTAS_PAGADAS} (1, 2, 3 — al día)`)
  console.log(`  Cuotas pendientes: ${NUMERO_CUOTAS - CUOTAS_PAGADAS} (4, 5, 6 — programadas)`)
  console.log(`  Mora: $0 (sin atrasos)`)
  console.log(`  Saldo pendiente: $${saldoTotalActual.toLocaleString('es-CO')}`)

  return nuevoPrestamo
}

// =====================================================
// 🚀 FUNCIÓN PRINCIPAL
// =====================================================
async function main() {
  console.log('='.repeat(70))
  console.log('🧪 CREAR DOS PRÉSTAMOS DE PRUEBA — PRUEBA-1 y PRUEBA-2')
  console.log('='.repeat(70))

  // === Buscar cliente ===
  const cedulaParam = process.argv[2] || '1214731649' // Johan por defecto
  const cliente = await prisma.cliente.findFirst({
    where: { cedula: cedulaParam },
    select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
  })

  if (!cliente) {
    console.error(`❌ No se encontró cliente con cédula ${cedulaParam}`)
    process.exit(1)
  }

  console.log(`\n✅ Usando cliente: ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`   Teléfono: ${cliente.telefono}`)
  console.log(`   Email: ${cliente.email || 'sin email'}`)

  // === Limpiar préstamos PRUEBA-* previos ===
  await limpiarPrestamosPruebaPrevios(cliente.id)

  // === Crear PRUEBA-1 (con mora) ===
  const prueba1 = await crearPrueba1(cliente)

  // === Crear PRUEBA-2 (al día) ===
  const prueba2 = await crearPrueba2(cliente)

  // === Resumen final ===
  console.log('\n' + '='.repeat(70))
  console.log('🎉🎉 AMBOS PRÉSTAMOS DE PRUEBA CREADOS EXITOSAMENTE')
  console.log('='.repeat(70))

  console.log('\n📋 RESUMEN COMPARATIVO:')
  console.log('─'.repeat(70))
  console.log('  PRÉSTAMO         |   PRUEBA-1                  |   PRUEBA-2')
  console.log('─'.repeat(70))
  console.log(`  Código           | ${prueba1.codigo}`)
  console.log(`                   | ${prueba2.codigo}`)
  console.log('─'.repeat(70))
  console.log(`  Estado           | EN_MORA                     | ACTIVO`)
  console.log(`  Cuotas totales   | 8                           | 6`)
  console.log(`  Cuotas pagadas   | 3 (1, 2, 3)                 | 3 (1, 2, 3)`)
  console.log(`  Cuota vencida    | 4 (12 días de mora)         | —`)
  console.log(`  Cuotas pendientes| 5 (4 VENCIDA + 5,6,7,8)     | 3 (4, 5, 6)`)
  console.log(`  Mora acumulada   | ${prueba1.montoMora ? '$' + prueba1.montoMora.toLocaleString('es-CO') : '$0'}`)
  console.log(`                   | $0`)
  console.log('─'.repeat(70))
  console.log(`  Tasa mensual     | 15%                         | 15%`)
  console.log(`  Tasa anual equiv.| 180%                        | 180%`)
  console.log(`  Tasa mora diaria | 0.4931%                     | 0.4931%`)
  console.log(`  Capital          | $500.000                    | $500.000`)
  console.log(`  Modalidad        | TASA_FIJA MENSUAL           | TASA_FIJA MENSUAL`)
  console.log('─'.repeat(70))
  console.log('  CARGOS ACTIVADOS (ambos):')
  console.log('    ✓ Fondo de Garantía 5%       ($25.000)')
  console.log('    ✓ Flexibilidad PREMIUM       ($34.900)')
  console.log('    ✓ Pagaré + Carta             ($19.900)')
  console.log('    ✓ Tarifa Uso Plataforma      ($4.900)')
  console.log('    ✓ Renovación Anticipada      ($9.900)')
  console.log('    ✓ Mora compuesta diaria      (activa)')
  console.log('    ✓ Total cargos iniciales:    $94.700')
  console.log('─'.repeat(70))

  console.log('\n📊 TRAZABILIDAD DE PAGOS:')
  console.log('  PRUEBA-1: 3 pagos históricos APLICADOS (cuotas 1, 2, 3) + cuota 4 VENCIDA con 12 días de mora')
  console.log('  PRUEBA-2: 3 pagos históricos APLICADOS (cuotas 1, 2, 3) — todos puntuales')

  console.log('\n🔔 NOTIFICACIONES CREADAS:')
  console.log('  PRUEBA-1: 1 notificación de MORA (cuota 4 vencida)')
  console.log('  PRUEBA-2: 1 notificación de RECORDATORIO (próxima cuota)')

  console.log('\n🏆 PASAPORTE DE CONFIANZA:')
  console.log('  PRUEBA-1: 1 novedad NEGATIVA detectada (Pago vencido - 12 días)')
  console.log('  PRUEBA-2: 1 novedad POSITIVA informada (Trayectoria al día)')

  console.log('\n💡 Ambos préstamos están visibles en el Portal del Cliente:')
  console.log('   - Sección "Créditos":')
  console.log('     • PRUEBA-1 con badge rojo "EN MORA"')
  console.log('     • PRUEBA-2 con badge verde "ACTIVO"')
  console.log('   - Sección "Próximos":')
  console.log('     • PRUEBA-1: cuota 4 VENCIDA resaltada + cuotas 5-8 programadas')
  console.log('     • PRUEBA-2: cuotas 4-6 programadas')
  console.log('   - Sección "Historial":')
  console.log('     • PRUEBA-1: 3 pagos aplicados + 1 vencida')
  console.log('     • PRUEBA-2: 3 pagos aplicados')
  console.log('   - Sección "Avisos":')
  console.log('     • PRUEBA-1: alerta de mora')
  console.log('     • PRUEBA-2: recordatorio de próxima cuota')
  console.log('   - "🏆 Pasaporte de Confianza":')
  console.log('     • PRUEBA-1: novedad negativa (vencido) + ofrecimiento de compromiso')
  console.log('     • PRUEBA-2: trayectoria al día, sin novedades negativas')
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
