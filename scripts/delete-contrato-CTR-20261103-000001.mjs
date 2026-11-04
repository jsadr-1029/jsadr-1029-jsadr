// =====================================================
// ELIMINACIÓN COMPLETA del contrato CTR-20261103-000001
// -----------------------------------------------------
// Elimina POR COMPLETO todos los registros relacionados con
// el contrato legal CTR-20261103-000001:
//
// 1) ContratoDocumentoVehiculo (con numeroContrato = 'CTR-20261103-000001')
// 2) El ContratoVehiculo relacionado (CONTR-20261103-001)
// 3) Todas las ObligacionVehiculo
// 4) Todos los PagoVehiculo (y comprobantes)
// 5) MantenimientoVehiculo (y repuestos)
// 6) CuentaPagoVehiculo
// 7) CodigoQRVehiculo
// 8) ReciboPagoVehiculo
// 9) ReservaVehiculo
// 10) Libera el vehículo (estado -> DISPONIBLE)
// 11) Registra auditoría con snapshot previo
// =====================================================

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const NUMERO_DOC_LEGAL = 'CTR-20261103-000001'

function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  console.log('======================================================')
  console.log('ELIMINACIÓN COMPLETA DEL CONTRATO')
  console.log('======================================================')
  console.log(`Documento legal a eliminar: ${NUMERO_DOC_LEGAL}`)
  console.log('')

  // 1) Buscar el documento legal
  const doc = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: NUMERO_DOC_LEGAL },
  })

  if (!doc) {
    console.log(`[ERROR] No se encontró documento legal con numeroContrato = ${NUMERO_DOC_LEGAL}`)
    console.log('Posiblemente ya fue eliminado.')
    process.exit(0)
  }

  console.log(`Documento legal encontrado:`)
  console.log(`  id                : ${doc.id}`)
  console.log(`  numeroContrato    : ${doc.numeroContrato}`)
  console.log(`  contratoVehiculoId: ${doc.contratoVehiculoId}`)
  console.log(`  estado            : ${doc.estado}`)
  console.log(`  fechaInicio       : ${fmt(doc.fechaInicio)}`)
  console.log(`  fechaFin          : ${fmt(doc.fechaFin)}`)
  console.log(`  vehiculoPlaca     : ${doc.vehiculoPlaca}`)
  console.log(`  conductorNombre   : ${doc.conductorNombre}`)
  console.log('')

  // 2) Buscar el ContratoVehiculo relacionado con TODO
  const contratoVehiculoId = doc.contratoVehiculoId
  const contrato = await prisma.contratoVehiculo.findUnique({
    where: { id: contratoVehiculoId },
    include: {
      vehiculo: true,
      conductor: true,
      documentosContrato: true,
      obligaciones: true,
      pagos: true,
      mantenimientos: true,
      cuentasPago: true,
      codigosQR: true,
      recibos: true,
      reservas: true,
    },
  })

  if (!contrato) {
    console.log(`[WARN] El ContratoVehiculo con id ${contratoVehiculoId} no existe (posiblemente ya fue eliminado).`)
    console.log('Solo se eliminará el documento legal.')
  } else {
    console.log(`=== ContratoVehiculo relacionado ===`)
    console.log(`  id                : ${contrato.id}`)
    console.log(`  numeroContrato    : ${contrato.numeroContrato}`)
    console.log(`  estado            : ${contrato.estado}`)
    console.log(`  fechaInicio       : ${fmt(contrato.fechaInicio)}`)
    console.log(`  fechaFin          : ${fmt(contrato.fechaFin)}`)
    console.log(`  vehiculo          : ${contrato.vehiculo?.placa} (${contrato.vehiculo?.marca} ${contrato.vehiculo?.modelo})`)
    console.log(`  conductor         : ${contrato.conductor?.nombre} (CC ${contrato.conductor?.cedula})`)
    console.log('')
    console.log('=== Conteo de registros relacionados ===')
    console.log(`  documentosContrato : ${contrato.documentosContrato.length}`)
    console.log(`  obligaciones       : ${contrato.obligaciones.length}`)
    console.log(`  pagos              : ${contrato.pagos.length}`)
    console.log(`  mantenimientos     : ${contrato.mantenimientos.length}`)
    console.log(`  cuentasPago        : ${contrato.cuentasPago.length}`)
    console.log(`  codigosQR          : ${contrato.codigosQR.length}`)
    console.log(`  recibos            : ${contrato.recibos.length}`)
    console.log(`  reservas           : ${contrato.reservas.length}`)
    console.log('')
  }

  // 3) Snapshot para auditoría (antes de borrar)
  const snapshot = {
    documentoLegal: {
      id: doc.id,
      numeroContrato: doc.numeroContrato,
      estado: doc.estado,
      fechaInicio: doc.fechaInicio,
      fechaFin: doc.fechaFin,
    },
    contratoVehiculo: contrato ? {
      id: contrato.id,
      numeroContrato: contrato.numeroContrato,
      estado: contrato.estado,
      fechaInicio: contrato.fechaInicio,
      fechaFin: contrato.fechaFin,
      vehiculoId: contrato.vehiculoId,
      conductorId: contrato.conductorId,
    } : null,
    vehiculo: contrato?.vehiculo ? {
      placa: contrato.vehiculo.placa,
      estado: contrato.vehiculo.estado,
    } : null,
    counts: contrato ? {
      documentosContrato: contrato.documentosContrato.length,
      obligaciones: contrato.obligaciones.length,
      pagos: contrato.pagos.length,
      mantenimientos: contrato.mantenimientos.length,
      cuentasPago: contrato.cuentasPago.length,
      codigosQR: contrato.codigosQR.length,
      recibos: contrato.recibos.length,
      reservas: contrato.reservas.length,
    } : { documentosContrato: 1 },
  }

  // 4) ELIMINAR todos los registros relacionados
  console.log('=== ELIMINANDO REGISTROS RELACIONADOS ===')

  if (contrato) {
    // Documentos legales
    console.log(`  Borrando ${contrato.documentosContrato.length} documento(s) legal(es)...`)
    await prisma.contratoDocumentoVehiculo.deleteMany({
      where: { contratoVehiculoId: contrato.id },
    })

    // Reservas
    if (contrato.reservas.length > 0) {
      console.log(`  Borrando ${contrato.reservas.length} reserva(s)...`)
      await prisma.reservaVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Recibos
    if (contrato.recibos.length > 0) {
      console.log(`  Borrando ${contrato.recibos.length} recibo(s)...`)
      await prisma.reciboPagoVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Códigos QR
    if (contrato.codigosQR.length > 0) {
      console.log(`  Borrando ${contrato.codigosQR.length} código(s) QR...`)
      await prisma.codigoQRVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Cuentas de pago
    if (contrato.cuentasPago.length > 0) {
      console.log(`  Borrando ${contrato.cuentasPago.length} cuenta(s) de pago...`)
      await prisma.cuentaPagoVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Mantenimientos (con repuestos si existen)
    if (contrato.mantenimientos.length > 0) {
      console.log(`  Borrando ${contrato.mantenimientos.length} mantenimiento(s)...`)
      for (const m of contrato.mantenimientos) {
        await prisma.repuestoMantenimientoVehiculo.deleteMany({
          where: { mantenimientoId: m.id },
        }).catch(() => {})
      }
      await prisma.mantenimientoVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Pagos (con comprobantes si existen)
    if (contrato.pagos.length > 0) {
      console.log(`  Borrando ${contrato.pagos.length} pago(s)...`)
      for (const p of contrato.pagos) {
        await prisma.comprobantePagoVehiculo.deleteMany({
          where: { pagoId: p.id },
        }).catch(() => {})
      }
      await prisma.pagoVehiculo.deleteMany({
        where: { contratoId: contrato.id },
      })
    }

    // Obligaciones
    console.log(`  Borrando ${contrato.obligaciones.length} obligacion(es)...`)
    await prisma.obligacionVehiculo.deleteMany({
      where: { contratoId: contrato.id },
    })

    // Finalmente, el ContratoVehiculo
    console.log(`  Borrando ContratoVehiculo ${contrato.numeroContrato}...`)
    await prisma.contratoVehiculo.delete({
      where: { id: contrato.id },
    })

    // Liberar vehículo (marcar como DISPONIBLE)
    if (contrato.vehiculoId) {
      console.log(`  Liberando vehículo (estado: ASIGNADO -> DISPONIBLE)...`)
      await prisma.vehiculo.update({
        where: { id: contrato.vehiculoId },
        data: { estado: 'DISPONIBLE' },
      })
    }
  } else {
    // Solo borrar el documento legal (ContratoVehiculo ya no existe)
    console.log(`  Borrando solo el documento legal ${doc.numeroContrato}...`)
    await prisma.contratoDocumentoVehiculo.delete({
      where: { id: doc.id },
    })
  }
  console.log('  ✓ Eliminación completa.')
  console.log('')

  // 5) Registrar auditoría
  console.log('=== REGISTRANDO AUDITORÍA ===')
  await prisma.auditoriaVehiculo.create({
    data: {
      entidad: 'CONTRATO',
      entidadId: contratoVehiculoId,
      accion: 'ELIMINAR',
      descripcion: `ELIMINACIÓN COMPLETA del contrato legal ${NUMERO_DOC_LEGAL}. ` +
        (contrato
          ? `ContratoVehiculo ${contrato.numeroContrato} eliminado junto con: ` +
            `${contrato.documentosContrato.length} documento(s) legal(es), ` +
            `${contrato.obligaciones.length} obligacion(es), ` +
            `${contrato.pagos.length} pago(s), ` +
            `${contrato.mantenimientos.length} mantenimiento(s), ` +
            `${contrato.cuentasPago.length} cuenta(s) de pago, ` +
            `${contrato.codigosQR.length} codigo(s) QR, ` +
            `${contrato.recibos.length} recibo(s), ` +
            `${contrato.reservas.length} reserva(s). ` +
            `Vehículo ${contrato.vehiculo?.placa} liberado (DISPONIBLE).`
          : 'Solo el documento legal existía.'),
      datosAnteriores: JSON.stringify(snapshot),
      datosNuevos: null,
      usuarioId: 'system-delete-script',
      usuarioNombre: 'Script de Eliminación',
    },
  })
  console.log('  ✓ Auditoría registrada.')
  console.log('')

  console.log('======================================================')
  console.log('✓ ELIMINACIÓN COMPLETADA')
  console.log('======================================================')
  console.log('Resumen:')
  console.log(`  Documento legal eliminado: ${NUMERO_DOC_LEGAL}`)
  if (contrato) {
    console.log(`  ContratoVehiculo eliminado: ${contrato.numeroContrato}`)
    console.log(`  Vehículo liberado: ${contrato.vehiculo?.placa}`)
    console.log(`  Registros eliminados: ${contrato.documentosContrato.length + contrato.obligaciones.length + contrato.pagos.length + contrato.mantenimientos.length + contrato.cuentasPago.length + contrato.codigosQR.length + contrato.recibos.length + contrato.reservas.length + 1}`)
  }
  console.log('')
}

main()
  .catch((e) => {
    console.error('[FATAL] Error durante la eliminación:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
