// =====================================================
// 🧹 ELIMINAR TODOS LOS CLIENTES EXCEPTO JOHAN (1214731649)
// =====================================================
// Script destructivo que:
//   1. Lista todos los clientes excepto el de cédula 1214731649
//   2. Para cada cliente a eliminar:
//      a) Elimina en orden correcto TODOS los registros hijos
//         (préstamos, pagos, pagos programados, notificaciones,
//          compromisos, pasaporte auditoría, bitácora, movimientos
//          de caja, tokens de firma, firmas, documentos, casos
//          jurídicos, refinanciaciones, otros sí, conversaciones
//          de chat, OTPs, accesos al portal, campañas vistas,
//          solicitudes web, etc.)
//      b) Elimina el cliente
//   3. Verifica que solo quede Johan con todos sus datos intactos
//
// Política:
//   - NO toca al cliente 1214731649 (Johan) ni a ninguno de sus
//     préstamos, pagos, etc.
//   - Antes de borrar referidosPorId, los setea a NULL en otros
//     clientes (para evitar romper la FK ClienteReferido).
//   - No toca tablas de sistema (Usuario, CajaMenor, Configuracion,
//     VariableGlobal, etc.) ni tablas contables (Cont*).
// =====================================================

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public',
    },
  },
})

const CEDULA_MANTENER = '1214731649'

// === Eliminar todos los registros hijos de un préstamo específico ===
async function eliminarRegistrosDePrestamo(prestamoId, tx) {
  // CasoJuridico y sus hijos (CronologiaCaso, AlertaLegal)
  const casos = await tx.casoJuridico.findMany({
    where: { prestamoId },
    select: { id: true },
  })
  const casoIds = casos.map((c) => c.id)
  if (casoIds.length) {
    await tx.cronologiaCaso.deleteMany({ where: { casoId: { in: casoIds } } })
    await tx.alertaLegal.deleteMany({ where: { casoId: { in: casoIds } } })
    await tx.casoJuridico.deleteMany({ where: { id: { in: casoIds } } })
  }

  // Otros hijos directos del préstamo (orden alfabético)
  await tx.codigoConfirmacion.deleteMany({ where: { prestamoId } })
  await tx.compromisoPago.deleteMany({ where: { prestamoId } })
  await tx.documentoGestor.deleteMany({ where: { prestamoId } })
  // DocumentoLegal se elimina vía CasoJuridico (tiene casoId, no prestamoId/clienteId)

  // TokenFirma tiene FK a FirmaElectronica → borrar tokens PRIMERO
  // 1) Tokens cuyo firmaId apunta a una firma de este préstamo
  const firmaIdsPrestamo = (
    await tx.firmaElectronica.findMany({ where: { prestamoId }, select: { id: true } })
  ).map((f) => f.id)
  if (firmaIdsPrestamo.length) {
    await tx.tokenFirma.deleteMany({ where: { firmaId: { in: firmaIdsPrestamo } } })
  }
  // 2) Tokens directamente vinculados al préstamo (relación "PrestamoTokenFirma")
  await tx.tokenFirma.deleteMany({ where: { prestamoId } })
  // Ahora sí podemos borrar las firmas
  await tx.firmaElectronica.deleteMany({ where: { prestamoId } })

  await tx.notificacionLog.deleteMany({ where: { prestamoId } })
  await tx.otroSiCambioFecha.deleteMany({ where: { prestamoId } })
  await tx.pago.deleteMany({ where: { prestamoId } })
  await tx.pagoProgramado.deleteMany({ where: { prestamoId } })
  await tx.pasaporteAuditoria.deleteMany({ where: { prestamoId } })
  await tx.bitacoraPrestamo.deleteMany({ where: { prestamoId } })
  await tx.movimientoCaja.deleteMany({ where: { prestamoId } })
  await tx.refinanciacion.deleteMany({ where: { prestamoId } })

  // RenovacionPrestamo (referencia por prestamoOriginalId o prestamoNuevoId)
  await tx.renovacionPrestamo.deleteMany({
    where: { OR: [{ prestamoOriginalId: prestamoId }, { prestamoNuevoId: prestamoId }] },
  })

  // TokenFirma (referencia por prestamoId, relación "PrestamoTokenFirma")
  await tx.tokenFirma.deleteMany({ where: { prestamoId } })
}

// === Eliminar todos los registros hijos directos de un cliente (sin préstamo) ===
async function eliminarRegistrosDeCliente(clienteId, tx) {
  // ConversacionChat y sus hijos (MensajeChat, NotaInterna)
  const conversaciones = await tx.conversacionChat.findMany({
    where: { clienteId },
    select: { id: true },
  })
  const conversacionIds = conversaciones.map((c) => c.id)
  if (conversacionIds.length) {
    await tx.mensajeChat.deleteMany({ where: { conversacionId: { in: conversacionIds } } })
    await tx.notaInterna.deleteMany({ where: { conversacionId: { in: conversacionIds } } })
    await tx.conversacionChat.deleteMany({ where: { id: { in: conversacionIds } } })
  }

  // Setear referidoPorId a NULL en otros clientes que tengan este cliente como referente
  await tx.cliente.updateMany({
    where: { referidoPorId: clienteId },
    data: { referidoPorId: null },
  })

  // Hijos directos del cliente (orden alfabético)
  await tx.accesoPortal.deleteMany({ where: { clienteId } })
  await tx.campañaVista.deleteMany({ where: { clienteId } })
  await tx.compromisoPago.deleteMany({ where: { clienteId } })
  await tx.documentoGestor.deleteMany({ where: { clienteId } })
  // DocumentoLegal no tiene clienteId directo (se elimina vía CasoJuridico)
  // MovimientoCaja no tiene clienteId directo (se elimina vía prestamoId)

  // TokenFirma tiene FK a FirmaElectronica → borrar tokens PRIMERO
  // 1) Tokens cuyo firmaId apunta a una firma de este cliente
  const firmaIdsCliente = (
    await tx.firmaElectronica.findMany({ where: { clienteId }, select: { id: true } })
  ).map((f) => f.id)
  if (firmaIdsCliente.length) {
    await tx.tokenFirma.deleteMany({ where: { firmaId: { in: firmaIdsCliente } } })
  }
  // 2) Tokens directamente vinculados al cliente (relación "ClienteTokenFirma")
  await tx.tokenFirma.deleteMany({ where: { clienteId } })
  // Ahora sí podemos borrar las firmas
  await tx.firmaElectronica.deleteMany({ where: { clienteId } })

  await tx.otpChat.deleteMany({ where: { clienteId } })
  await tx.otpRegistro.deleteMany({ where: { clienteId } })
  await tx.pasaporteAuditoria.deleteMany({ where: { clienteId } })
  await tx.solicitudWeb.deleteMany({ where: { clienteId } })
}

// === Eliminar un cliente completo con todos sus datos ===
async function eliminarClienteCompleto(cliente, tx) {
  console.log(`\n🧹 Eliminando cliente: ${cliente.nombre} (CC ${cliente.cedula})`)

  // 1. Listar préstamos del cliente
  const prestamos = await tx.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, codigo: true },
  })
  console.log(`   📋 ${prestamos.length} préstamo(s) a eliminar:`)
  for (const p of prestamos) {
    console.log(`      • ${p.codigo}`)
    await eliminarRegistrosDePrestamo(p.id, tx)
    await tx.prestamo.delete({ where: { id: p.id } })
  }

  // 2. Eliminar registros hijos directos del cliente
  await eliminarRegistrosDeCliente(cliente.id, tx)

  // 3. Eliminar SolicitudNuevoCliente por cédula (no hay FK formal, solo cedula String)
  await tx.solicitudNuevoCliente.deleteMany({ where: { cedula: cliente.cedula } })

  // 4. Eliminar el cliente
  await tx.cliente.delete({ where: { id: cliente.id } })
  console.log(`   ✓ Cliente eliminado`)
}

// === Reporte de cuántos registros quedan por modelo ===
async function reporteCuentas() {
  const modelos = [
    'cliente', 'prestamo', 'pago', 'pagoProgramado', 'notificacionLog',
    'compromisoPago', 'pasaporteAuditoria', 'bitacoraPrestamo',
    'movimientoCaja', 'firmaElectronica', 'tokenFirma', 'documentoGestor',
    'documentoLegal', 'casoJuridico', 'cronologiaCaso', 'alertaLegal',
    'refinanciacion', 'otroSiCambioFecha', 'renovacionPrestamo',
    'conversacionChat', 'mensajeChat', 'notaInterna', 'otpChat',
    'otpRegistro', 'accesoPortal', 'campañaVista', 'solicitudWeb',
    'solicitudNuevoCliente', 'codigoConfirmacion',
  ]
  const cuentas = {}
  for (const m of modelos) {
    try {
      cuentas[m] = await prisma[m].count()
    } catch (e) {
      cuentas[m] = '(error)'
    }
  }
  return cuentas
}

// =====================================================
// 🚀 FUNCIÓN PRINCIPAL
// =====================================================
async function main() {
  console.log('='.repeat(70))
  console.log('🧹 ELIMINAR TODOS LOS CLIENTES EXCEPTO JOHAN (1214731649)')
  console.log('='.repeat(70))

  // 1. Verificar que Johan existe
  const johan = await prisma.cliente.findFirst({
    where: { cedula: CEDULA_MANTENER },
    select: { id: true, nombre: true, cedula: true, _count: { select: { prestamos: true } } },
  })
  if (!johan) {
    console.error(`❌ No se encontró el cliente a MANTENER (cédula ${CEDULA_MANTENER}). Abortando.`)
    process.exit(1)
  }
  console.log(`\n✅ Cliente a MANTENER:`)
  console.log(`   ${johan.nombre} (CC ${johan.cedula}) — ${johan._count.prestamos} préstamo(s)`)

  // 2. Listar clientes a eliminar
  const aEliminar = await prisma.cliente.findMany({
    where: { cedula: { not: CEDULA_MANTENER } },
    select: { id: true, nombre: true, cedula: true, _count: { select: { prestamos: true } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`\n📋 Clientes a ELIMINAR: ${aEliminar.length}`)
  aEliminar.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.nombre} (CC ${c.cedula}) — ${c._count.prestamos} préstamo(s)`)
  })

  if (aEliminar.length === 0) {
    console.log('\n✅ No hay clientes para eliminar. Solo queda Johan.')
    return
  }

  // 3. Reporte ANTES de eliminar
  console.log('\n📊 Conteo ANTES de eliminar:')
  const antes = await reporteCuentas()
  Object.entries(antes).forEach(([k, v]) => console.log(`   ${k.padEnd(25)} ${v}`))

  // 4. Eliminar cada cliente en su propia transacción
  //    (transacciones separadas para que un error en uno no aborte todo)
  //    Timeout extendido a 60s porque algunos clientes tienen muchas firmas/tokens
  let eliminados = 0
  let fallidos = 0
  for (const cliente of aEliminar) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await eliminarClienteCompleto(cliente, tx)
        },
        { timeout: 60000, maxWait: 90000 }
      )
      eliminados++
    } catch (err) {
      console.error(`\n❌ Error eliminando ${cliente.nombre} (CC ${cliente.cedula}): ${err.message}`)
      fallidos++
    }
  }

  // 5. Reporte DESPUÉS de eliminar
  console.log('\n' + '='.repeat(70))
  console.log('📊 Conteo DESPUÉS de eliminar:')
  const despues = await reporteCuentas()
  Object.entries(despues).forEach(([k, v]) => {
    const antesV = antes[k]
    const delta = typeof v === 'number' && typeof antesV === 'number' ? v - antesV : 0
    const marca = delta < 0 ? ` (eliminados ${Math.abs(delta)})` : delta > 0 ? ` (+${delta})` : ''
    console.log(`   ${k.padEnd(25)} ${v}${marca}`)
  })

  // 6. Verificación final
  console.log('\n' + '='.repeat(70))
  console.log('🔍 VERIFICACIÓN FINAL')
  console.log('='.repeat(70))
  const clientesFinales = await prisma.cliente.findMany({
    select: { id: true, nombre: true, cedula: true, _count: { select: { prestamos: true } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`\nClientes en BD: ${clientesFinales.length}`)
  clientesFinales.forEach((c) => {
    console.log(`   ✓ ${c.nombre} (CC ${c.cedula}) — ${c._count.prestamos} préstamo(s)`)
  })

  // 7. Resumen
  console.log('\n' + '='.repeat(70))
  console.log('🎉 RESUMEN')
  console.log('='.repeat(70))
  console.log(`   Clientes eliminados: ${eliminados}`)
  console.log(`   Clientes fallidos:   ${fallidos}`)
  console.log(`   Cliente mantenido:   ${johan.nombre} (CC ${johan.cedula})`)
  const prestamosJohanFinal = await prisma.prestamo.count({ where: { clienteId: johan.id } })
  console.log(`   Préstamos de Johan preservados: ${prestamosJohanFinal}`)
}

main()
  .catch((err) => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
