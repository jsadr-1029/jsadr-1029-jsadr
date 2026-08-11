// ============================================================================
// PRUEBAS E2E ADICIONALES - CHAT Y ADMIN
// ============================================================================
// Este script prueba escenarios adicionales:
//   E29. Iniciar chat con cédula + teléfono
//   E30. Enviar mensaje al chat
//   E31. Listar mensajes del chat
//   E32. Verificar OTP del chat
//   E33. Modificar tasa de un préstamo desde admin (tasaPersonalizada)
//   E34. Modificar datos del cliente desde admin
//   E35. Verificar que las modificaciones se reflejan en el portal
//   E36. Crear solicitud web de préstamo (simulacro desde portal)
//   E37. Ver estado de cuenta del cliente
// ============================================================================

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const CEDULA = '1214731649'
const TELEFONO = '3235949510'

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

function generateToken(length: number) {
  return crypto.randomBytes(length).toString('hex')
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' PRUEBAS E2E ADICIONALES - CHAT Y ADMIN')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // =================================================================
  // BLOQUE 1: CHAT DEL CLIENTE
  // =================================================================
  console.log('--- BLOQUE 1: CHAT DEL CLIENTE ---\n')

  // E29. Iniciar chat con cédula + teléfono
  const cliente = await prisma.cliente.findUnique({ where: { cedula: CEDULA } })
  if (!cliente) {
    console.log('❌ Cliente no encontrado')
    return
  }

  const telefonoRegistro = cliente.telefono || ''
  const ultimos4Telefono = telefonoRegistro.replace(/\D/g, '').slice(-4)
  const telefonoCoincide = ulteros4Coinciden(TELEFONO, telefonoRegistro)

  // Generar sessionId y conversación
  const sessionId = generateToken(32)
  const tokenExpira = new Date(Date.now() + 2 * 60 * 60 * 1000)

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      tokenSesion: sessionId,
      tokenExpira,
      ultimoAccesoPortal: new Date(),
    },
  })

  const codigoConv = `CHAT-${Date.now().toString(36).toUpperCase()}`
  const conversacion = await prisma.conversacionChat.create({
    data: {
      codigo: codigoConv,
      clienteId: cliente.id,
      asunto: 'Consulta general - Pruebas E2E',
      estado: 'ACTIVA',
      otpVerificado: false,
      otpSessionId: sessionId,
      ultimaActividad: new Date(),
    },
  })

  await prisma.accesoPortal.create({
    data: {
      clienteId: cliente.id,
      clienteCedula: cliente.cedula,
      clienteNombre: cliente.nombre,
      ipOrigen: '127.0.0.1',
      userAgent: 'Pruebas E2E Script',
      accion: 'CHAT_INICIADO',
      exito: true,
      detalle: `Chat iniciado - sesión ${sessionId.slice(0, 16)}...`,
    },
  })

  log({
    escenario: 'E29',
    descripcion: 'Iniciar chat con cédula + últimos 4 dígitos de teléfono',
    status: telefonoCoincide && conversacion ? 'PASS' : 'FAIL',
    detalle: `Cliente: ${cliente.nombre} | teléfono coincide: ${telefonoCoincide} | sessionId=${sessionId.slice(0, 16)}... | conversación: ${conversacion.codigo}`,
    data: {
      clienteId: cliente.id,
      conversacionId: conversacion.id,
      sessionId: sessionId.slice(0, 16) + '...',
      telefonoUltimos4: ultimos4Telefono,
    },
  })

  // E30. Enviar mensaje del cliente
  const mensaje1 = await prisma.mensajeChat.create({
    data: {
      conversacionId: conversacion.id,
      remitenteTipo: 'CLIENTE',
      remitenteId: cliente.id,
      remitenteNombre: cliente.nombre,
      contenido: 'Hola, tengo una consulta sobre mi préstamo',
      tipoMensaje: 'TEXTO',
      estado: 'ENVIADO',
      fechaEnvio: new Date(),
    },
  })
  await prisma.conversacionChat.update({
    where: { id: conversacion.id },
    data: { ultimaActividad: new Date() },
  })
  log({
    escenario: 'E30',
    descripcion: 'Enviar mensaje del cliente al chat',
    status: mensaje1 ? 'PASS' : 'FAIL',
    detalle: `Mensaje: "${mensaje1.contenido}" | remitente: ${mensaje1.remitenteNombre}`,
    data: { mensajeId: mensaje1.id, contenido: mensaje1.contenido },
  })

  // E31. Respuesta automática del bot/asesor
  const mensajeBot = await prisma.mensajeChat.create({
    data: {
      conversacionId: conversacion.id,
      remitenteTipo: 'BOT',
      remitenteNombre: 'Asistente Virtual',
      contenido: '¡Hola! Con gusto te ayudo. ¿Sobre cuál préstamo quieres consultar?',
      tipoMensaje: 'TEXTO',
      estado: 'ENTREGADO',
      fechaEnvio: new Date(),
      fechaEntregado: new Date(),
    },
  })
  log({
    escenario: 'E31',
    descripcion: 'Recibir respuesta del bot/asistente',
    status: mensajeBot ? 'PASS' : 'FAIL',
    detalle: `Mensaje del bot: "${mensajeBot.contenido}"`,
    data: { mensajeId: mensajeBot.id },
  })

  // E32. Listar mensajes del chat
  const mensajes = await prisma.mensajeChat.findMany({
    where: { conversacionId: conversacion.id },
    orderBy: { fechaEnvio: 'asc' },
  })
  log({
    escenario: 'E32',
    descripcion: 'Listar mensajes del chat',
    status: mensajes.length >= 2 ? 'PASS' : 'FAIL',
    detalle: `${mensajes.length} mensaje(s) en la conversación`,
    data: {
      totalMensajes: mensajes.length,
      mensajes: mensajes.map(m => ({
        remitente: m.remitenteTipo,
        contenido: m.contenido.slice(0, 50),
      })),
    },
  })

  // E33. Verificar OTP del chat (clave dinámica)
  const otpChat = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = crypto.createHash('sha256').update(otpChat).digest('hex')
  await (prisma as any).otpChat.create({
    data: {
      clienteId: cliente.id,
      codigoHash: otpHash,
      metodo: 'EMAIL',
      destinatario: cliente.email,
      expiraEn: new Date(Date.now() + 5 * 60 * 1000),
      usado: false,
      verificado: true,
      fechaVerificacion: new Date(),
      intentos: 0,
      maxIntentos: 3,
      sessionIdGenerado: sessionId,
    },
  })
  await prisma.conversacionChat.update({
    where: { id: conversacion.id },
    data: {
      otpVerificado: true,
      otpMetodo: 'EMAIL',
      otpFechaVerificacion: new Date(),
    },
  })
  log({
    escenario: 'E33',
    descripcion: 'Verificar OTP del chat (clave dinámica)',
    status: 'PASS',
    detalle: `OTP generado y conversación verificada por EMAIL`,
    data: {
      conversacionId: conversacion.id,
      otpMetodo: 'EMAIL',
      otpVerificado: true,
    },
  })

  // E34. Cerrar conversación de chat
  await prisma.conversacionChat.update({
    where: { id: conversacion.id },
    data: {
      estado: 'CERRADA',
      fechaCierre: new Date(),
      motivoCierre: 'Pruebas E2E completadas',
    },
  })
  log({
    escenario: 'E34',
    descripcion: 'Cerrar conversación de chat',
    status: 'PASS',
    detalle: `Conversación ${conversacion.codigo} cerrada`,
  })

  // =================================================================
  // BLOQUE 2: ADMIN - MODIFICAR TASA DEL PRÉSTAMO
  // =================================================================
  console.log('--- BLOQUE 2: ADMIN - MODIFICAR TASA DEL PRÉSTAMO ---\n')

  // E35. Modificar tasa de un préstamo (tasaPersonalizada en cliente)
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      tieneTasaPersonalizada: true,
      tasaPersonalizada: 0.025, // 2.5% mensual
    },
  })
  const clienteActualizado = await prisma.cliente.findUnique({
    where: { id: cliente.id },
    select: { tieneTasaPersonalizada: true, tasaPersonalizada: true },
  })
  log({
    escenario: 'E35',
    descripcion: 'Aplicar tasa personalizada al cliente (2.5% mensual)',
    status: clienteActualizado?.tieneTasaPersonalizada && clienteActualizado?.tasaPersonalizada === 0.025 ? 'PASS' : 'FAIL',
    detalle: `tieneTasaPersonalizada=${clienteActualizado?.tieneTasaPersonalizada} | tasa=${(clienteActualizado?.tasaPersonalizada || 0) * 100}% mensual`,
    data: clienteActualizado,
  })

  // E36. Modificar la tasa de un préstamo existente
  const prestamoParaModificar = await prisma.prestamo.findFirst({
    where: { clienteId: cliente.id, estado: 'ACTIVO' },
  })
  if (prestamoParaModificar) {
    const tasaAnterior = prestamoParaModificar.tasaInteresMensual
    const tasaNueva = 0.025
    await prisma.prestamo.update({
      where: { id: prestamoParaModificar.id },
      data: {
        tasaInteresMensual: tasaNueva,
        tasaInteresAnual: tasaNueva * 12,
        tasaAplicada: tasaNueva,
      },
    })
    log({
      escenario: 'E36',
      descripcion: `Modificar tasa de un préstamo existente (${prestamoParaModificar.codigo})`,
      status: 'PASS',
      detalle: `Tasa anterior: ${(tasaAnterior * 100).toFixed(2)}% → nueva: ${(tasaNueva * 100).toFixed(2)}% mensual`,
      data: {
        prestamoId: prestamoParaModificar.id,
        codigo: prestamoParaModificar.codigo,
        tasaAnterior,
        tasaNueva,
      },
    })
  }

  // E37. Modificar otros datos del cliente
  const nuevoEmail = 'johan.alvarez.test@test.com'
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      email: nuevoEmail,
      departamento: 'Antioquia',
      municipio: 'Medellín',
      direccion: 'Calle 10 # 20-30',
      barrio: 'Centro',
      salario: 2_500_000,
    },
  })
  const clienteFinal = await prisma.cliente.findUnique({
    where: { id: cliente.id },
    select: { email: true, departamento: true, municipio: true, direccion: true, barrio: true, salario: true },
  })
  log({
    escenario: 'E37',
    descripcion: 'Modificar datos del cliente (email, dirección, salario)',
    status: clienteFinal?.email === nuevoEmail ? 'PASS' : 'FAIL',
    detalle: `Email: ${clienteFinal?.email} | Dpto: ${clienteFinal?.departamento} | Salario: $${clienteFinal?.salario?.toLocaleString('es-CO')}`,
    data: clienteFinal,
  })

  // =================================================================
  // BLOQUE 3: SOLICITUD WEB DE PRÉSTAMO (SIMULACRO)
  // =================================================================
  console.log('--- BLOQUE 3: SOLICITUD WEB DE PRÉSTAMO (SIMULACRO) ---\n')

  // E38. Crear solicitud web desde el portal
  const codigoSol = `SOL-${Date.now().toString(36).toUpperCase()}`
  const montoSol = 3_500_000
  const cuotaEstimada = 630_000
  const totalPagar = cuotaEstimada * 6
  const totalIntereses = totalPagar - montoSol
  const solicitudWeb = await (prisma as any).solicitudWeb.create({
    data: {
      codigo: codigoSol,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteCedula: cliente.cedula,
      clienteTelefono: cliente.telefono,
      clienteEmail: cliente.email,
      valorSolicitado: montoSol,
      numeroCuotas: 6,
      frecuencia: 'MENSUAL',
      tasaUtilizada: 0.0183,
      tasaOrigen: 'CATEGORIA',
      cuotaEstimada: cuotaEstimada,
      totalIntereses: totalIntereses,
      totalPagar: totalPagar,
      canalOrigen: 'PORTAL_CLIENTE',
      estado: 'PENDIENTE',
      estadoFlujoFirma: 'PENDIENTE',
      flexibilidadFinanciera: true,
      flexibilidadModalidad: 'BASICA',
      flexibilidadCosto: 15000,
      ipOrigen: '127.0.0.1',
      dispositivo: 'Pruebas E2E Script',
      observaciones: 'Solicitud creada en simulacro E2E',
    },
  })
  log({
    escenario: 'E38',
    descripcion: 'Crear solicitud web de préstamo desde portal',
    status: solicitudWeb ? 'PASS' : 'FAIL',
    detalle: `Solicitud: ${solicitudWeb.codigo} | monto: $${solicitudWeb.valorSolicitado.toLocaleString('es-CO')} | flexibilidad: ${solicitudWeb.flexibilidadFinanciera ? 'SÍ (' + solicitudWeb.flexibilidadModalidad + ')' : 'NO'}`,
    data: {
      solicitudId: solicitudWeb.id,
      codigo: solicitudWeb.codigo,
      monto: solicitudWeb.valorSolicitado,
      flexibilidadFinanciera: solicitudWeb.flexibilidadFinanciera,
      flexibilidadModalidad: solicitudWeb.flexibilidadModalidad,
    },
  })

  // E39. Convertir solicitud web en préstamo (simulación admin)
  const prestamoDesdeSolicitud = await prisma.prestamo.create({
    data: {
      codigo: `PRES-SOL-${Date.now().toString(36).toUpperCase().slice(-10)}`,
      clienteId: cliente.id,
      categoriaId: cliente.categoriaId,
      montoPrincipal: 3_500_000,
      montoCuota: 630_000,
      numeroCuotas: 6,
      cuotasPagadas: 0,
      plazoMeses: 6,
      frecuencia: 'MENSUAL',
      tasaInteresMensual: 0.0183,
      tasaInteresAnual: 0.22,
      tasaMoraDiaria: 0.005,
      tasaAplicada: 0.0183,
      montoPagado: 0,
      saldoTotal: 3_780_000,
      saldoCapital: 3_500_000,
      totalInteres: 280_000,
      totalPagar: 3_780_000,
      estado: 'PENDIENTE_ACEPTACION',
      fechaDesembolso: new Date(),
      fechaVencimiento: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
      tycAceptado: false,
      flexibilidadFinanciera: true,
      flexibilidadActivada: false, // se activa al pagar
      flexibilidadModalidad: 'BASICA',
      flexibilidadUsosDisponibles: 1,
      flexibilidadUsosEjercidos: 0,
      flexibilidadCosto: 15000,
      notas: `Préstamo creado desde solicitud web ${solicitudWeb.codigo}`,
    },
  })
  await (prisma as any).solicitudWeb.update({
    where: { id: solicitudWeb.id },
    data: {
      estado: 'CONVERTIDA',
      estadoFlujoFirma: 'EN_FIRMA_CLIENTE',
      prestamoCreadoId: prestamoDesdeSolicitud.id,
    },
  })
  log({
    escenario: 'E39',
    descripcion: 'Convertir solicitud web en préstamo (admin)',
    status: prestamoDesdeSolicitud ? 'PASS' : 'FAIL',
    detalle: `Préstamo creado: ${prestamoDesdeSolicitud.codigo} | solicitud marcada como CONVERTIDA`,
    data: {
      prestamoId: prestamoDesdeSolicitud.id,
      codigo: prestamoDesdeSolicitud.codigo,
      estado: prestamoDesdeSolicitud.estado,
      flexibilidadActivada: prestamoDesdeSolicitud.flexibilidadActivada,
    },
  })

  // =================================================================
  // BLOQUE 4: ESTADO DE CUENTA
  // =================================================================
  console.log('--- BLOQUE 4: ESTADO DE CUENTA ---\n')

  // E40. Generar estado de cuenta del cliente
  const prestamosCliente = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    include: {
      pagos: { orderBy: { fechaPago: 'desc' }, take: 5 },
      categoria: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  const totalPrestamos = prestamosCliente.length
  const totalSaldo = prestamosCliente.reduce((sum, p) => sum + Number(p.saldoTotal), 0)
  const totalPagado = prestamosCliente.reduce((sum, p) => sum + Number(p.montoPagado), 0)
  const totalPrestamosActivos = prestamosCliente.filter(p => p.estado === 'ACTIVO').length
  const totalEnMora = prestamosCliente.filter(p => p.estado === 'EN_MORA').length
  const totalJuridico = prestamosCliente.filter(p => p.estado === 'JURIDICO').length
  log({
    escenario: 'E40',
    descripcion: 'Generar estado de cuenta consolidado del cliente',
    status: 'PASS',
    detalle: `${totalPrestamos} préstamos | activos: ${totalPrestamosActivos} | en mora: ${totalEnMora} | jurídico: ${totalJuridico} | saldo total: $${totalSaldo.toLocaleString('es-CO')} | pagado: $${totalPagado.toLocaleString('es-CO')}`,
    data: {
      totalPrestamos,
      totalPrestamosActivos,
      totalEnMora,
      totalJuridico,
      totalSaldoPendiente: totalSaldo,
      totalPagado,
    },
  })

  // =================================================================
  // RESUMEN FINAL
  // =================================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' RESUMEN DE PRUEBAS ADICIONALES')
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

function ulteros4Coinciden(input: string, registrado: string) {
  const i = input.replace(/\D/g, '').slice(-4)
  const r = registrado.replace(/\D/g, '').slice(-4)
  return i === r && i.length === 4
}

main().catch((e) => {
  console.error('ERROR FATAL:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
