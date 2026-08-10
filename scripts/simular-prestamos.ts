// =====================================================
// SIMULACIÓN — Crear préstamos de prueba para Johan Alvarez
// =====================================================
// Este script crea múltiples préstamos en distintos estados
// para probar TODOS los escenarios del sistema:
//
// 1. SOLICITUD (recién creado, sin aprobar)
// 2. PENDIENTE_ACEPTACION (aprobado, esperando T&C del cliente)
// 3. ACTIVO (desembolsado, al día)
// 4. ACTIVO con pagos parciales (algunas cuotas pagadas)
// 5. EN_MORA (con pagos vencidos)
// 6. EN_MORA con mora renegociada
// 7. JURIDICO (derivado a cobro jurídico)
// 8. CANCELADO (pagado completamente)
// 9. RECHAZADO (solicitud rechazada)
// 10. Con codeudor
// 11. Con Flexibilidad Financiera activada
// 12. Con "Solo Intereses" (pago diferido)
//
// Cada préstamo acepta los T&C y firma electrónicamente,
// completando el flujo completo hasta la firma de documentos.
// =====================================================

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const db = new PrismaClient()

// Cédula del cliente de simulación
const CEDULA_CLIENTE = '1214731649'

// =====================================================
// Helpers
// =====================================================
function genCodigoPrestamo(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PRES-${ts}-${rand}`
}

function calcularCuota(montoPrincipal: number, tasaInteresAnual: number, plazoMeses: number): {
  montoCuota: number
  totalInteres: number
  totalPagar: number
  tasaMoraDiaria: number
} {
  // Sistema francés: cuota fija
  // i = tasa mensual = tasaAnual / 12 / 100
  const i = tasaInteresAnual / 12 / 100
  const n = plazoMeses
  const cuota = montoPrincipal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
  const totalPagar = cuota * n
  const totalInteres = totalPagar - montoPrincipal
  // Tasa moratoria diaria: 1.5% mensual / 30 = 0.05% diario
  const tasaMoraDiaria = 1.5 / 30

  return {
    montoCuota: Math.round(cuota),
    totalInteres: Math.round(totalInteres),
    totalPagar: Math.round(totalPagar),
    tasaMoraDiaria,
  }
}

function generarFechasCuotas(
  fechaInicio: Date,
  numeroCuotas: number,
  frecuencia: 'MENSUAL' | 'QUINCENAL' | 'SEMANAL'
): Date[] {
  const fechas: Date[] = []
  const intervaloDias = frecuencia === 'MENSUAL' ? 30 : frecuencia === 'QUINCENAL' ? 15 : 7

  for (let i = 1; i <= numeroCuotas; i++) {
    const fecha = new Date(fechaInicio)
    fecha.setDate(fecha.getDate() + (intervaloDias * i))
    fechas.push(fecha)
  }
  return fechas
}

async function crearFirmaElectronica(
  prestamoId: string,
  clienteId: string,
  tipo: string,
  estado: string,
  fechaFirma?: Date
) {
  return await db.firmaElectronica.create({
    data: {
      prestamoId,
      clienteId,
      tipo, // PAGARE | CARTA | TYC | OTRO_SI
      imagenFirma: 'simulacion-firma-base64-placeholder',
      estadoFirma: estado === 'FIRMADO' ? 'COMPLETADA' : 'PENDIENTE',
      ipFirma: '127.0.0.1',
      userAgent: 'Simulacion/1.0',
      otpValidado: estado === 'FIRMADO',
      otpEnviado: estado === 'FIRMADO',
      otpCanal: estado === 'FIRMADO' ? 'EMAIL' : null,
      otpFechaEnvio: estado === 'FIRMADO' ? (fechaFirma || new Date()) : null,
      otpFechaValidacion: estado === 'FIRMADO' ? (fechaFirma || new Date()) : null,
      fechaFirmaCompleta: estado === 'FIRMADO' ? (fechaFirma || new Date()) : null,
      fechaSubidaFotos: estado === 'FIRMADO' ? (fechaFirma || new Date()) : null,
      firmanteRol: 'DEUDOR',
      firmanteNombre: 'JOHAN ALVAREZ',
      firmanteCedula: '1214731649',
    },
  })
}

async function crearPagos(
  prestamoId: string,
  montoCuota: number,
  montoPrincipal: number,
  totalInteres: number,
  numeroCuotas: number,
  frecuencia: 'MENSUAL' | 'QUINCENAL' | 'SEMANAL',
  fechaInicio: Date,
  opciones?: {
    cuotasPagadas?: number
    cuotasVencidas?: number
    cuotasConMora?: number
    diasMora?: number
    esSoloIntereses?: boolean
  }
) {
  const fechas = generarFechasCuotas(fechaInicio, numeroCuotas, frecuencia)
  const interesPorCuota = totalInteres / numeroCuotas
  const capitalPorCuota = montoPrincipal / numeroCuotas

  const pagos: any[] = []
  for (let i = 0; i < numeroCuotas; i++) {
    const numeroCuota = i + 1
    const fechaVencimiento = fechas[i]
    const ahora = new Date()

    let estado = 'PENDIENTE'
    let fechaPago: Date | null = null
    let montoMora = 0

    const cuotasPagadas = opciones?.cuotasPagadas || 0
    const cuotasVencidas = opciones?.cuotasVencidas || 0
    const diasMora = opciones?.diasMora || 0

    if (numeroCuota <= cuotasPagadas) {
      estado = 'APLICADO'
      // Fecha de pago = 2 días antes del vencimiento
      fechaPago = new Date(fechaVencimiento)
      fechaPago.setDate(fechaPago.getDate() - 2)
    } else if (numeroCuota <= cuotasPagadas + cuotasVencidas) {
      estado = 'VENCIDO'
      montoMora = Math.round(montoCuota * 0.05 * diasMora) // 5% diario simulado, capped
    }

    // Si es solo intereses, capital se difiere
    const esSoloIntereses = opciones?.esSoloIntereses && numeroCuota === cuotasPagadas + 1

    const pago = await db.pago.create({
      data: {
        prestamoId,
        numeroCuota,
        montoCapital: esSoloIntereses ? 0 : capitalPorCuota,
        montoInteres: interesPorCuota,
        montoMora,
        montoTotal: esSoloIntereses ? interesPorCuota : montoCuota + montoMora,
        fechaPago,
        fechaVencimiento,
        metodoPago: estado === 'APLICADO' ? 'TRANSFERENCIA' : 'EFECTIVO',
        estado,
        esSoloIntereses: !!esSoloIntereses,
        createdAt: new Date(),
      },
    })
    pagos.push(pago)
  }

  return pagos
}

// =====================================================
// Crear un préstamo completo
// =====================================================
async function crearPrestamo(params: {
  clienteId: string
  categoriaId: string
  cuentaRecaudoId: string
  montoPrincipal: number
  tasaInteresAnual: number
  plazoMeses: number
  frecuencia: 'MENSUAL' | 'QUINCENAL' | 'SEMANAL'
  estado: string
  modalidadAmortizacion?: string
  tieneCodeudor?: boolean
  generarPagare?: boolean
  generarCarta?: boolean
  flexibilidadFinanciera?: boolean
  flexibilidadModalidad?: 'BASICA' | 'PREMIUM'
  fondoGarantia?: boolean
  cobroPagareCarta?: boolean
  cobroTarifaPlataforma?: boolean
  fechaSolicitud?: Date
  diasMora?: number
  cuotasPagadas?: number
  cuotasVencidas?: number
  moraRenegociada?: number
  moraRenegociadaAccion?: 'ANULADA' | 'NEGOCIADA'
  notasSimulacion: string
}) {
  const calc = calcularCuota(params.montoPrincipal, params.tasaInteresAnual, params.plazoMeses)
  const fechaSolicitud = params.fechaSolicitud || new Date()
  const codigo = genCodigoPrestamo()

  // Fechas según estado
  let fechaAprobacion: Date | null = null
  let fechaDesembolso: Date | null = null
  let fechaVencimiento: Date | null = null
  let tycAceptado = false
  let tycFechaAceptacion: Date | null = null

  if (params.estado !== 'SOLICITUD' && params.estado !== 'RECHAZADO') {
    fechaAprobacion = new Date(fechaSolicitud)
    fechaAprobacion.setDate(fechaAprobacion.getDate() + 1)
  }

  if (params.estado === 'PENDIENTE_ACEPTACION') {
    tycAceptado = false
  } else if (['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO'].includes(params.estado)) {
    tycAceptado = true
    tycFechaAceptacion = new Date(fechaAprobacion!)
    tycFechaAceptacion.setHours(tycFechaAceptacion.getHours() + 2)
    fechaDesembolso = new Date(tycFechaAceptacion)
    fechaDesembolso.setHours(fechaDesembolso.getHours() + 1)
    // Vencimiento = plazoMeses después del desembolso
    fechaVencimiento = new Date(fechaDesembolso)
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + params.plazoMeses)
  }

  // Calcular saldo según estado
  let cuotasPagadas = 0
  let montoPagado = 0
  let saldoCapital = params.montoPrincipal
  let saldoInteres = calc.totalInteres
  let saldoTotal = calc.totalPagar
  let montoMora = 0
  let diasMora = 0

  if (params.estado === 'ACTIVO' || params.estado === 'EN_MORA' || params.estado === 'JURIDICO') {
    cuotasPagadas = params.cuotasPagadas || Math.floor(params.plazoMeses / 3)
    montoPagado = cuotasPagadas * calc.montoCuota
    saldoCapital = params.montoPrincipal - (cuotasPagadas * (params.montoPrincipal / params.plazoMeses))
    saldoInteres = calc.totalInteres - (cuotasPagadas * (calc.totalInteres / params.plazoMeses))
    saldoTotal = saldoCapital + saldoInteres
  } else if (params.estado === 'CANCELADO') {
    cuotasPagadas = params.plazoMeses
    montoPagado = calc.totalPagar
    saldoCapital = 0
    saldoInteres = 0
    saldoTotal = 0
  }

  if (params.estado === 'EN_MORA' || params.estado === 'JURIDICO') {
    diasMora = params.diasMora || 30
    montoMora = Math.round(calc.montoCuota * 0.05 * diasMora)
    saldoTotal += montoMora
  }

  // Crear préstamo
  const prestamo = await db.prestamo.create({
    data: {
      codigo,
      clienteId: params.clienteId,
      categoriaId: params.categoriaId,
      montoPrincipal: params.montoPrincipal,
      tasaInteresAnual: params.tasaInteresAnual,
      tasaInteresMensual: params.tasaInteresAnual / 12,
      tasaMoraDiaria: calc.tasaMoraDiaria,
      plazoMeses: params.plazoMeses,
      frecuencia: params.frecuencia,
      numeroCuotas: params.plazoMeses,
      montoCuota: calc.montoCuota,
      totalInteres: calc.totalInteres,
      totalPagar: calc.totalPagar,
      tasaAplicada: params.tasaInteresAnual,
      modalidadAmortizacion: params.modalidadAmortizacion || 'FRANCES',
      moraCompuestaDiaria: true,
      montoMoraAcumulado: montoMora,
      moraRenegociada: params.moraRenegociada,
      moraRenegociadaAccion: params.moraRenegociadaAccion,
      moraRenegociadaFecha: params.moraRenegociada ? new Date() : null,
      fechaSolicitud,
      fechaAprobacion,
      fechaDesembolso,
      fechaVencimiento,
      estado: params.estado,
      tycEnviado: params.estado !== 'SOLICITUD',
      tycAceptado,
      tycFechaAceptacion,
      metodoConfirmacion: params.estado !== 'SOLICITUD' ? 'LINK' : null,
      requiereDocumentos: true,
      generarPagare: params.generarPagare ?? true,
      generarCarta: params.generarCarta ?? true,
      tieneCodeudor: params.tieneCodeudor || false,
      codeudorNombre: params.tieneCodeudor ? 'CODEUDOR SIMULACIÓN' : null,
      codeudorCedula: params.tieneCodeudor ? '99999999' : null,
      codeudorTelefono: params.tieneCodeudor ? '3000000000' : null,
      codeudorEmail: params.tieneCodeudor ? 'codeudor@test.com' : null,
      codeudorDireccion: params.tieneCodeudor ? 'Dirección prueba' : null,
      saldoCapital,
      saldoInteres,
      saldoTotal,
      cuotasPagadas,
      montoPagado,
      montoMora,
      diasMora,
      fondoGarantiaCargado: params.fondoGarantia ?? false,
      fondoGarantiaMonto: params.fondoGarantia ? params.montoPrincipal * 0.05 : 0,
      fondoGarantiaTasa: params.fondoGarantia ? 0.05 : 0,
      flexibilidadFinanciera: params.flexibilidadFinanciera ?? false,
      flexibilidadCosto: params.flexibilidadFinanciera
        ? (params.flexibilidadModalidad === 'PREMIUM' ? 34900 : 15000)
        : 0,
      flexibilidadModalidad: params.flexibilidadFinanciera ? params.flexibilidadModalidad : null,
      flexibilidadUsosDisponibles: params.flexibilidadFinanciera
        ? (params.flexibilidadModalidad === 'PREMIUM' ? 2 : 1)
        : 0,
      flexibilidadActivada: params.flexibilidadFinanciera ?? false,
      flexibilidadFechaActivacion: params.flexibilidadFinanciera ? new Date() : null,
      cobroPagareCarta: params.cobroPagareCarta ?? true,
      valorPagareCarta: 19900,
      cobroTarifaPlataforma: params.cobroTarifaPlataforma ?? true,
      valorTarifaPlataforma: 4900,
      notas: `[SIMULACIÓN] ${params.notasSimulacion}`,
    },
  })

  // Crear pagos si el préstamo está activo/en mora/jurídico/cancelado
  if (['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO'].includes(params.estado) && fechaDesembolso) {
    const cuotasPagadasCount =
      params.estado === 'CANCELADO' ? params.plazoMeses : (params.cuotasPagadas || Math.floor(params.plazoMeses / 3))
    const cuotasVencidasCount =
      params.estado === 'EN_MORA' || params.estado === 'JURIDICO' ? 2 : 0

    await crearPagos(
      prestamo.id,
      calc.montoCuota,
      params.montoPrincipal,
      calc.totalInteres,
      params.plazoMeses,
      params.frecuencia,
      fechaDesembolso,
      {
        cuotasPagadas: cuotasPagadasCount,
        cuotasVencidas: cuotasVencidasCount,
        diasMora: params.diasMora || 30,
      }
    )
  }

  // Crear firma electrónica si el préstamo está activo o más avanzado
  if (['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO'].includes(params.estado)) {
    await crearFirmaElectronica(prestamo.id, params.clienteId, 'PAGARE', 'FIRMADO', fechaDesembolso || undefined)
    await crearFirmaElectronica(prestamo.id, params.clienteId, 'CARTA', 'FIRMADO', fechaDesembolso || undefined)
    await crearFirmaElectronica(prestamo.id, params.clienteId, 'TYC', 'FIRMADO', tycFechaAceptacion || undefined)
  } else if (params.estado === 'PENDIENTE_ACEPTACION') {
    await crearFirmaElectronica(prestamo.id, params.clienteId, 'TYC', 'PENDIENTE')
  }

  // Crear caso jurídico si aplica
  if (params.estado === 'JURIDICO') {
    await db.casoJuridico.create({
      data: {
        prestamoId: prestamo.id,
        estado: 'PRE_JUDICIAL',
        fechaApertura: new Date(),
        descripcion: `Caso jurídico simulado — Préstamo ${codigo} con ${diasMora} días de mora`,
        valorReclamado: saldoTotal,
        tipoProceso: 'EJECUTIVO',
      },
    })
  }

  return prestamo
}

// =====================================================
// MAIN
// =====================================================
async function main() {
  console.log('=== SIMULACIÓN DE PRÉSTAMOS ===\n')

  // Buscar cliente Johan Alvarez
  const cliente = await db.cliente.findUnique({
    where: { cedula: CEDULA_CLIENTE },
  })
  if (!cliente) {
    throw new Error(`Cliente con cédula ${CEDULA_CLIENTE} no encontrado`)
  }
  console.log(`Cliente: ${cliente.nombre} (${cliente.cedula})`)
  console.log(`ID: ${cliente.id}\n`)

  // Obtener categorías y cuenta
  const categorias = await db.categoriaCliente.findMany()
  const cuentas = await db.cuentaRecaudo.findMany({ where: { activa: true } })
  const cat1 = categorias.find((c) => c.codigo === 'CAT-1')!
  const cat2 = categorias.find((c) => c.codigo === 'CAT-2')!
  const cat3 = categorias.find((c) => c.codigo === 'CAT-3')!
  const cat4 = categorias.find((c) => c.codigo === 'CAT-4')!
  const cta1 = cuentas[0]
  const cta2 = cuentas[1]
  const cta3 = cuentas[2]
  const cta4 = cuentas[3]

  // Verificar que no haya préstamos existentes
  const prestamosExistentes = await db.prestamo.count({ where: { clienteId: cliente.id } })
  if (prestamosExistentes > 0) {
    console.log(`⚠️  El cliente ya tiene ${prestamosExistentes} préstamos. Se crearán igualmente nuevos préstamos de simulación.`)
  }

  const simulaciones: any[] = []

  // 1. SOLICITUD — Recién creado, sin aprobar
  console.log('\n1. Creando préstamo en estado SOLICITUD...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 2000000,
    tasaInteresAnual: 22,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
    estado: 'SOLICITUD',
    notasSimulacion: 'Préstamo recién solicitado, esperando aprobación del gestor',
  }))
  console.log(`   ✓ ${simulaciones[0].codigo}`)

  // 2. PENDIENTE_ACEPTACION — Aprobado, esperando T&C del cliente
  console.log('\n2. Creando préstamo en estado PENDIENTE_ACEPTACION...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 1500000,
    tasaInteresAnual: 22,
    plazoMeses: 4,
    frecuencia: 'MENSUAL',
    estado: 'PENDIENTE_ACEPTACION',
    notasSimulacion: 'Préstamo aprobado, esperando que el cliente acepte T&C y firme',
  }))
  console.log(`   ✓ ${simulaciones[1].codigo}`)

  // 3. ACTIVO — Desembolsado, al día
  console.log('\n3. Creando préstamo en estado ACTIVO (al día)...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 3000000,
    tasaInteresAnual: 22,
    plazoMeses: 12,
    frecuencia: 'MENSUAL',
    estado: 'ACTIVO',
    cuotasPagadas: 3,
    notasSimulacion: 'Préstamo activo al día, 3 cuotas pagadas de 12',
  }))
  console.log(`   ✓ ${simulaciones[2].codigo}`)

  // 4. ACTIVO con pagos parciales — Varias cuotas pagadas
  console.log('\n4. Creando préstamo ACTIVO con pagos parciales...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat3.id,
    cuentaRecaudoId: cta3.id,
    montoPrincipal: 5000000,
    tasaInteresAnual: 26,
    plazoMeses: 24,
    frecuencia: 'MENSUAL',
    estado: 'ACTIVO',
    cuotasPagadas: 10,
    notasSimulacion: 'Préstamo activo con 10 cuotas pagadas de 24',
  }))
  console.log(`   ✓ ${simulaciones[3].codigo}`)

  // 5. EN_MORA — Con pagos vencidos
  console.log('\n5. Creando préstamo EN_MORA...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 2500000,
    tasaInteresAnual: 22,
    plazoMeses: 8,
    frecuencia: 'MENSUAL',
    estado: 'EN_MORA',
    cuotasPagadas: 2,
    diasMora: 30,
    notasSimulacion: 'Préstamo en mora con 30 días, 2 cuotas vencidas',
  }))
  console.log(`   ✓ ${simulaciones[4].codigo}`)

  // 6. EN_MORA con mora renegociada (ANULADA)
  console.log('\n6. Creando préstamo EN_MORA con mora ANULADA...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 1800000,
    tasaInteresAnual: 22,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
    estado: 'EN_MORA',
    cuotasPagadas: 1,
    diasMora: 45,
    moraRenegociada: 0,
    moraRenegociadaAccion: 'ANULADA',
    notasSimulacion: 'Préstamo en mora con mora ANULADA por acuerdo con el cliente',
  }))
  console.log(`   ✓ ${simulaciones[5].codigo}`)

  // 7. EN_MORA con mora renegociada (NEGOCIADA)
  console.log('\n7. Creando préstamo EN_MORA con mora NEGOCIADA...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat3.id,
    cuentaRecaudoId: cta3.id,
    montoPrincipal: 4000000,
    tasaInteresAnual: 26,
    plazoMeses: 10,
    frecuencia: 'MENSUAL',
    estado: 'EN_MORA',
    cuotasPagadas: 3,
    diasMora: 60,
    moraRenegociada: 50000,
    moraRenegociadaAccion: 'NEGOCIADA',
    notasSimulacion: 'Préstamo en mora con mora NEGOCIADA a $50.000',
  }))
  console.log(`   ✓ ${simulaciones[6].codigo}`)

  // 8. JURIDICO — Derivado a cobro jurídico
  console.log('\n8. Creando préstamo JURIDICO...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat3.id,
    cuentaRecaudoId: cta3.id,
    montoPrincipal: 6000000,
    tasaInteresAnual: 26,
    plazoMeses: 12,
    frecuencia: 'MENSUAL',
    estado: 'JURIDICO',
    cuotasPagadas: 2,
    diasMora: 90,
    notasSimulacion: 'Préstamo derivado a cobro jurídico con 90 días de mora',
  }))
  console.log(`   ✓ ${simulaciones[7].codigo}`)

  // 9. CANCELADO — Pagado completamente
  console.log('\n9. Creando préstamo CANCELADO (pagado)...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat1.id,
    cuentaRecaudoId: cta1.id,
    montoPrincipal: 500000,
    tasaInteresAnual: 240,
    plazoMeses: 4,
    frecuencia: 'MENSUAL',
    estado: 'CANCELADO',
    notasSimulacion: 'Préstamo cancelado — todas las cuotas pagadas',
  }))
  console.log(`   ✓ ${simulaciones[8].codigo}`)

  // 10. RECHAZADO — Solicitud rechazada
  console.log('\n10. Creando préstamo RECHAZADO...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 1000000,
    tasaInteresAnual: 22,
    plazoMeses: 3,
    frecuencia: 'MENSUAL',
    estado: 'RECHAZADO',
    notasSimulacion: 'Préstamo rechazado por el gestor',
  }))
  console.log(`   ✓ ${simulaciones[9].codigo}`)

  // 11. ACTIVO con codeudor
  console.log('\n11. Creando préstamo ACTIVO con codeudor...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat3.id,
    cuentaRecaudoId: cta3.id,
    montoPrincipal: 8000000,
    tasaInteresAnual: 26,
    plazoMeses: 18,
    frecuencia: 'MENSUAL',
    estado: 'ACTIVO',
    tieneCodeudor: true,
    cuotasPagadas: 5,
    notasSimulacion: 'Préstamo activo con codeudor, 5 cuotas pagadas de 18',
  }))
  console.log(`   ✓ ${simulaciones[10].codigo}`)

  // 12. ACTIVO con Flexibilidad Financiera PREMIUM
  console.log('\n12. Creando préstamo ACTIVO con Flexibilidad Financiera PREMIUM...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat3.id,
    cuentaRecaudoId: cta3.id,
    montoPrincipal: 4500000,
    tasaInteresAnual: 26,
    plazoMeses: 12,
    frecuencia: 'QUINCENAL',
    estado: 'ACTIVO',
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'PREMIUM',
    cuotasPagadas: 4,
    notasSimulacion: 'Préstamo con Flexibilidad Financiera PREMIUM activada, 4 cuotas pagadas de 12 (24 quincenas)',
  }))
  console.log(`   ✓ ${simulaciones[11].codigo}`)

  // 13. ACTIVO con frecuencia SEMANAL y modalidad OTRO
  console.log('\n13. Creando préstamo ACTIVO con frecuencia SEMANAL y modalidad OTRO...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat1.id,
    cuentaRecaudoId: cta1.id,
    montoPrincipal: 800000,
    tasaInteresAnual: 240,
    plazoMeses: 8,
    frecuencia: 'SEMANAL',
    estado: 'ACTIVO',
    modalidadAmortizacion: 'OTRO',
    cuotasPagadas: 6,
    notasSimulacion: 'Préstamo semanal con modalidad OTRO, 6 cuotas pagadas de 8',
  }))
  console.log(`   ✓ ${simulaciones[12].codigo}`)

  // 14. ACTIVO con categoría EJECUTIVA (CAT-4) — préstamo grande
  console.log('\n14. Creando préstamo ACTIVO CATEGORÍA EJECUTIVA...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat4.id,
    cuentaRecaudoId: cta4.id,
    montoPrincipal: 20000000,
    tasaInteresAnual: 30,
    plazoMeses: 24,
    frecuencia: 'MENSUAL',
    estado: 'ACTIVO',
    cuotasPagadas: 8,
    notasSimulacion: 'Préstamo categoría EJECUTIVA $20M, 8 cuotas pagadas de 24',
  }))
  console.log(`   ✓ ${simulaciones[13].codigo}`)

  // 15. ACTIVO sin fondo de garantía (exento)
  console.log('\n15. Creando préstamo ACTIVO sin fondo de garantía...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 2200000,
    tasaInteresAnual: 22,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
    estado: 'ACTIVO',
    fondoGarantia: false,
    cuotasPagadas: 2,
    notasSimulacion: 'Préstamo sin cobro de fondo de garantía (exento)',
  }))
  console.log(`   ✓ ${simulaciones[14].codigo}`)

  // 16. EN_MORA con días de mora alto (casi jurídico)
  console.log('\n16. Creando préstamo EN_MORA con 75 días (casi jurídico)...')
  simulaciones.push(await crearPrestamo({
    clienteId: cliente.id,
    categoriaId: cat2.id,
    cuentaRecaudoId: cta2.id,
    montoPrincipal: 2700000,
    tasaInteresAnual: 22,
    plazoMeses: 9,
    frecuencia: 'MENSUAL',
    estado: 'EN_MORA',
    cuotasPagadas: 1,
    diasMora: 75,
    notasSimulacion: 'Préstamo en mora severa, 75 días (próximo a derivar a jurídico)',
  }))
  console.log(`   ✓ ${simulaciones[15].codigo}`)

  // === RESUMEN ===
  console.log('\n=== RESUMEN DE SIMULACIONES ===')
  console.log(`Total préstamos creados: ${simulaciones.length}`)
  for (const p of simulaciones) {
    console.log(`  ${p.codigo} — ${p.estado} — $${p.montoPrincipal.toLocaleString('es-CO')} — ${p.plazoMeses} ${p.frecuencia.toLowerCase()}s`)
  }

  // Estadísticas finales
  const totalPrestamos = await db.prestamo.count({ where: { clienteId: cliente.id } })
  const totalPagos = await db.pago.count({
    where: { prestamo: { clienteId: cliente.id } },
  })
  const totalFirmas = await db.firmaElectronica.count({
    where: { clienteId: cliente.id },
  })
  const totalCasosJuridicos = await db.casoJuridico.count({
    where: { prestamo: { clienteId: cliente.id } },
  })

  console.log('\n=== ESTADÍSTICAS DEL CLIENTE ===')
  console.log(`Préstamos: ${totalPrestamos}`)
  console.log(`Pagos: ${totalPagos}`)
  console.log(`Firmas electrónicas: ${totalFirmas}`)
  console.log(`Casos jurídicos: ${totalCasosJuridicos}`)
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
