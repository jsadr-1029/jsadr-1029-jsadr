// ============================================================================
// PREPARAR PORTAL CLIENTE PARA JOHAN ALVAREZ
// ============================================================================
// Objetivo: Dejar listo a Johan Alvarez para probar TODOS los escenarios del
// portal del cliente. Esto incluye:
//
//   1. Asignar PIN (1234) y clave (Johan2025) al cliente
//   2. Asignar cuenta de recaudo con QR generado
//   3. Crear préstamos faltantes para escenarios de Flexibilidad Financiera:
//      - BASICA sin usar (1 uso disponible)
//      - PREMIUM con 1 uso ejercido (1 disponible de 2)
//      - PREMIUM agotada (0 disponibles de 2)
//      - PENDIENTE_ACEPTACION sin TyC (para probar firma)
//   4. Marcar préstamos existentes que no tienen TyC aceptado pero están en
//      estados activos (para probar el flujo de firma TyC)
//
// El cliente podrá entonces:
//   - Hacer login con cédula 1214731649 + PIN 1234
//   - Ver préstamos en distintos estados
//   - Simular nuevos préstamos
//   - Firmar TyC (con OTP y firma manuscrita)
//   - Aplicar flexibilidad financiera
//   - Solicitar Otro Sí (cambio de fecha)
// ============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateToken } from '../src/lib/format'

const prisma = new PrismaClient()

const CEDULA = '1214731649'
const PIN = '1234'
const CLAVE = 'Johan2025'

async function main() {
  console.log('=== PREPARACIÓN PORTAL CLIENTE - JOHAN ALVAREZ ===\n')

  // 1. Buscar cliente
  const cliente = await prisma.cliente.findUnique({ where: { cedula: CEDULA } })
  if (!cliente) {
    console.log('❌ Johan Alvarez no existe')
    return
  }
  console.log(`✅ Cliente: ${cliente.nombre} (cc ${cliente.cedula})`)

  // 2. Asignar PIN y clave
  console.log('\n--- Configurando credenciales ---')
  const pinHash = bcrypt.hashSync(PIN, 10)
  const claveHash = bcrypt.hashSync(CLAVE, 10)

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      pinHash,
      pinCreatedAt: new Date(),
      pinIntentos: 0,
      pinBloqueadoHasta: null,
      claveHash,
      claveCreatedAt: new Date(),
      claveIntentos: 0,
      claveBloqueadoHasta: null,
      debeCambiarClave: false, // ya tiene clave configurada
      activo: true,
    },
  })
  console.log(`  ✅ PIN: ${PIN}`)
  console.log(`  ✅ Clave: ${CLAVE}`)

  // 3. Asignar cuenta de recaudo (Bancolombia - titular Johan Alvarez)
  console.log('\n--- Asignando cuenta de recaudo ---')
  const cuenta = await prisma.cuentaRecaudo.findFirst({
    where: { banco: { contains: 'Bancolombia' }, titular: { contains: 'Johan' } },
  })
  if (cuenta) {
    // Generar QR simple (data URL con el número de cuenta)
    const qrData = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cuenta.numeroCuenta)}`
    await prisma.cuentaRecaudo.update({
      where: { id: cuenta.id },
      data: { qrImagen: qrData },
    })
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { cuentaRecaudoId: cuenta.id },
    })
    console.log(`  ✅ Cuenta asignada: ${cuenta.banco} ${cuenta.numeroCuenta}`)
    console.log(`  ✅ QR generado`)
  } else {
    console.log('  ⚠️  No se encontró cuenta Bancolombia con titular Johan')
  }

  // 4. Crear préstamos para escenarios de flexibilidad faltantes
  console.log('\n--- Creando préstamos para escenarios de flexibilidad ---')

  // Obtener categoría Estándar y Premium
  const catEstandar = await (prisma as any).categoriaCliente.findFirst({
    where: { nombre: { contains: 'Estándar' } },
  })
  const catPremium = await (prisma as any).categoriaCliente.findFirst({
    where: { nombre: { contains: 'Premium' } } as any,
  })
  console.log(`  Categoría Estándar: ${catEstandar?.id}`)
  console.log(`  Categoría Premium: ${catPremium?.id}`)

  // ----- Escenario A: Préstamo ACTIVO con Flexibilidad BÁSICA (1 uso disponible) -----
  const prestamoFlexBasica = await crearPrestamoFlexibilidad({
    cliente,
    categoria: catEstandar,
    codigoSuffix: 'FLEX-BASICA',
    montoPrincipal: 3_000_000,
    numeroCuotas: 6,
    frecuencia: 'MENSUAL',
    tasaInteresMensual: 0.0183,
    cuotasPagadas: 2,
    flexibilidadModalidad: 'BASICA',
    flexibilidadUsosDisponibles: 1,
    flexibilidadUsosEjercidos: 0,
    flexibilidadCosto: 15_000,
    estado: 'ACTIVO',
  })
  console.log(`  ✅ Préstamo BASICA: ${prestamoFlexBasica.codigo} (1 uso disponible)`)

  // ----- Escenario B: Préstamo ACTIVO con Flexibilidad PREMIUM (1 uso ejercido, 1 disponible) -----
  const prestamoFlexPremium1 = await crearPrestamoFlexibilidad({
    cliente,
    categoria: catPremium,
    codigoSuffix: 'FLEX-PREMIUM-1',
    montoPrincipal: 4_500_000,
    numeroCuotas: 12,
    frecuencia: 'MENSUAL',
    tasaInteresMensual: 0.0217,
    cuotasPagadas: 3,
    flexibilidadModalidad: 'PREMIUM',
    flexibilidadUsosDisponibles: 1, // ya usó 1
    flexibilidadUsosEjercidos: 1,
    flexibilidadCosto: 34_900,
    estado: 'ACTIVO',
  })
  console.log(`  ✅ Préstamo PREMIUM (1 uso ya ejercido): ${prestamoFlexPremium1.codigo}`)

  // ----- Escenario C: Préstamo ACTIVO con Flexibilidad PREMIUM AGOTADA (0 usos disponibles) -----
  const prestamoFlexPremiumAgotada = await crearPrestamoFlexibilidad({
    cliente,
    categoria: catPremium,
    codigoSuffix: 'FLEX-PREMIUM-AGOTADA',
    montoPrincipal: 5_500_000,
    numeroCuotas: 10,
    frecuencia: 'MENSUAL',
    tasaInteresMensual: 0.0217,
    cuotasPagadas: 5,
    flexibilidadModalidad: 'PREMIUM',
    flexibilidadUsosDisponibles: 0, // agotada
    flexibilidadUsosEjercidos: 2,
    flexibilidadCosto: 34_900,
    estado: 'ACTIVO',
  })
  console.log(`  ✅ Préstamo PREMIUM (agotada): ${prestamoFlexPremiumAgotada.codigo}`)

  // ----- Escenario D: Préstamo PENDIENTE_ACEPTACION sin TyC (para probar firma) -----
  const prestamoPendienteFirma = await crearPrestamoFlexibilidad({
    cliente,
    categoria: catEstandar,
    codigoSuffix: 'PEND-FIRMA',
    montoPrincipal: 1_800_000,
    numeroCuotas: 4,
    frecuencia: 'MENSUAL',
    tasaInteresMensual: 0.0183,
    cuotasPagadas: 0,
    flexibilidadModalidad: null,
    flexibilidadUsosDisponibles: 0,
    flexibilidadUsosEjercidos: 0,
    flexibilidadCosto: 0,
    estado: 'PENDIENTE_ACEPTACION',
    sinTyC: true,
    sinFirmas: true,
  })
  console.log(`  ✅ Préstamo PENDIENTE_ACEPTACION (sin TyC ni firmas): ${prestamoPendienteFirma.codigo}`)

  // ----- Escenario E: Préstamo ACTIVO con flexibilidad BASICA pero NO activada (falta pago) -----
  const prestamoFlexNoActivada = await crearPrestamoFlexibilidad({
    cliente,
    categoria: catEstandar,
    codigoSuffix: 'FLEX-NO-ACTIVADA',
    montoPrincipal: 2_500_000,
    numeroCuotas: 8,
    frecuencia: 'MENSUAL',
    tasaInteresMensual: 0.0183,
    cuotasPagadas: 1,
    flexibilidadModalidad: 'BASICA',
    flexibilidadUsosDisponibles: 1,
    flexibilidadUsosEjercidos: 0,
    flexibilidadCosto: 15_000,
    estado: 'ACTIVO',
    flexibilidadActivada: false, // NO activada (falta pago)
  })
  console.log(`  ✅ Préstamo con Flexibilidad NO activada: ${prestamoFlexNoActivada.codigo}`)

  console.log('\n=== RESUMEN CONFIGURACIÓN ===')
  console.log(`  Cliente: ${cliente.nombre} | cc: ${cliente.cedula}`)
  console.log(`  PIN: ${PIN}`)
  console.log(`  Clave: ${CLAVE}`)
  console.log(`  Cuenta de recaudo: ${cuenta?.banco} ${cuenta?.numeroCuenta}`)
  console.log(`  Préstamos nuevos:`)
  console.log(`    - ${prestamoFlexBasica.codigo} | BASICA (1 uso disponible)`)
  console.log(`    - ${prestamoFlexPremium1.codigo} | PREMIUM (1 de 2 usos disponibles)`)
  console.log(`    - ${prestamoFlexPremiumAgotada.codigo} | PREMIUM (agotada, 2/2 usos)`)
  console.log(`    - ${prestamoPendienteFirma.codigo} | PENDIENTE_ACEPTACION sin TyC`)
  console.log(`    - ${prestamoFlexNoActivada.codigo} | BASICA no activada`)
}

// =====================================================
// Helper: crear préstamo con flexibilidad
// =====================================================
async function crearPrestamoFlexibilidad(opts: {
  cliente: any
  categoria: any
  codigoSuffix: string
  montoPrincipal: number
  numeroCuotas: number
  frecuencia: string
  tasaInteresMensual: number
  cuotasPagadas: number
  flexibilidadModalidad: string | null
  flexibilidadUsosDisponibles: number
  flexibilidadUsosEjercidos: number
  flexibilidadCosto: number
  estado: string
  flexibilidadActivada?: boolean
  sinTyC?: boolean
  sinFirmas?: boolean
}) {
  const now = new Date()
  const fechaDesembolso = new Date(now)
  fechaDesembolso.setDate(fechaDesembolso.getDate() - (opts.cuotasPagadas * 30 + 10))

  // Calcular cuota mensual simple (igual al sistema)
  const tasaMes = opts.tasaInteresMensual
  const cuotaBase = opts.montoPrincipal * (tasaMes * Math.pow(1 + tasaMes, opts.numeroCuotas)) / (Math.pow(1 + tasaMes, opts.numeroCuotas) - 1)
  const totalInteres = cuotaBase * opts.numeroCuotas - opts.montoPrincipal
  const totalPagar = cuotaBase * opts.numeroCuotas
  const saldoTotal = totalPagar - (cuotaBase * opts.cuotasPagadas)
  const montoPagado = cuotaBase * opts.cuotasPagadas

  // Generar código único
  const codigo = `PRES-PORTAL-${opts.codigoSuffix}-${Date.now().toString(36).toUpperCase().slice(-6)}`

  const prestamo = await prisma.prestamo.create({
    data: {
      codigo,
      clienteId: opts.cliente.id,
      categoriaId: opts.categoria?.id || null,
      montoPrincipal: opts.montoPrincipal,
      montoCuota: Math.round(cuotaBase),
      numeroCuotas: opts.numeroCuotas,
      cuotasPagadas: opts.cuotasPagadas,
      plazoMeses: opts.frecuencia === 'MENSUAL' ? opts.numeroCuotas : Math.ceil(opts.numeroCuotas / 2),
      frecuencia: opts.frecuencia,
      tasaInteresMensual: opts.tasaInteresMensual,
      tasaInteresAnual: opts.tasaInteresMensual * 12,
      tasaMoraDiaria: opts.tasaInteresMensual * 0.5, // tasa mora default
      tasaAplicada: opts.tasaInteresMensual,
      montoPagado: Math.round(montoPagado),
      saldoTotal: Math.round(saldoTotal),
      saldoCapital: Math.round(opts.montoPrincipal - (cuotaBase - totalInteres / opts.numeroCuotas) * opts.cuotasPagadas),
      totalInteres: Math.round(totalInteres),
      totalPagar: Math.round(totalPagar),
      estado: opts.estado as any,
      fechaDesembolso,
      fechaVencimiento: new Date(now.getTime() + (opts.numeroCuotas - opts.cuotasPagadas) * 30 * 24 * 60 * 60 * 1000),
      tycAceptado: !opts.sinTyC,
      tycFechaAceptacion: opts.sinTyC ? null : new Date(fechaDesembolso.getTime() + 24 * 60 * 60 * 1000),
      // Flexibilidad financiera
      flexibilidadFinanciera: !!opts.flexibilidadModalidad,
      flexibilidadActivada: opts.flexibilidadActivada !== false && !!opts.flexibilidadModalidad,
      flexibilidadModalidad: opts.flexibilidadModalidad,
      flexibilidadUsosDisponibles: opts.flexibilidadUsosDisponibles,
      flexibilidadUsosEjercidos: opts.flexibilidadUsosEjercidos,
      flexibilidadCosto: opts.flexibilidadCosto,
      flexibilidadFechaActivacion: opts.flexibilidadActivada !== false && opts.flexibilidadModalidad ? new Date(fechaDesembolso.getTime() + 48 * 60 * 60 * 1000) : null,
      // Otros
      notas: `Préstamo creado automáticamente para pruebas de portal — escenario ${opts.codigoSuffix}`,
    },
  })

  // Crear pagos para simular cuotas pagadas
  for (let i = 1; i <= opts.cuotasPagadas; i++) {
    const fechaPago = new Date(fechaDesembolso.getTime() + i * 30 * 24 * 60 * 60 * 1000)
    const fechaVenc = new Date(fechaDesembolso.getTime() + i * 30 * 24 * 60 * 60 * 1000)
    await prisma.pago.create({
      data: {
        prestamoId: prestamo.id,
        numeroCuota: i,
        montoCapital: Math.round((cuotaBase - totalInteres / opts.numeroCuotas)),
        montoInteres: Math.round(totalInteres / opts.numeroCuotas),
        montoMora: 0,
        montoTotal: Math.round(cuotaBase),
        fechaPago,
        fechaVencimiento: fechaVenc,
        metodoPago: 'PSE',
        referencia: `PAGO-CUOTA-${i}`,
        estado: 'APLICADO',
      },
    })
  }

  // Crear pagos programados para las cuotas restantes
  for (let i = opts.cuotasPagadas + 1; i <= opts.numeroCuotas; i++) {
    const fechaVenc = new Date(fechaDesembolso.getTime() + i * 30 * 24 * 60 * 60 * 1000)
    const estaVencido = fechaVenc < now
    await (prisma as any).pagoProgramado.create({
      data: {
        prestamoId: prestamo.id,
        numeroCuota: i,
        montoCuota: Math.round(cuotaBase),
        montoCapital: Math.round((cuotaBase - totalInteres / opts.numeroCuotas)),
        montoInteres: Math.round(totalInteres / opts.numeroCuotas),
        fechaVencimiento: fechaVenc,
        estado: estaVencido ? 'VENCIDO' : 'PENDIENTE',
        saldoCapitalDespues: Math.round(opts.montoPrincipal - (cuotaBase - totalInteres / opts.numeroCuotas) * i),
      },
    })
  }

  // Crear firmas si NO se especifica sinFirmas
  if (!opts.sinFirmas) {
    const tipos = ['PAGARE', 'CARTA_INSTRUCCIONES', 'TYC'] as const
    // Nota: el modelo usa 'tipo' (PAGARE | CONTRATO | ACUERDO_PAGO | TYC),
    // pero guardamos el tipo original en imagenFirma como metadata ya que
    // CARTA_INSTRUCCIONES no es válido. Usamos 'CONTRATO' para CARTA.
    const tipoMap: Record<string, string> = {
      PAGARE: 'PAGARE',
      CARTA_INSTRUCCIONES: 'CONTRATO',
      TYC: 'TYC',
    }
    for (const tipoOriginal of tipos) {
      await prisma.firmaElectronica.create({
        data: {
          prestamoId: prestamo.id,
          tipo: tipoMap[tipoOriginal],
          imagenFirma: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          otpEnviado: true,
          otpValidado: true,
          otpCodigo: '123456',
          otpCanal: 'EMAIL',
          otpFechaEnvio: new Date(fechaDesembolso.getTime() + 23 * 60 * 60 * 1000),
          otpFechaValidacion: new Date(fechaDesembolso.getTime() + 24 * 60 * 60 * 1000),
          ipFirma: '127.0.0.1',
          userAgent: 'Pruebas Portal Script',
          estadoFirma: 'COMPLETADA',
          fechaSubidaFotos: new Date(fechaDesembolso.getTime() + 22 * 60 * 60 * 1000),
          fechaFirmaCompleta: new Date(fechaDesembolso.getTime() + 24 * 60 * 60 * 1000),
          firmanteRol: 'DEUDOR',
          firmanteNombre: opts.cliente.nombre,
          firmanteCedula: opts.cliente.cedula,
        },
      })
    }
  }

  // Si tiene flexibilidad y ya tiene usos ejercidos, crear registros de uso
  if (opts.flexibilidadUsosEjercidos > 0) {
    for (let i = 1; i <= opts.flexibilidadUsosEjercidos; i++) {
      const cuotaTrasladada = opts.cuotasPagadas + i
      await prisma.pago.create({
        data: {
          prestamoId: prestamo.id,
          numeroCuota: cuotaTrasladada,
          montoCapital: 0,
          montoInteres: 0,
          montoMora: 0,
          montoTotal: 0,
          fechaPago: new Date(fechaDesembolso.getTime() + (opts.cuotasPagadas + i) * 30 * 24 * 60 * 60 * 1000),
          fechaVencimiento: new Date(fechaDesembolso.getTime() + (opts.cuotasPagadas + i) * 30 * 24 * 60 * 60 * 1000),
          metodoPago: 'FLEXIBILIDAD_FINANCIERA' as any,
          referencia: `Uso Flexibilidad #${i} - Cuota ${cuotaTrasladada} trasladada al final`,
          estado: 'APLICADO',
          esFlexibilidadFinanciera: true,
          cuotaMovidaAlFinal: true,
          cuotaTrasladadaNumero: cuotaTrasladada,
          flexibilidadModalidadUso: opts.flexibilidadModalidad || 'BASICA',
          notas: `USO #${i} de Flexibilidad ${opts.flexibilidadModalidad}. Cuota ${cuotaTrasladada} trasladada al final del crédito.`,
        },
      })
    }
  }

  return prestamo
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
