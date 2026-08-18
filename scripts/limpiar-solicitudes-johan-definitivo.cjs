// =====================================================
// scripts/limpiar-solicitudes-johan-definitivo.cjs
// =====================================================
// ELIMINACIÓN DEFINITIVA de TODAS las solicitudes de simulación / préstamos
// del cliente 1214731649 (JOHAN SEBASTIAN ALVAREZ DEL RIO) en la BD Neon.
//
// Qué hace:
//   1. Localiza al cliente por cédula (sin importar si está marcado esPrueba).
//   2. Obtiene TODOS sus préstamos (cualquier estado, incluidos CANCELADO/RECHAZADO).
//   3. Elimina en orden de dependencias TODOS los registros relacionados:
//      - Por préstamo: alertas legales, documentos legales, cronologías,
//        casos jurídicos, tokens de firma, firmas electrónicas, otros sí,
//        notificaciones, refinanciaciones, pagos programados, pagos,
//        bitácoras, movimientos de caja, códigos de confirmación,
//        documentos del gestor, compromisos de pago, pasaporte auditoría,
//        renovaciones.
//      - Por cliente (no vinculados a préstamo directo): conversaciones
//        (con mensajes/notas internas), accesos al portal, OTPs, solicitudes web,
//        solicitudes de nuevo cliente, campañas vistas.
//   4. Finalmente elimina TODOS los préstamos del cliente.
//   5. Conserva al cliente (es el cliente de prueba, debe poder volver a
//      hacer todo el proceso), pero lo deja con 0 préstamos y 0 registros
//      relacionados.
//   6. Verificación final: muestra conteos en 0.
//
// Ejecución:
//   DATABASE_URL='postgresql://...' node scripts/limpiar-solicitudes-johan-definitivo.cjs
// =====================================================

const { PrismaClient } = require('@prisma/client')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const CEDULA = '1214731649'

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
    log: ['warn', 'error'],
  })

  try {
    console.log('=========================================================')
    console.log(`  LIMPIEZA DEFINITIVA — Solicitudes de ${CEDULA}`)
    console.log('=========================================================\n')

    // 1. Localizar cliente
    const cliente = await prisma.cliente.findFirst({
      where: { cedula: CEDULA },
      select: { id: true, nombre: true, cedula: true, esPrueba: true },
    })
    if (!cliente) {
      console.log(`✗ No se encontró cliente con cédula ${CEDULA}. Nada que limpiar.`)
      return
    }
    console.log(`✓ Cliente encontrado:`)
    console.log(`    id       = ${cliente.id}`)
    console.log(`    nombre   = ${cliente.nombre}`)
    console.log(`    esPrueba = ${cliente.esPrueba}\n`)

    // 2. Obtener todos los préstamos del cliente
    const prestamos = await prisma.prestamo.findMany({
      where: { clienteId: cliente.id },
      select: { id: true, codigo: true, estado: true, saldoTotal: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    console.log(`✓ Préstamos del cliente: ${prestamos.length}`)
    let saldoActivos = 0
    for (const p of prestamos) {
      const activo = ['ACTIVO', 'EN_MORA', 'JURIDICO', 'PENDIENTE_ACEPTACION', 'SOLICITUD'].includes(p.estado)
      if (activo) saldoActivos += Number(p.saldoTotal)
      console.log(`    ${p.codigo} | estado=${p.estado} | saldo=${p.saldoTotal} | ${p.createdAt.toISOString()}`)
    }
    console.log(`    Saldo total (estados no finales): $${saldoActivos.toLocaleString('es-CO')}\n`)

    if (prestamos.length === 0) {
      console.log('✓ No hay préstamos que eliminar. Continuando con limpieza a nivel cliente...\n')
    }

    const prestamoIds = prestamos.map((p) => p.id)

    // Contadores acumulados
    const total = {}

    // 3. ELIMINACIÓN POR PRÉSTAMO — orden de dependencias (hijo → padre)
    console.log('--- Eliminación por préstamo ---')

    // 3.1 Hijos de CasoJuridico (que depende de Prestamo)
    try {
      const r = await prisma.alertaLegal.deleteMany({ where: { caso: { prestamoId: { in: prestamoIds } } } })
      total.alertaLegal = r.count; console.log(`  alertaLegal:                ${r.count}`)
    } catch (e) { console.log(`  alertaLegal:                SKIPPED (${e.message.split('\n')[0]})`) }

    try {
      const r = await prisma.documentoLegal.deleteMany({ where: { caso: { prestamoId: { in: prestamoIds } } } })
      total.documentoLegal = r.count; console.log(`  documentoLegal:             ${r.count}`)
    } catch (e) { console.log(`  documentoLegal:             SKIPPED (${e.message.split('\n')[0]})`) }

    try {
      const r = await prisma.cronologiaCaso.deleteMany({ where: { caso: { prestamoId: { in: prestamoIds } } } })
      total.cronologiaCaso = r.count; console.log(`  cronologiaCaso:             ${r.count}`)
    } catch (e) { console.log(`  cronologiaCaso:             SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.2 CasoJuridico (FK directa a Prestamo)
    try {
      const r = await prisma.casoJuridico.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.casoJuridico = r.count; console.log(`  casoJuridico:               ${r.count}`)
    } catch (e) { console.log(`  casoJuridico:               SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.3 TokenFirma (hijo de FirmaElectronica)
    try {
      const r1 = await prisma.tokenFirma.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.tokenFirma_prestamo = r1.count
      const r2 = await prisma.tokenFirma.deleteMany({ where: { firma: { prestamoId: { in: prestamoIds } } } })
      total.tokenFirma_firma = r2.count
      console.log(`  tokenFirma (por préstamo):   ${r1.count}`)
      console.log(`  tokenFirma (por firma):       ${r2.count}`)
    } catch (e) { console.log(`  tokenFirma:                 SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.4 FirmaElectronica (FK directa a Prestamo)
    try {
      const r = await prisma.firmaElectronica.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.firmaElectronica = r.count; console.log(`  firmaElectronica:            ${r.count}`)
    } catch (e) { console.log(`  firmaElectronica:            SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.5 OtroSiCambioFecha
    try {
      const r = await prisma.otroSiCambioFecha.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.otroSiCambioFecha = r.count; console.log(`  otroSiCambioFecha:           ${r.count}`)
    } catch (e) { console.log(`  otroSiCambioFecha:           SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.6 NotificacionLog
    try {
      const r = await prisma.notificacionLog.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.notificacionLog = r.count; console.log(`  notificacionLog:             ${r.count}`)
    } catch (e) { console.log(`  notificacionLog:             SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.7 Refinanciacion
    try {
      const r = await prisma.refinanciacion.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.refinanciacion = r.count; console.log(`  refinanciacion:              ${r.count}`)
    } catch (e) { console.log(`  refinanciacion:              SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.8 PagoProgramado
    try {
      const r = await prisma.pagoProgramado.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.pagoProgramado = r.count; console.log(`  pagoProgramado:              ${r.count}`)
    } catch (e) { console.log(`  pagoProgramado:              SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.9 Pago
    try {
      const r = await prisma.pago.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.pago = r.count; console.log(`  pago:                        ${r.count}`)
    } catch (e) { console.log(`  pago:                        SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.10 BitacoraPrestamo
    try {
      const r = await prisma.bitacoraPrestamo.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.bitacoraPrestamo = r.count; console.log(`  bitacoraPrestamo:            ${r.count}`)
    } catch (e) { console.log(`  bitacoraPrestamo:            SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.11 MovimientoCaja (FK a Prestamo)
    try {
      const r = await prisma.movimientoCaja.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.movimientoCaja = r.count; console.log(`  movimientoCaja:              ${r.count}`)
    } catch (e) { console.log(`  movimientoCaja:              SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.12 CodigoConfirmacion
    try {
      const r = await prisma.codigoConfirmacion.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.codigoConfirmacion = r.count; console.log(`  codigoConfirmacion:          ${r.count}`)
    } catch (e) { console.log(`  codigoConfirmacion:          SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.13 DocumentoGestor
    try {
      const r = await prisma.documentoGestor.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.documentoGestor = r.count; console.log(`  documentoGestor:             ${r.count}`)
    } catch (e) { console.log(`  documentoGestor:             SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.14 CompromisoPago (relacionado con préstamo)
    try {
      const r = await prisma.compromisoPago.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.compromisoPago_prestamo = r.count; console.log(`  compromisoPago (préstamo):   ${r.count}`)
    } catch (e) { console.log(`  compromisoPago (préstamo):   SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.15 PasaporteAuditoria (relacionado con préstamo)
    try {
      const r = await prisma.pasaporteAuditoria.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.pasaporteAuditoria_prestamo = r.count; console.log(`  pasaporteAuditoria (préstamo):${r.count}`)
    } catch (e) { console.log(`  pasaporteAuditoria:         SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.16 RenovacionPrestamo (FK a Prestamo — el préstamo nuevo)
    try {
      const r = await prisma.renovacionPrestamo.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.renovacionPrestamo_nuevo = r.count; console.log(`  renovacionPrestamo (nuevo):   ${r.count}`)
    } catch (e) { console.log(`  renovacionPrestamo (nuevo):  SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.17 RenovacionPrestamo (referencia al préstamo anterior)
    try {
      const r = await prisma.renovacionPrestamo.deleteMany({ where: { prestamoAnteriorId: { in: prestamoIds } } })
      total.renovacionPrestamo_anterior = r.count; console.log(`  renovacionPrestamo (ant.):    ${r.count}`)
    } catch (e) { console.log(`  renovacionPrestamo (ant.):    SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.18 SolicitudWeb (puede estar vinculada a Prestamo)
    try {
      const r = await prisma.solicitudWeb.deleteMany({ where: { prestamoId: { in: prestamoIds } } })
      total.solicitudWeb_prestamo = r.count; console.log(`  solicitudWeb (préstamo):     ${r.count}`)
    } catch (e) { console.log(`  solicitudWeb (préstamo):     SKIPPED (${e.message.split('\n')[0]})`) }

    // 3.19 Finalmente, préstamos
    const prestamosDel = await prisma.prestamo.deleteMany({ where: { id: { in: prestamoIds } } })
    total.prestamo = prestamosDel.count
    console.log(`\n  PRÉSTAMOS ELIMINADOS:        ${prestamosDel.count}`)

    // 4. ELIMINACIÓN A NIVEL CLIENTE (no vinculados a préstamo directo)
    console.log('\n--- Eliminación a nivel cliente ---')

    // 4.1 MensajeChat + NotaInterna (hijos de ConversacionChat)
    try {
      const r1 = await prisma.mensajeChat.deleteMany({ where: { conversacion: { clienteId: cliente.id } } })
      total.mensajeChat = r1.count; console.log(`  mensajeChat:                 ${r1.count}`)
    } catch (e) { console.log(`  mensajeChat:                 SKIPPED (${e.message.split('\n')[0]})`) }

    try {
      const r = await prisma.notaInterna.deleteMany({ where: { conversacion: { clienteId: cliente.id } } })
      total.notaInterna = r.count; console.log(`  notaInterna:                 ${r.count}`)
    } catch (e) { console.log(`  notaInterna:                 SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.2 ConversacionChat
    try {
      const r = await prisma.conversacionChat.deleteMany({ where: { clienteId: cliente.id } })
      total.conversacionChat = r.count; console.log(`  conversacionChat:            ${r.count}`)
    } catch (e) { console.log(`  conversacionChat:            SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.3 AccesoPortal
    try {
      const r = await prisma.accesoPortal.deleteMany({ where: { clienteId: cliente.id } })
      total.accesoPortal = r.count; console.log(`  accesoPortal:                ${r.count}`)
    } catch (e) { console.log(`  accesoPortal:                SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.4 OtpChat
    try {
      const r = await prisma.otpChat.deleteMany({ where: { clienteId: cliente.id } })
      total.otpChat = r.count; console.log(`  otpChat:                     ${r.count}`)
    } catch (e) { console.log(`  otpChat:                     SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.5 OtpRegistro
    try {
      const r = await prisma.otpRegistro.deleteMany({ where: { clienteId: cliente.id } })
      total.otpRegistro = r.count; console.log(`  otpRegistro:                 ${r.count}`)
    } catch (e) { console.log(`  otpRegistro:                 SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.6 SolicitudWeb (por cliente)
    try {
      const r = await prisma.solicitudWeb.deleteMany({ where: { clienteId: cliente.id } })
      total.solicitudWeb_cliente = r.count; console.log(`  solicitudWeb (cliente):      ${r.count}`)
    } catch (e) { console.log(`  solicitudWeb (cliente):      SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.7 SolicitudNuevoCliente (por cédula)
    try {
      const r = await prisma.solicitudNuevoCliente.deleteMany({ where: { cedula: CEDULA } })
      total.solicitudNuevoCliente = r.count; console.log(`  solicitudNuevoCliente:       ${r.count}`)
    } catch (e) { console.log(`  solicitudNuevoCliente:       SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.8 CampañaVista
    try {
      const r = await prisma.campanaVista.deleteMany({ where: { clienteId: cliente.id } })
      total.campanaVista = r.count; console.log(`  campanaVista:                ${r.count}`)
    } catch (e) { console.log(`  campanaVista:                SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.9 CompromisoPago (por cliente)
    try {
      const r = await prisma.compromisoPago.deleteMany({ where: { clienteId: cliente.id } })
      total.compromisoPago_cliente = r.count; console.log(`  compromisoPago (cliente):    ${r.count}`)
    } catch (e) { console.log(`  compromisoPago (cliente):    SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.10 PasaporteAuditoria (por cliente)
    try {
      const r = await prisma.pasaporteAuditoria.deleteMany({ where: { clienteId: cliente.id } })
      total.pasaporteAuditoria_cliente = r.count; console.log(`  pasaporteAuditoria (cliente): ${r.count}`)
    } catch (e) { console.log(`  pasaporteAuditoria (cliente):SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.11 FirmaElectronica por cliente (sin préstamo, ej. codeudor)
    try {
      const r = await prisma.firmaElectronica.deleteMany({ where: { clienteId: cliente.id } })
      total.firmaElectronica_cliente = r.count; console.log(`  firmaElectronica (cliente):   ${r.count}`)
    } catch (e) { console.log(`  firmaElectronica (cliente):   SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.12 TokenFirma por cliente
    try {
      const r = await prisma.tokenFirma.deleteMany({ where: { clienteId: cliente.id } })
      total.tokenFirma_cliente = r.count; console.log(`  tokenFirma (cliente):        ${r.count}`)
    } catch (e) { console.log(`  tokenFirma (cliente):        SKIPPED (${e.message.split('\n')[0]})`) }

    // 4.13 DocumentoGestor por cliente
    try {
      const r = await prisma.documentoGestor.deleteMany({ where: { clienteId: cliente.id } })
      total.documentoGestor_cliente = r.count; console.log(`  documentoGestor (cliente):   ${r.count}`)
    } catch (e) { console.log(`  documentoGestor (cliente):   SKIPPED (${e.message.split('\n')[0]})`) }

    // 5. Asegurar que el cliente queda marcado como esPrueba=true
    console.log('\n--- Marcando cliente como esPrueba=true ---')
    try {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: {
          esPrueba: true,
          fechaMarcadoPrueba: new Date(),
          motivoPrueba:
            'Cliente canónico de QA. Excluido automáticamente de saldos reales del sistema (dashboard, reportes, cartera, balance, morosidad, mensual-informe).',
        },
      })
      console.log('  ✓ Cliente marcado como esPrueba=true')
    } catch (e) {
      console.log(`  ⚠ No se pudo marcar esPrueba (campo no existe?): ${e.message.split('\n')[0]}`)
      console.log('    El cliente sigue siendo reconocido por cédula hardcodeada en src/lib/cliente-prueba.ts')
    }

    // 6. VERIFICACIÓN FINAL
    console.log('\n=========================================================')
    console.log('  VERIFICACIÓN FINAL')
    console.log('=========================================================')
    const prestamosFinal = await prisma.prestamo.count({ where: { clienteId: cliente.id } })
    const pagosFinal = await prisma.pago.count({
      where: { prestamo: { clienteId: cliente.id } },
    })
    const firmasFinal = await prisma.firmaElectronica.count({
      where: { prestamo: { clienteId: cliente.id } },
    })
    const accesosFinal = await prisma.accesoPortal.count({ where: { clienteId: cliente.id } }).catch(() => 0)
    const conversacionesFinal = await prisma.conversacionChat.count({ where: { clienteId: cliente.id } }).catch(() => 0)

    console.log(`  Préstamos del cliente:       ${prestamosFinal}`)
    console.log(`  Pagos del cliente:           ${pagosFinal}`)
    console.log(`  Firmas electrónicas:         ${firmasFinal}`)
    console.log(`  Accesos al portal:           ${accesosFinal}`)
    console.log(`  Conversaciones de chat:      ${conversacionesFinal}`)

    // Total registros eliminados
    const totalEliminados = Object.values(total).reduce((a, b) => a + b, 0)
    console.log(`\n  TOTAL REGISTROS ELIMINADOS: ${totalEliminados}`)

    // Verificación de saldos: préstamos activos en todo el sistema
    const totalSistemaAntes = await prisma.prestamo.count({
      where: { estado: { in: ['ACTIVO', 'EN_MORA', 'JURIDICO', 'PENDIENTE_ACEPTACION', 'SOLICITUD'] } },
    })
    console.log(`\n  Total préstamos activos en el sistema: ${totalSistemaAntes}`)

    const sumaSaldos = await prisma.prestamo.aggregate({
      _sum: { saldoTotal: true },
      where: {
        estado: { in: ['ACTIVO', 'EN_MORA', 'JURIDICO', 'PENDIENTE_ACEPTACION', 'SOLICITUD'] },
        clienteId: { not: cliente.id },
      },
    })
    console.log(
      `  Suma de saldos (excluyendo Johan): $${Number(sumaSaldos._sum.saldoTotal || 0).toLocaleString('es-CO')}`
    )

    console.log('\n✓ LIMPIEZA DEFINITIVA COMPLETADA.')
  } catch (e) {
    console.error('\n✗ ERROR FATAL:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
