// =====================================================
// 🧪 CREAR PRÉSTAMO "FONDO GARANTIA" — Revisión de Fondo de Garantía
// =====================================================
// Parámetros solicitados por el usuario:
//   - Nombre:           fondo garantia
//   - Capital:          $500.000
//   - Tasa mensual:     20%
//   - Cuotas:           2 mensuales
//   - Fondo Garantía:   SÍ (cobro activado)
//
// Salida:
//   - Préstamo ACTIVO, sin pagos realizados (solo cuotas programadas)
//   - fondoGarantiaCargado = true
//   - fondoGarantiaMonto   = 25.000  (5% de 500.000)
//   - fondoGarantiaTasa    = 0.05
//   - Las 2 cuotas en estado PROGRAMADO para que el usuario pueda revisar
//     el estado inicial del Fondo de Garantía en el portal.
//
// Uso:  node scripts/crear-prestamo-fondo-garantia.cjs [cedula]
//   (si no se pasa cédula, usa a Johan por defecto: 1214731649)
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
      // Última cuota: ajustar para que el saldo cierre en 0
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
  }
}

// === Limpiar préstamos previos con el código FONDO-GARANTIA ===
async function limpiarPrestamosPrevios(clienteId) {
  const previos = await prisma.prestamo.findMany({
    where: { codigo: { startsWith: 'FONDO-GARANTIA' }, clienteId },
    select: { id: true, codigo: true },
  })
  if (previos.length) {
    console.log(`\n🧹 Eliminando ${previos.length} préstamo(s) FONDO-GARANTIA previo(s)...`)
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

// =====================================================
// 🚀 FUNCIÓN PRINCIPAL
// =====================================================
async function main() {
  console.log('='.repeat(70))
  console.log('🧪 CREAR PRÉSTAMO "FONDO GARANTIA" — Revisión de Fondo de Garantía')
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

  // === Limpiar préstamos previos ===
  await limpiarPrestamosPrevios(cliente.id)

  // =====================================================
  // 📊 PARÁMETROS DEL PRÉSTAMO
  // =====================================================
  const MONTO = 500000
  const TASA_MENSUAL = 20 // 20% mensual
  const TASA_ANUAL_EQUIVALENTE = TASA_MENSUAL * 12 // 240% anual
  const TASA_MORA_ANUAL = TASA_ANUAL_EQUIVALENTE
  const TASA_MORA_DIARIA = TASA_MORA_ANUAL / 365 // 0.6575% diario
  const NUMERO_CUOTAS = 2
  const PLAZO_MESES = 2
  const FRECUENCIA = 'MENSUAL'

  // === Fondo de Garantía (cobro ACTIVADO) ===
  const FONDO_GARANTIA_TASA = 0.05 // 5%
  const fondoGarantiaMonto = Math.round(MONTO * FONDO_GARANTIA_TASA * 100) / 100 // 25.000

  // === Fecha de desembolso: hoy ===
  const hoy = new Date()
  hoy.setUTCHours(12, 0, 0, 0)
  const fechaDesembolso = new Date(hoy)

  console.log(`\n📅 Línea temporal:`)
  console.log(`  Hoy:                ${hoy.toISOString().slice(0, 10)}`)
  console.log(`  Fecha desembolso:   ${fechaDesembolso.toISOString().slice(0, 10)}`)
  console.log(`  Vto. cuota 1:       ${new Date(fechaDesembolso.getTime()).setMonth ? new Date(new Date(fechaDesembolso).setMonth(fechaDesembolso.getMonth() + 1)).toISOString().slice(0, 10) : ''}`)
  console.log(`  Vto. cuota 2:       ${new Date(new Date(fechaDesembolso).setMonth(fechaDesembolso.getMonth() + 2)).toISOString().slice(0, 10)}`)

  // === Cálculo del préstamo ===
  const calculo = calcularPrestamoTasaFijaMensual({
    montoPrincipal: MONTO,
    tasaMensualFija: TASA_MENSUAL,
    numeroCuotas: NUMERO_CUOTAS,
    frecuencia: FRECUENCIA,
    fechaDesembolso,
  })

  console.log(`\n📊 Cálculo del préstamo (TASA FIJA MENSUAL):`)
  console.log(`  Capital:                  $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual:             ${TASA_MENSUAL}%  (anual equivalente: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Tasa mora diaria:         ${TASA_MORA_DIARIA.toFixed(4)}%`)
  console.log(`  Plazo:                    ${PLAZO_MESES} meses (${calculo.numeroCuotas} cuotas ${FRECUENCIA.toLowerCase()})`)
  console.log(`  Cuota mensual:            $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés:            $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar:            $${calculo.totalPagar.toLocaleString('es-CO')}`)

  console.log(`\n💰 Fondo de Garantía (cobro ACTIVADO):`)
  console.log(`  Tasa aplicada:            ${FONDO_GARANTIA_TASA * 100}%`)
  console.log(`  Monto cobrado:            $${fondoGarantiaMonto.toLocaleString('es-CO')}`)
  console.log(`  Estado:                   ✓ CARGADO (fondoGarantiaCargado=true)`)

  console.log(`\n📅 Tabla de amortización:`)
  for (const c of calculo.tablaAmortizacion) {
    console.log(`   Cuota ${c.numero}/${calculo.numeroCuotas}: vence ${c.fechaVencimiento.toISOString().slice(0, 10)} — $${c.montoCuota.toLocaleString('es-CO')} (capital $${c.capital.toLocaleString('es-CO')} + interés $${c.interes.toLocaleString('es-CO')}, saldo $${c.saldoCapital.toLocaleString('es-CO')})`)
  }

  // === Generar código único ===
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  const codigo = `FONDO-GARANTIA-${yyyy}${mm}${dd}-${random}`

  // =====================================================
  // 💾 CREAR EL PRÉSTAMO
  // =====================================================
  console.log(`\n💾 Creando préstamo con código: ${codigo}`)

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
      // === ESTADO ACTIVO (al día, sin pagos aún) ===
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
      // === Saldos iniciales (0 cuotas pagadas) ===
      saldoCapital: MONTO,
      saldoInteres: calculo.totalInteres,
      saldoTotal: calculo.totalPagar,
      cuotasPagadas: 0,
      montoPagado: 0,
      // === Sin mora ===
      diasMora: 0,
      montoMora: 0,
      montoMoraAcumulado: 0,
      // ════════════════════════════════════════════════════
      // 🎯 FONDO DE GARANTÍA — COBRO ACTIVADO
      // ════════════════════════════════════════════════════
      fondoGarantiaCargado: true, // ✓ Marcado como cargado
      fondoGarantiaMonto: fondoGarantiaMonto, // $25.000
      fondoGarantiaTasa: FONDO_GARANTIA_TASA, // 0.05 (5%)
      // === Otros cobros desactivados para foco en Fondo Garantía ===
      flexibilidadFinanciera: false,
      flexibilidadCosto: 0,
      cobroPagareCarta: false,
      valorPagareCarta: 0,
      cobroTarifaPlataforma: false,
      valorTarifaPlataforma: 0,
      renovacionAnticipada: false,
      renovacionAnticipadaCosto: 0,
      // === Notas ===
      notas: `PRÉSTAMO DE REVISIÓN "FONDO GARANTIA" — Tasa 20% mensual, 2 cuotas.
Modalidad: TASA_FIJA MENSUAL.
Estado: ACTIVO (sin pagos aún, ambas cuotas PROGRAMADAS).
Fondo de Garantía ACTIVADO: tasa ${FONDO_GARANTIA_TASA * 100}%, monto $${fondoGarantiaMonto.toLocaleString('es-CO')}.
Demás cobros: desactivados para foco en la revisión del Fondo de Garantía.
Creado por script de prueba para revisión visual del Fondo de Garantía en el portal.`,
    },
  })

  console.log(`\n✅ Préstamo creado: ${nuevoPrestamo.codigo}`)
  console.log(`   ID: ${nuevoPrestamo.id}`)
  console.log(`   Estado: ${nuevoPrestamo.estado}`)
  console.log(`   Fondo Garantía cargado: ${nuevoPrestamo.fondoGarantiaCargado}`)
  console.log(`   Fondo Garantía monto: $${nuevoPrestamo.fondoGarantiaMonto.toLocaleString('es-CO')}`)
  console.log(`   Fondo Garantía tasa: ${(nuevoPrestamo.fondoGarantiaTasa * 100).toFixed(2)}%`)

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
        montoPagado: 0,
        moraCalculada: 0,
        diasMora: 0,
        fechaUltimaActualizacion: new Date(),
      },
    })
    console.log(`   Cuota ${cuota.numero}/${calculo.numeroCuotas}: vence ${cuota.fechaVencimiento.toISOString().slice(0, 10)} — $${cuota.montoCuota.toLocaleString('es-CO')} 📅 PROGRAMADA`)
  }

  // === Resumen final ===
  console.log('\n' + '='.repeat(70))
  console.log('🎉 PRÉSTAMO "FONDO GARANTIA" CREADO EXITOSAMENTE')
  console.log('='.repeat(70))
  console.log(`\n📋 RESUMEN:`)
  console.log(`  Cliente:            ${cliente.nombre} (CC ${cliente.cedula})`)
  console.log(`  Código:             ${nuevoPrestamo.codigo}`)
  console.log(`  Alias/Nombre:       fondo garantia`)
  console.log(`  Modalidad:          TASA_FIJA MENSUAL`)
  console.log(`  Capital:            $${MONTO.toLocaleString('es-CO')}`)
  console.log(`  Tasa mensual:       ${TASA_MENSUAL}%  (anual: ${TASA_ANUAL_EQUIVALENTE}%)`)
  console.log(`  Cuotas:             ${calculo.numeroCuotas} × $${calculo.montoCuota.toLocaleString('es-CO')}`)
  console.log(`  Total interés:      $${calculo.totalInteres.toLocaleString('es-CO')}`)
  console.log(`  Total a pagar:      $${calculo.totalPagar.toLocaleString('es-CO')}`)
  console.log(`  Estado:             ${nuevoPrestamo.estado}`)
  console.log(`  Cuotas pagadas:     0 (ambas PROGRAMADAS)`)
  console.log(`  Mora:               $0 (sin atrasos)`)
  console.log(`  Saldo pendiente:    $${calculo.totalPagar.toLocaleString('es-CO')}`)

  console.log(`\n💰 FONDO DE GARANTÍA (activo para revisión):`)
  console.log(`   fondoGarantiaCargado:  true`)
  console.log(`   fondoGarantiaMonto:    $${fondoGarantiaMonto.toLocaleString('es-CO')}  (5% de $${MONTO.toLocaleString('es-CO')})`)
  console.log(`   fondoGarantiaTasa:     ${(FONDO_GARANTIA_TASA * 100).toFixed(2)}%`)

  console.log(`\n💡 Puntos de revisión en el portal:`)
  console.log(`   - Sección "Créditos": préstamo con badge verde "ACTIVO"`)
  console.log(`   - Detalle del préstamo → bloque "Fondo de Garantía"`)
  console.log(`     · Monto: $${fondoGarantiaMonto.toLocaleString('es-CO')}`)
  console.log(`     · Badge: "✓ cargado"`)
  console.log(`   - Estado de cuenta: sección Fondo de Garantía visible`)
  console.log(`   - Simulador: el préstamo aparece con cálculo de fondo`)
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
