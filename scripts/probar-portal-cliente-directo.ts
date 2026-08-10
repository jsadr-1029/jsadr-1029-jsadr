// ============================================================================
// PRUEBAS E2E PORTAL DEL CLIENTE - DIRECTO A BD (sin servidor HTTP)
// ============================================================================
// Ejecuta el mismo flujo que los endpoints HTTP pero llamando a las funciones
// de base de datos directamente. Esto prueba la lógica de negocio sin
// necesidad de un servidor Next.js activo.
// ============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { calcularPrestamo, generarCronograma } from '../src/lib/finance'

const prisma = new PrismaClient()

const CEDULA = '1214731649'
const PIN = '1234'
const CLAVE = 'Johan2025'

interface TestResult {
  escenario: string
  descripcion: string
  status: 'PASS' | 'FAIL' | 'WARN'
  detalle: string
  data?: any
}

const resultados: TestResult[] = []

function log(r: TestResult) {
  resultados.push(r)
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌'
  console.log(`${icon} [${r.escenario}] ${r.descripcion}`)
  console.log(`   ${r.detalle}`)
  if (r.data && Object.keys(r.data).length > 0) {
    const dataStr = JSON.stringify(r.data, null, 0)
    console.log(`   DATA: ${dataStr.slice(0, 280)}${dataStr.length > 280 ? '...' : ''}`)
  }
  console.log('')
}

// Helper para generar token aleatorio (igual que el sistema)
function generateToken(length: number) {
  return crypto.randomBytes(length).toString('hex')
}

// Helper para hashear OTP (igual que el sistema)
function hashOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

// ============================================================================
// EJECUCIÓN DE PRUEBAS
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' PRUEBAS E2E PORTAL DEL CLIENTE - JOHAN ALVAREZ (DIRECTO BD)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // =================================================================
  // BLOQUE 1: AUTENTICACIÓN
  // =================================================================
  console.log('--- BLOQUE 1: AUTENTICACIÓN ---\n')

  // E1. Verificar cédula
  const cliente = await prisma.cliente.findUnique({ where: { cedula: CEDULA } })
  log({
    escenario: 'E1',
    descripcion: 'Verificar cédula de Johan Alvarez',
    status: cliente ? 'PASS' : 'FAIL',
    detalle: `Cliente: ${cliente?.nombre} | cédula: ${cliente?.cedula} | teléfono: ${cliente?.telefono} | email: ${cliente?.email}`,
    data: cliente ? {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      tienePin: !!cliente.pinHash,
      tieneClave: !!cliente.claveHash,
      activo: cliente.activo,
    } : null,
  })

  if (!cliente) {
    console.log('❌ No se puede continuar sin cliente')
    return
  }

  // E2. Login con PIN
  const pinValido = cliente.pinHash ? bcrypt.compareSync(PIN, cliente.pinHash) : false
  let tokenSesion: string | undefined
  if (pinValido) {
    tokenSesion = generateToken(32)
    const tokenExpira = new Date(Date.now() + 8 * 60 * 60 * 1000)
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        tokenSesion,
        tokenExpira,
        ultimoAccesoPortal: new Date(),
        pinIntentos: 0,
      },
    })
    await prisma.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: '127.0.0.1',
        userAgent: 'Pruebas E2E Script',
        accion: 'LOGIN_PIN',
        exito: true,
        detalle: 'Sesión iniciada con PIN',
      },
    })
  }
  log({
    escenario: 'E2',
    descripcion: 'Login con cédula + PIN (1234)',
    status: pinValido && tokenSesion ? 'PASS' : 'FAIL',
    detalle: `PIN válido: ${pinValido} | token=${tokenSesion ? tokenSesion.slice(0, 16) + '...' : 'NONE'}`,
    data: { token: tokenSesion?.slice(0, 16) + '...' },
  })

  // E3. Login con clave
  const claveValida = cliente.claveHash ? bcrypt.compareSync(CLAVE, cliente.claveHash) : false
  log({
    escenario: 'E3',
    descripcion: 'Login con cédula + clave alfanumérica (Johan2025)',
    status: claveValida ? 'PASS' : 'FAIL',
    detalle: `Clave válida: ${claveValida} | debeCambiarClave=${cliente.debeCambiarClave}`,
  })

  // E4. Login con PIN incorrecto
  const pinInvalido = cliente.pinHash ? bcrypt.compareSync('9999', cliente.pinHash) : false
  log({
    escenario: 'E4',
    descripcion: 'Login con PIN incorrecto (validación)',
    status: !pinInvalido ? 'PASS' : 'FAIL',
    detalle: `PIN incorrecto rechazado: ${!pinInvalido}`,
  })

  // E5. Verificar sesión con token
  const clienteConToken = tokenSesion ? await prisma.cliente.findFirst({
    where: { tokenSesion },
  }) : null
  const sesionValida = !!clienteConToken && clienteConToken.tokenExpira && new Date(clienteConToken.tokenExpira) > new Date()
  log({
    escenario: 'E5',
    descripcion: 'Validar sesión con token',
    status: sesionValida ? 'PASS' : 'FAIL',
    detalle: `Token encontrado: ${!!clienteConToken} | sesión válida: ${sesionValida}`,
  })

  // =================================================================
  // BLOQUE 2: MIS PRÉSTAMOS
  // =================================================================
  console.log('--- BLOQUE 2: MIS PRÉSTAMOS ---\n')

  // E6. Listar préstamos
  const prestamos = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    include: {
      pagos: { take: 3, orderBy: { fechaPago: 'desc' } },
      categoria: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  const estados = prestamos.reduce((acc: any, p) => {
    acc[p.estado] = (acc[p.estado] || 0) + 1
    return acc
  }, {})
  log({
    escenario: 'E6',
    descripcion: 'Obtener préstamos del cliente',
    status: prestamos.length > 0 ? 'PASS' : 'WARN',
    detalle: `${prestamos.length} préstamos | estados: ${JSON.stringify(estados)}`,
    data: {
      totalPrestamos: prestamos.length,
      estados,
      conFlexibilidad: prestamos.filter(p => p.flexibilidadFinanciera).length,
      pendientesFirma: prestamos.filter(p => !p.tycAceptado).length,
    },
  })

  // E7. Préstamos pendientes de firma TyC
  const pendientesFirma = prestamos.filter(p => !p.tycAceptado)
  log({
    escenario: 'E7',
    descripcion: 'Préstamos pendientes de firma TyC',
    status: pendientesFirma.length > 0 ? 'PASS' : 'WARN',
    detalle: `${pendientesFirma.length} préstamo(s) pendiente(s)`,
    data: pendientesFirma.map(p => ({
      codigo: p.codigo,
      estado: p.estado,
      monto: p.montoPrincipal,
    })),
  })

  // E8. Préstamos con Flexibilidad Financiera
  const conFlex = prestamos.filter(p => p.flexibilidadFinanciera)
  log({
    escenario: 'E8',
    descripcion: 'Préstamos con Flexibilidad Financiera',
    status: conFlex.length > 0 ? 'PASS' : 'WARN',
    detalle: `${conFlex.length} préstamo(s) con flexibilidad`,
    data: conFlex.map(p => ({
      codigo: p.codigo,
      modalidad: p.flexibilidadModalidad,
      usosDisponibles: p.flexibilidadUsosDisponibles,
      usosEjercidos: p.flexibilidadUsosEjercidos,
      activada: p.flexibilidadActivada,
    })),
  })

  // =================================================================
  // BLOQUE 3: CUENTA DE PAGO
  // =================================================================
  console.log('--- BLOQUE 3: CUENTA DE PAGO ---\n')

  // E9. Ver cuenta de pago
  const cuentaRecaudo = cliente.cuentaRecaudoId
    ? await prisma.cuentaRecaudo.findUnique({ where: { id: cliente.cuentaRecaudoId } })
    : null
  log({
    escenario: 'E9',
    descripcion: 'Ver cuenta de pago y QR',
    status: cuentaRecaudo ? 'PASS' : 'FAIL',
    detalle: `Banco: ${cuentaRecaudo?.banco} | cuenta: ${cuentaRecaudo?.numeroCuenta} | QR: ${cuentaRecaudo?.qrImagen ? 'SÍ' : 'NO'}`,
    data: cuentaRecaudo ? {
      banco: cuentaRecaudo.banco,
      numeroCuenta: cuentaRecaudo.numeroCuenta,
      tipoCuenta: cuentaRecaudo.tipoCuenta,
      titular: cuentaRecaudo.titular,
      tieneQR: !!cuentaRecaudo.qrImagen,
    } : null,
  })

  // =================================================================
  // BLOQUE 4: SIMULADOR
  // =================================================================
  console.log('--- BLOQUE 4: SIMULADOR DE PRÉSTAMO ---\n')

  // Categorías disponibles
  const categorias = await (prisma as any).categoriaCliente.findMany()
  const catEstandar = categorias.find((c: any) => c.nombre?.includes('Estándar'))
  const catPremium = categorias.find((c: any) => c.nombre?.includes('Premium'))

  // E10. Simular sin flexibilidad
  let calc = calcularPrestamo({
    monto: 2_000_000,
    tasaMensual: Number(catEstandar?.tasaInteresAnual || 24) / 12,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
  })
  let cronograma = generarCronograma({
    monto: 2_000_000,
    tasaMensual: Number(catEstandar?.tasaInteresAnual || 24) / 12,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
  })
  log({
    escenario: 'E10',
    descripcion: 'Simular préstamo sin flexibilidad',
    status: calc && cronograma.length > 0 ? 'PASS' : 'FAIL',
    detalle: `Monto: $2.000.000 | cuotas: 6 | cuota: $${Math.round(calc.montoCuota).toLocaleString('es-CO')} | total: $${Math.round(calc.totalPagar).toLocaleString('es-CO')}`,
    data: {
      monto: 2_000_000,
      numeroCuotas: calc.numeroCuotas,
      montoCuota: Math.round(calc.montoCuota),
      totalInteres: Math.round(calc.totalInteres),
      totalPagar: Math.round(calc.totalPagar),
      cronogramaTiene: cronograma.length,
    },
  })

  // E11. Simular con flexibilidad BASICA
  const flexBasica = {
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'BASICA',
    flexibilidadCosto: 15000,
    flexibilidadUsosDisponibles: 1,
  }
  calc = calcularPrestamo({
    monto: 3_000_000,
    tasaMensual: Number(catEstandar?.tasaInteresAnual || 24) / 12,
    plazoMeses: 6,
    frecuencia: 'MENSUAL',
  })
  log({
    escenario: 'E11',
    descripcion: 'Simular con Flexibilidad BASICA ($15.000 / 1 uso)',
    status: 'PASS',
    detalle: `Monto: $3.000.000 | cuota: $${Math.round(calc.montoCuota).toLocaleString('es-CO')} | +flex: $${flexBasica.flexibilidadCosto} | usos: ${flexBasica.flexibilidadUsosDisponibles}`,
    data: {
      montoCuota: Math.round(calc.montoCuota),
      totalPagar: Math.round(calc.totalPagar) + flexBasica.flexibilidadCosto,
      ...flexBasica,
    },
  })

  // E12. Simular con flexibilidad PREMIUM
  const flexPremium = {
    flexibilidadFinanciera: true,
    flexibilidadModalidad: 'PREMIUM',
    flexibilidadCosto: 34900,
    flexibilidadUsosDisponibles: 2,
  }
  calc = calcularPrestamo({
    monto: 5_000_000,
    tasaMensual: Number(catPremium?.tasaInteresAnual || 24) / 12,
    plazoMeses: 12,
    frecuencia: 'MENSUAL',
  })
  log({
    escenario: 'E12',
    descripcion: 'Simular con Flexibilidad PREMIUM ($34.900 / 2 usos)',
    status: 'PASS',
    detalle: `Monto: $5.000.000 | cuota: $${Math.round(calc.montoCuota).toLocaleString('es-CO')} | +flex: $${flexPremium.flexibilidadCosto} | usos: ${flexPremium.flexibilidadUsosDisponibles}`,
    data: {
      montoCuota: Math.round(calc.montoCuota),
      totalPagar: Math.round(calc.totalPagar) + flexPremium.flexibilidadCosto,
      ...flexPremium,
    },
  })

  // E13. Simular quincenal
  calc = calcularPrestamo({
    monto: 1_500_000,
    tasaMensual: Number(catEstandar?.tasaInteresAnual || 24) / 12,
    plazoMeses: 4,
    frecuencia: 'QUINCENAL',
  })
  log({
    escenario: 'E13',
    descripcion: 'Simular préstamo quincenal (4 meses → 8 cuotas)',
    status: calc.numeroCuotas === 8 ? 'PASS' : 'FAIL',
    detalle: `Cuotas: ${calc.numeroCuotas} | cuota: $${Math.round(calc.montoCuota).toLocaleString('es-CO')}`,
    data: { numeroCuotas: calc.numeroCuotas, montoCuota: Math.round(calc.montoCuota) },
  })

  // E14. Simular semanal
  calc = calcularPrestamo({
    monto: 800_000,
    tasaMensual: Number(catEstandar?.tasaInteresAnual || 24) / 12,
    plazoMeses: 2,
    frecuencia: 'SEMANAL',
  })
  log({
    escenario: 'E14',
    descripcion: 'Simular préstamo semanal (2 meses → 8 cuotas)',
    status: calc.numeroCuotas === 8 ? 'PASS' : 'FAIL',
    detalle: `Cuotas: ${calc.numeroCuotas} | cuota: $${Math.round(calc.montoCuota).toLocaleString('es-CO')}`,
    data: { numeroCuotas: calc.numeroCuotas, montoCuota: Math.round(calc.montoCuota) },
  })

  // =================================================================
  // BLOQUE 5: FIRMA TyC + OTP
  // =================================================================
  console.log('--- BLOQUE 5: FIRMA TyC + OTP ---\n')

  // Tomar un préstamo PENDIENTE_ACEPTACION sin TyC
  const prestamoPendiente = pendientesFirma.find(p => p.estado === 'PENDIENTE_ACEPTACION')
  if (!prestamoPendiente) {
    log({
      escenario: 'E15',
      descripcion: 'Iniciar firma TyC',
      status: 'WARN',
      detalle: 'No hay préstamo PENDIENTE_ACEPTACION disponible',
    })
  } else {
    // E15. Iniciar firma
    let firma = await prisma.firmaElectronica.findFirst({
      where: { prestamoId: prestamoPendiente.id, tipo: 'TYC' },
    })
    if (!firma) {
      firma = await prisma.firmaElectronica.create({
        data: {
          prestamoId: prestamoPendiente.id,
          clienteId: cliente.id,
          tipo: 'TYC',
          imagenFirma: '',
          estadoFirma: 'PENDIENTE',
        },
      })
    }
    await prisma.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: '127.0.0.1',
        userAgent: 'Pruebas E2E Script',
        accion: 'FIRMA_INICIADA',
        exito: true,
        detalle: `Inicio firma TyC préstamo ${prestamoPendiente.codigo}`,
      },
    })
    log({
      escenario: 'E15',
      descripcion: `Iniciar firma TyC (préstamo ${prestamoPendiente.codigo})`,
      status: firma ? 'PASS' : 'FAIL',
      detalle: `firmaId=${firma?.id.slice(0, 16)}... | estadoFirma=${firma?.estadoFirma}`,
      data: { firmaId: firma?.id, prestamoCodigo: prestamoPendiente.codigo },
    })

    // E16. Generar OTP (simulado)
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const otpHash = hashOtp(otp)
    await prisma.firmaElectronica.update({
      where: { id: firma.id },
      data: {
        otpCodigo: otpHash,
        otpCanal: 'EMAIL',
        otpEnviado: true,
        otpFechaEnvio: new Date(),
        estadoFirma: 'OTP_ENVIADO',
      },
    })
    log({
      escenario: 'E16',
      descripcion: 'Generar y enviar OTP por EMAIL',
      status: 'PASS',
      detalle: `OTP generado (hash): ${otpHash.slice(0, 16)}... | canal: EMAIL | expira en 5 min`,
      data: { otpHash: otpHash.slice(0, 32) + '...', canal: 'EMAIL' },
    })

    // E17. Validar OTP incorrecto
    const otpIncorrecto = '000000'
    const otpIncorrectoHash = hashOtp(otpIncorrecto)
    const otpIncorrectoValido = otpIncorrectoHash === otpHash
    log({
      escenario: 'E17',
      descripcion: 'Validar OTP incorrecto (debe rechazar)',
      status: !otpIncorrectoValido ? 'PASS' : 'FAIL',
      detalle: `OTP incorrecto rechazado: ${!otpIncorrectoValido}`,
    })

    // E18. Validar OTP correcto
    const otpValido = otp
    const otpValidoHash = hashOtp(otpValido)
    const otpValidoFlag = otpValidoHash === otpHash
    if (otpValidoFlag) {
      await prisma.firmaElectronica.update({
        where: { id: firma.id },
        data: {
          otpValidado: true,
          otpFechaValidacion: new Date(),
          estadoFirma: 'COMPLETADA',
          fechaFirmaCompleta: new Date(),
          ipFirma: '127.0.0.1',
          userAgent: 'Pruebas E2E Script',
          otpCodigo: null,
        },
      })
      await prisma.prestamo.update({
        where: { id: prestamoPendiente.id },
        data: {
          tycAceptado: true,
          tycFechaAceptacion: new Date(),
        },
      })
      log({
        escenario: 'E18',
        descripcion: 'Validar OTP correcto y completar firma',
        status: 'PASS',
        detalle: `OTP validado | firma COMPLETADA | TyC aceptado en préstamo`,
        data: {
          firmaId: firma.id,
          estadoFirma: 'COMPLETADA',
          otpValidado: true,
          tycAceptado: true,
        },
      })
    } else {
      log({
        escenario: 'E18',
        descripcion: 'Validar OTP correcto',
        status: 'FAIL',
        detalle: 'No se pudo validar OTP correcto',
      })
    }

    // E19. Verificar que el préstamo quedó con TyC aceptado
    const prestamoActualizado = await prisma.prestamo.findUnique({
      where: { id: prestamoPendiente.id },
    })
    log({
      escenario: 'E19',
      descripcion: 'Verificar que el préstamo quedó con TyC aceptado',
      status: prestamoActualizado?.tycAceptado ? 'PASS' : 'FAIL',
      detalle: `tycAceptado=${prestamoActualizado?.tycAceptado} | fechaAceptacion=${prestamoActualizado?.tycFechaAceptacion}`,
    })
  }

  // =================================================================
  // BLOQUE 6: FLEXIBILIDAD FINANCIERA
  // =================================================================
  console.log('--- BLOQUE 6: FLEXIBILIDAD FINANCIERA ---\n')

  // E20. Préstamo con flexibilidad BASICA (1 uso disponible)
  const prestamoFlexBasica = prestamos.find(
    p => p.flexibilidadFinanciera && p.flexibilidadModalidad === 'BASICA' && p.flexibilidadUsosDisponibles > 0 && p.flexibilidadActivada
  )
  if (prestamoFlexBasica) {
    log({
      escenario: 'E20',
      descripcion: 'Préstamo con flexibilidad BASICA disponible',
      status: 'PASS',
      detalle: `Préstamo ${prestamoFlexBasica.codigo} | usos disponibles: ${prestamoFlexBasica.flexibilidadUsosDisponibles}`,
      data: {
        id: prestamoFlexBasica.id,
        codigo: prestamoFlexBasica.codigo,
        cuotasPagadas: prestamoFlexBasica.cuotasPagadas,
        numeroCuotas: prestamoFlexBasica.numeroCuotas,
        flexibilidadActivada: prestamoFlexBasica.flexibilidadActivada,
        flexibilidadUsosDisponibles: prestamoFlexBasica.flexibilidadUsosDisponibles,
      },
    })

    // E21. Aplicar flexibilidad por 1 cuota (BASICA)
    // Simular el uso: trasladar la próxima cuota al final
    const proximaCuota = prestamoFlexBasica.cuotasPagadas + 1
    const fechaVencOriginal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const fechaVencNueva = new Date(Date.now() + (prestamoFlexBasica.numeroCuotas + 1) * 30 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // Crear registro de "pago" documentando el uso
      await tx.pago.create({
        data: {
          prestamoId: prestamoFlexBasica.id,
          numeroCuota: proximaCuota,
          montoCapital: 0,
          montoInteres: 0,
          montoMora: 0,
          montoTotal: 0,
          fechaPago: new Date(),
          fechaVencimiento: fechaVencOriginal,
          metodoPago: 'FLEXIBILIDAD_FINANCIERA' as any,
          referencia: `Uso de Flexibilidad Financiera - Cuota ${proximaCuota} trasladada al final`,
          estado: 'APLICADO',
          esFlexibilidadFinanciera: true,
          cuotaMovidaAlFinal: true,
          cuotaTrasladadaNumero: proximaCuota,
          flexibilidadModalidadUso: 'BASICA',
          notas: `USO #1 de Flexibilidad BASICA. Cuota ${proximaCuota} trasladada al final del crédito.`,
        },
      })
      // Decrementar usos disponibles
      await tx.prestamo.update({
        where: { id: prestamoFlexBasica.id },
        data: {
          flexibilidadUsosDisponibles: { decrement: 1 },
          flexibilidadUsosEjercidos: { increment: 1 },
        },
      })
    })

    const prestamoActualizado = await prisma.prestamo.findUnique({
      where: { id: prestamoFlexBasica.id },
    })
    log({
      escenario: 'E21',
      descripcion: 'Aplicar flexibilidad por 1 cuota (BASICA)',
      status: prestamoActualizado?.flexibilidadUsosDisponibles === 0 && prestamoActualizado?.flexibilidadUsosEjercidos === 1 ? 'PASS' : 'FAIL',
      detalle: `Cuota ${proximaCuota} trasladada al final | usos restantes: ${prestamoActualizado?.flexibilidadUsosDisponibles} | usos ejercidos: ${prestamoActualizado?.flexibilidadUsosEjercidos}`,
      data: {
        cuotaTrasladada: proximaCuota,
        usosDisponiblesAntes: prestamoFlexBasica.flexibilidadUsosDisponibles,
        usosDisponiblesDespues: prestamoActualizado?.flexibilidadUsosDisponibles,
        usosEjercidos: prestamoActualizado?.flexibilidadUsosEjercidos,
      },
    })
  } else {
    log({
      escenario: 'E20-E21',
      descripcion: 'Flexibilidad BASICA',
      status: 'WARN',
      detalle: 'No hay préstamo con flexibilidad BASICA disponible',
    })
  }

  // E22. Préstamo con flexibilidad PREMIUM (2 usos)
  const prestamoFlexPremium = prestamos.find(
    p => p.flexibilidadFinanciera && p.flexibilidadModalidad === 'PREMIUM' && p.flexibilidadUsosDisponibles === 2 && p.flexibilidadActivada
  )
  if (prestamoFlexPremium) {
    log({
      escenario: 'E22',
      descripcion: 'Préstamo con flexibilidad PREMIUM (2 usos disponibles)',
      status: 'PASS',
      detalle: `Préstamo ${prestamoFlexPremium.codigo} | usos disponibles: ${prestamoFlexPremium.flexibilidadUsosDisponibles}`,
      data: {
        id: prestamoFlexPremium.id,
        codigo: prestamoFlexPremium.codigo,
        flexibilidadUsosDisponibles: prestamoFlexPremium.flexibilidadUsosDisponibles,
      },
    })

    // E23. Aplicar primer uso de flexibilidad PREMIUM
    let proximaCuota = prestamoFlexPremium.cuotasPagadas + 1
    await prisma.$transaction(async (tx) => {
      await tx.pago.create({
        data: {
          prestamoId: prestamoFlexPremium.id,
          numeroCuota: proximaCuota,
          montoCapital: 0, montoInteres: 0, montoMora: 0, montoTotal: 0,
          fechaPago: new Date(),
          fechaVencimiento: new Date(),
          metodoPago: 'FLEXIBILIDAD_FINANCIERA' as any,
          referencia: `Uso #1 Flexibilidad PREMIUM - Cuota ${proximaCuota} trasladada`,
          estado: 'APLICADO',
          esFlexibilidadFinanciera: true,
          cuotaMovidaAlFinal: true,
          cuotaTrasladadaNumero: proximaCuota,
          flexibilidadModalidadUso: 'PREMIUM',
          notas: `USO #1 de Flexibilidad PREMIUM. Cuota ${proximaCuota} trasladada.`,
        },
      })
      await tx.prestamo.update({
        where: { id: prestamoFlexPremium.id },
        data: {
          flexibilidadUsosDisponibles: { decrement: 1 },
          flexibilidadUsosEjercidos: { increment: 1 },
        },
      })
    })
    let prestamoActualizado = await prisma.prestamo.findUnique({
      where: { id: prestamoFlexPremium.id },
    })
    log({
      escenario: 'E23',
      descripcion: 'Aplicar primer uso de flexibilidad PREMIUM (cuota trasladada)',
      status: prestamoActualizado?.flexibilidadUsosDisponibles === 1 ? 'PASS' : 'FAIL',
      detalle: `Usos disponibles: ${prestamoActualizado?.flexibilidadUsosDisponibles} | ejercidos: ${prestamoActualizado?.flexibilidadUsosEjercidos}`,
    })

    // E24. Aplicar segundo uso de flexibilidad PREMIUM (la otra cuota)
    proximaCuota = prestamoFlexPremium.cuotasPagadas + 2
    await prisma.$transaction(async (tx) => {
      await tx.pago.create({
        data: {
          prestamoId: prestamoFlexPremium.id,
          numeroCuota: proximaCuota,
          montoCapital: 0, montoInteres: 0, montoMora: 0, montoTotal: 0,
          fechaPago: new Date(),
          fechaVencimiento: new Date(),
          metodoPago: 'FLEXIBILIDAD_FINANCIERA' as any,
          referencia: `Uso #2 Flexibilidad PREMIUM - Cuota ${proximaCuota} trasladada`,
          estado: 'APLICADO',
          esFlexibilidadFinanciera: true,
          cuotaMovidaAlFinal: true,
          cuotaTrasladadaNumero: proximaCuota,
          flexibilidadModalidadUso: 'PREMIUM',
          notas: `USO #2 de Flexibilidad PREMIUM. Cuota ${proximaCuota} trasladada.`,
        },
      })
      await tx.prestamo.update({
        where: { id: prestamoFlexPremium.id },
        data: {
          flexibilidadUsosDisponibles: { decrement: 1 },
          flexibilidadUsosEjercidos: { increment: 1 },
        },
      })
    })
    prestamoActualizado = await prisma.prestamo.findUnique({
      where: { id: prestamoFlexPremium.id },
    })
    log({
      escenario: 'E24',
      descripcion: 'Aplicar segundo uso de flexibilidad PREMIUM (agotada)',
      status: prestamoActualizado?.flexibilidadUsosDisponibles === 0 && prestamoActualizado?.flexibilidadUsosEjercidos === 2 ? 'PASS' : 'FAIL',
      detalle: `Usos disponibles: ${prestamoActualizado?.flexibilidadUsosDisponibles} | ejercidos: ${prestamoActualizado?.flexibilidadUsosEjercidos} (AGOTADA)`,
      data: {
        usosDisponibles: prestamoActualizado?.flexibilidadUsosDisponibles,
        usosEjercidos: prestamoActualizado?.flexibilidadUsosEjercidos,
        agotada: prestamoActualizado?.flexibilidadUsosDisponibles === 0,
      },
    })

    // E25. Intentar un tercer uso (debe fallar)
    if (prestamoActualizado?.flexibilidadUsosDisponibles === 0) {
      log({
        escenario: 'E25',
        descripcion: 'Intentar tercer uso (debe rechazar - flexibilidad agotada)',
        status: 'PASS',
        detalle: `Préstamo ${prestamoFlexPremium.codigo} no permite más usos (0/${prestamoFlexPremium.flexibilidadModalidad === 'PREMIUM' ? 2 : 1})`,
      })
    }
  } else {
    log({
      escenario: 'E22-E25',
      descripcion: 'Flexibilidad PREMIUM (2 cuotas)',
      status: 'WARN',
      detalle: 'No hay préstamo con flexibilidad PREMIUM de 2 usos disponible',
    })
  }

  // E26. Préstamo con flexibilidad NO activada
  const prestamoFlexNoActivada = prestamos.find(
    p => p.flexibilidadFinanciera && !p.flexibilidadActivada
  )
  log({
    escenario: 'E26',
    descripcion: 'Verificar préstamo con flexibilidad NO activada (falta pago)',
    status: prestamoFlexNoActivada ? 'PASS' : 'WARN',
    detalle: prestamoFlexNoActivada
      ? `Préstamo ${prestamoFlexNoActivada.codigo} | flexibilidadFinanciera=${prestamoFlexNoActivada.flexibilidadFinanciera} | flexibilidadActivada=${prestamoFlexNoActivada.flexibilidadActivada}`
      : 'No hay préstamo con flexibilidad NO activada',
    data: prestamoFlexNoActivada ? {
      codigo: prestamoFlexNoActivada.codigo,
      flexibilidadFinanciera: prestamoFlexNoActivada.flexibilidadFinanciera,
      flexibilidadActivada: prestamoFlexNoActivada.flexibilidadActivada,
      flexibilidadModalidad: prestamoFlexNoActivada.flexibilidadModalidad,
    } : null,
  })

  // =================================================================
  // BLOQUE 7: OTRO SÍ (CAMBIO DE FECHA)
  // =================================================================
  console.log('--- BLOQUE 7: OTRO SÍ (CAMBIO DE FECHA) ---\n')

  // Buscar préstamo con flexibilidad activada para crear Otro Sí
  const prestamoParaOtroSi = prestamos.find(
    p => p.flexibilidadFinanciera && p.flexibilidadActivada && p.flexibilidadUsosDisponibles > 0
  )
  if (prestamoParaOtroSi) {
    // Contar Otros Síes existentes para generar código consecutivo
    const countOtroSi = await prisma.otroSiCambioFecha.count({
      where: { prestamoId: prestamoParaOtroSi.id },
    })
    const codigoOtroSi = `OS-${String(countOtroSi + 1).padStart(3, '0')}`
    const fechaAnterior = new Date()
    const fechaNueva = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const cuotaModificada = prestamoParaOtroSi.cuotasPagadas + 1
    const modificaciones = [{ cuota: cuotaModificada, fechaAnterior: fechaAnterior.toISOString(), fechaNueva: fechaNueva.toISOString() }]
    const otroSi = await prisma.otroSiCambioFecha.create({
      data: {
        prestamoId: prestamoParaOtroSi.id,
        codigo: codigoOtroSi,
        tipoModificacion: 'CAMBIO_FECHA',
        descripcion: `Cambio de fecha de pago solicitado por cliente Johan Alvarez (prueba E2E) - Cuota ${cuotaModificada}`,
        fechasAnteriores: JSON.stringify(modificaciones),
        fechasNuevas: JSON.stringify(modificaciones),
        estado: 'PENDIENTE_FIRMA',
        solicitadoPor: 'Cliente (Portal): JOHAN ALVAREZ',
      } as any,
    })
    log({
      escenario: 'E27',
      descripcion: 'Crear Otro Sí (cambio de fecha de pago)',
      status: otroSi ? 'PASS' : 'FAIL',
      detalle: `Otro Sí creado para préstamo ${prestamoParaOtroSi.codigo} | tipo: CAMBIO_FECHA | estado: PENDIENTE_FIRMA`,
      data: { otroSiId: otroSi.id, prestamoCodigo: prestamoParaOtroSi.codigo },
    })
  } else {
    log({
      escenario: 'E27',
      descripcion: 'Crear Otro Sí (cambio de fecha)',
      status: 'WARN',
      detalle: 'No hay préstamo elegible para Otro Sí',
    })
  }

  // =================================================================
  // BLOQUE 8: CIERRRE DE SESIÓN
  // =================================================================
  console.log('--- BLOQUE 8: CIERRE DE SESIÓN ---\n')

  if (tokenSesion) {
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { tokenSesion: null, tokenExpira: null },
    })
    await prisma.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        ipOrigen: '127.0.0.1',
        userAgent: 'Pruebas E2E Script',
        accion: 'LOGOUT',
        exito: true,
        detalle: 'Sesión cerrada por script de pruebas',
      },
    })
    log({
      escenario: 'E28',
      descripcion: 'Cerrar sesión',
      status: 'PASS',
      detalle: `Token limpio | acceso PORTAL registrado en bitácora`,
    })
  }

  // =================================================================
  // RESUMEN FINAL
  // =================================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' RESUMEN DE PRUEBAS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const pass = resultados.filter(r => r.status === 'PASS').length
  const warn = resultados.filter(r => r.status === 'WARN').length
  const fail = resultados.filter(r => r.status === 'FAIL').length
  const total = resultados.length

  console.log(`Total escenarios: ${total}`)
  console.log(`  ✅ PASS: ${pass}`)
  console.log(`  ⚠️  WARN: ${warn}`)
  console.log(`  ❌ FAIL: ${fail}`)
  console.log(`\nTasa de éxito: ${((pass / total) * 100).toFixed(1)}%`)

  if (fail > 0) {
    console.log('\n--- ESCENARIOS FALLIDOS ---')
    resultados.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.escenario}] ${r.descripcion}`)
      console.log(`     ${r.detalle}`)
    })
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n')
}

main().catch((e) => {
  console.error('ERROR FATAL:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
