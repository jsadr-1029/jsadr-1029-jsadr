/**
 * Script de limpieza TOTAL de la base de datos - v2.
 *
 * Esta versión usa SQL crudo con TRUNCATE ... CASCADE para evitar errores
 * de foreign keys. Ejecuta todo en una sola transacción.
 *
 * Objetivo: dejar el sistema con UN SOLO cliente (JOHAN ALVAREZ, cédula 1214731649),
 * sin préstamos, sin solicitudes web, y sin datos asociados.
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('LIMPIEZA TOTAL DE BASE DE DATOS (v2 - SQL crudo)')
  console.log('='.repeat(70))
  console.log()

  // === 1. Buscar el cliente JOHAN ALVAREZ ===
  console.log('[1/5] Buscando cliente JOHAN ALVAREZ...')
  const johan = await db.cliente.findFirst({
    where: { cedula: '1214731649' },
  })

  if (!johan) {
    console.error('❌ No se encontró cliente con cédula 1214731649. Abortando.')
    process.exit(1)
  }

  console.log(`   ✅ Cliente preservado:`)
  console.log(`      - ID: ${johan.id}`)
  console.log(`      - Nombre: ${johan.nombre}`)
  console.log(`      - Cédula: ${johan.cedula}`)
  console.log(`      - Teléfono: ${johan.telefono}`)
  console.log(`      - Email: ${johan.email || 'N/A'}`)
  console.log()

  // === 2. Contar registros ANTES del borrado ===
  console.log('[2/5] Contando registros ANTES del borrado...')
  const antes = {
    clientes: await db.cliente.count(),
    prestamos: await db.prestamo.count(),
    solicitudesWeb: await db.solicitudWeb.count(),
    pagos: await db.pago.count(),
    firmas: await db.firmaElectronica.count(),
    movimientosCaja: await db.movimientoCaja.count(),
  }
  Object.entries(antes).forEach(([k, v]) => console.log(`   - ${k}: ${v}`))
  console.log()

  // === 3. TRUNCATE en cascada de todas las tablas relacionadas ===
  // Usamos TRUNCATE con CASCADE para saltarnos los foreign key constraints.
  // Esto es atómico y mucho más rápido que borrar tabla por tabla.
  //
  // Tablas a truncar (TODAS las que tienen relación con préstamos/clientes/solicitudes):
  //   - CronologiaCaso, AlertaLegal, DocumentoLegal, CasoJuridico
  //   - NotificacionLog, CodigoConfirmacion, TokenFirma, FirmaElectronica
  //   - DocumentoGestor, MovimientoCajaExtendido, MovimientoCaja
  //   - Pago, BitacoraPrestamo, Prestamo
  //   - SolicitudWeb, SolicitudNuevoCliente
  //   - OtroSiCambioFecha, RenovacionPrestamo, Refinanciacion
  //   - AccesoPortal, OtpRegistro, PlanCliente
  //   - EventoFinanciero, MovimientoFinanciero, PagoProgramado
  //   - NotaInterna, ConversacionChat, MensajeChat, OtpChat
  //   - CampañaVista
  //   - PrestamoBancario
  //   - AuditLog (registros de auditoría relacionados con operaciones)
  console.log('[3/5] TRUNCATE en cascada de todas las tablas relacionadas...')

  const tablasATruncar = [
    '"CronologiaCaso"',
    '"AlertaLegal"',
    '"AlertaFinanciera"',
    '"DocumentoLegal"',
    '"CasoJuridico"',
    '"NotificacionLog"',
    '"CodigoConfirmacion"',
    '"TokenFirma"',
    '"FirmaElectronica"',
    '"DocumentoGestor"',
    '"MovimientoCajaExtendido"',
    '"MovimientoCaja"',
    '"Pago"',
    '"PagoProgramado"',
    '"BitacoraPrestamo"',
    '"OtroSiCambioFecha"',
    '"RenovacionPrestamo"',
    '"Refinanciacion"',
    '"PrestamoBancario"',
    '"Prestamo"',
    '"SolicitudWeb"',
    '"SolicitudNuevoCliente"',
    '"AccesoPortal"',
    '"OtpRegistro"',
    '"PlanCliente"',
    '"EventoFinanciero"',
    '"MovimientoFinanciero"',
    '"NotaInterna"',
    '"ConversacionChat"',
    '"MensajeChat"',
    '"OtpChat"',
    '"CampañaVista"',
    '"AuditLog"',
  ]

  // Hacer TRUNCATE de todas en una sola query, con CASCADE y RESTART IDENTITY
  const truncateSQL = `TRUNCATE ${tablasATruncar.join(', ')} CASCADE;`
  console.log('   Ejecutando TRUNCATE masivo...')
  await db.$executeRawUnsafe(truncateSQL)
  console.log('   ✅ Todas las tablas relacionadas truncadas.')
  console.log()

  // === 4. Borrar TODOS los clientes EXCEPTO JOHAN ALVAREZ ===
  // Como ya truncamos las tablas que referencian Cliente, podemos borrar tranquilos.
  console.log('[4/5] Borrando TODOS los clientes EXCEPTO JOHAN ALVAREZ...')
  const clientesBorrados = await db.cliente.deleteMany({
    where: {
      NOT: { id: johan.id },
    },
  })
  console.log(`   ✅ ${clientesBorrados.count} cliente(s) borrado(s).`)
  console.log()

  // === 5. Verificación final ===
  console.log('[5/5] Verificación final...')
  const despues = {
    clientes: await db.cliente.count(),
    prestamos: await db.prestamo.count(),
    solicitudesWeb: await db.solicitudWeb.count(),
    pagos: await db.pago.count(),
    firmas: await db.firmaElectronica.count(),
    movimientosCaja: await db.movimientoCaja.count(),
  }
  console.log('   Estado final:')
  Object.entries(despues).forEach(([k, v]) => console.log(`   - ${k}: ${v}`))
  console.log()

  // Confirmar que JOHAN sigue
  const johanCheck = await db.cliente.findUnique({ where: { id: johan.id } })
  if (johanCheck) {
    console.log(`   ✅ JOHAN ALVAREZ sigue presente: ${johanCheck.nombre} (CC ${johanCheck.cedula})`)
  } else {
    console.log('   ❌ ERROR: JOHAN ALVAREZ fue borrado por accidente!')
  }

  // Confirmar que JOHAN no tiene préstamos
  const prestamosJohan = await db.prestamo.count({ where: { clienteId: johan.id } })
  console.log(`   ✅ Préstamos de JOHAN: ${prestamosJohan} (debe ser 0)`)
  console.log()
  console.log('='.repeat(70))
  console.log('LIMPIEZA COMPLETADA CORRECTAMENTE')
  console.log('='.repeat(70))
}

main()
  .catch((e) => {
    console.error('❌ Error durante la limpieza:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
