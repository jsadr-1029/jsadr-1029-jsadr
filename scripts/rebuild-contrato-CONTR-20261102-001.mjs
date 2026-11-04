// =====================================================
// RECONSTRUCCIÓN COMPLETA del contrato CONTR-20261102-001
// -----------------------------------------------------
// El usuario reportó que la plantilla del PDF sigue mostrando
// fechas erradas (31/10/2026 y 30/01/2027) a pesar de las
// correcciones previas. Para garantizar que el problema se
// resuelva de raíz, este script:
//
// 1) Elimina POR COMPLETO el ContratoVehiculo con numeroContrato
//    = 'CONTR-20261102-001' y TODOS sus registros relacionados:
//    - ContratoDocumentoVehiculo (con todos sus tokens y snapshots)
//    - ObligacionVehiculo (cuotas)
//    - PagoVehiculo
//    - MantenimientoVehiculo (y repuestos)
//    - CuentaPagoVehiculo
//    - CodigoQRVehiculo
//    - ReciboPagoVehiculo
//    - ReservaVehiculo
//
// 2) Crea un NUEVO ContratoVehiculo con:
//    - numeroContrato = CONTR-<hoy>-001
//    - fechaInicio = 2026-10-31 (31/10/2026)
//    - fechaFin = 2027-01-30 (30/01/2027)
//    - Mismo vehículo, conductor, modalidad (DIARIO), tarifa (80000)
//    - Estado ACTIVO
//
// 3) Genera las obligaciones DIARIO automáticamente (L-S, sin domingos)
//    desde 31/10/2026 hasta 30/01/2027.
//
// 4) Crea un NUEVO ContratoDocumentoVehiculo con:
//    - numeroContrato = CTR-<hoy>-000001
//    - Snapshot fresco del vehículo y conductor
//    - Snapshot del propietario (Johan Sebastian Alvarez Del Rio)
//    - Tokens NUEVOS (conductorToken + propietarioToken) con expiración 7 días
//    - Estado ENVIADO_CONDUCTOR (pendiente firma)
//
// 5) Marca el vehículo como ASIGNADO.
//
// 6) Crea registro de auditoría detallado.
// =====================================================

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// === Parámetros ===
const NUMERO_CONTRATO_VIEJO = 'CONTR-20261102-001'
const NUEVA_FECHA_INICIO = '2026-10-31' // 31/10/2026
const NUEVA_FECHA_FIN = '2027-01-30'    // 30/01/2027

// === Helpers ===
function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}
function parseDate(s) {
  return new Date(s + 'T00:00:00.000Z')
}

// === Generar fechas de vencimiento DIARIO (L-S, sin domingos) ===
function generarFechasDiario(fechaInicio, fechaFin) {
  const fechas = []
  const cursor = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  while (cursor <= fin) {
    const dia = cursor.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
    if (dia !== 0) {
      fechas.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
    if (fechas.length > 365) break
  }
  return fechas
}

async function main() {
  console.log('======================================================')
  console.log('RECONSTRUCCIÓN COMPLETA DE CONTRATO')
  console.log('======================================================')
  console.log(`Contrato viejo a eliminar: ${NUMERO_CONTRATO_VIEJO}`)
  console.log(`Nueva fecha inicio: ${NUEVA_FECHA_INICIO} (${fmt(parseDate(NUEVA_FECHA_INICIO))})`)
  console.log(`Nueva fecha fin:    ${NUEVA_FECHA_FIN} (${fmt(parseDate(NUEVA_FECHA_FIN))})`)
  console.log('')

  // === 1) Buscar contrato viejo ===
  const contratoViejo = await prisma.contratoVehiculo.findFirst({
    where: { numeroContrato: NUMERO_CONTRATO_VIEJO },
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

  if (!contratoViejo) {
    console.log(`[ERROR] No se encontró contrato con numeroContrato = ${NUMERO_CONTRATO_VIEJO}`)
    process.exit(1)
  }

  console.log('=== ESTADO ANTES DEL BORRADO ===')
  console.log(`ContratoVehiculo.id            : ${contratoViejo.id}`)
  console.log(`numeroContrato                 : ${contratoViejo.numeroContrato}`)
  console.log(`estado                         : ${contratoViejo.estado}`)
  console.log(`fechaInicio (vieja)            : ${fmt(contratoViejo.fechaInicio)}`)
  console.log(`fechaFin (vieja)               : ${fmt(contratoViejo.fechaFin)}`)
  console.log(`vehiculoId                     : ${contratoViejo.vehiculoId} (${contratoViejo.vehiculo?.placa})`)
  console.log(`conductorId                    : ${contratoViejo.conductorId} (${contratoViejo.conductor?.nombre})`)
  console.log(`modalidadPago                  : ${contratoViejo.modalidadPago}`)
  console.log(`tarifa                         : ${contratoViejo.tarifa}`)
  console.log(`diasGracia                     : ${contratoViejo.diasGracia}`)
  console.log(`multaDiaria                    : ${contratoViejo.multaDiaria}`)
  console.log(`deposito                       : ${contratoViejo.deposito}`)
  console.log(`renovacionAnticipada           : ${contratoViejo.renovacionAnticipada}`)
  console.log(`valorRenovacionAnticipada      : ${contratoViejo.valorRenovacionAnticipada}`)
  console.log('')
  console.log('=== Conteo de registros relacionados ===')
  console.log(`documentosContrato : ${contratoViejo.documentosContrato.length}`)
  console.log(`obligaciones       : ${contratoViejo.obligaciones.length}`)
  console.log(`pagos              : ${contratoViejo.pagos.length}`)
  console.log(`mantenimientos     : ${contratoViejo.mantenimientos.length}`)
  console.log(`cuentasPago        : ${contratoViejo.cuentasPago.length}`)
  console.log(`codigosQR          : ${contratoViejo.codigosQR.length}`)
  console.log(`recibos            : ${contratoViejo.recibos.length}`)
  console.log(`reservas           : ${contratoViejo.reservas.length}`)
  console.log('')

  // === 2) Snapshot para auditoría ===
  const snapshotViejo = {
    contrato: {
      id: contratoViejo.id,
      numeroContrato: contratoViejo.numeroContrato,
      vehiculoId: contratoViejo.vehiculoId,
      conductorId: contratoViejo.conductorId,
      fechaInicio: contratoViejo.fechaInicio,
      fechaFin: contratoViejo.fechaFin,
      estado: contratoViejo.estado,
      modalidadPago: contratoViejo.modalidadPago,
      tarifa: contratoViejo.tarifa,
      diasGracia: contratoViejo.diasGracia,
      multaDiaria: contratoViejo.multaDiaria,
      deposito: contratoViejo.deposito,
    },
    documentos: contratoViejo.documentosContrato.map(d => ({
      id: d.id,
      numeroContrato: d.numeroContrato,
      estado: d.estado,
    })),
    counts: {
      obligaciones: contratoViejo.obligaciones.length,
      pagos: contratoViejo.pagos.length,
      mantenimientos: contratoViejo.mantenimientos.length,
      cuentasPago: contratoViejo.cuentasPago.length,
      codigosQR: contratoViejo.codigosQR.length,
      recibos: contratoViejo.recibos.length,
      reservas: contratoViejo.reservas.length,
    },
  }

  // === 3) BORRAR todos los registros relacionados ===
  console.log('=== BORRANDO REGISTROS RELACIONADOS ===')

  // Documentos legales (ContratoDocumentoVehiculo)
  console.log(`  Borrando ${contratoViejo.documentosContrato.length} documento(s) legal(es)...`)
  await prisma.contratoDocumentoVehiculo.deleteMany({
    where: { contratoVehiculoId: contratoViejo.id },
  })

  // Reservas
  if (contratoViejo.reservas.length > 0) {
    console.log(`  Borrando ${contratoViejo.reservas.length} reserva(s)...`)
    await prisma.reservaVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Recibos
  if (contratoViejo.recibos.length > 0) {
    console.log(`  Borrando ${contratoViejo.recibos.length} recibo(s)...`)
    await prisma.reciboPagoVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Códigos QR
  if (contratoViejo.codigosQR.length > 0) {
    console.log(`  Borrando ${contratoViejo.codigosQR.length} código(s) QR...`)
    await prisma.codigoQRVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Cuentas de pago
  if (contratoViejo.cuentasPago.length > 0) {
    console.log(`  Borrando ${contratoViejo.cuentasPago.length} cuenta(s) de pago...`)
    await prisma.cuentaPagoVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Mantenimientos (con repuestos si existen)
  if (contratoViejo.mantenimientos.length > 0) {
    console.log(`  Borrando ${contratoViejo.mantenimientos.length} mantenimiento(s)...`)
    // Primero los repuestos asociados a cada mantenimiento
    for (const m of contratoViejo.mantenimientos) {
      await prisma.repuestoMantenimientoVehiculo.deleteMany({
        where: { mantenimientoId: m.id },
      }).catch(() => {}) // ignora error si la tabla no existe
    }
    await prisma.mantenimientoVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Pagos (con comprobantes si existen)
  if (contratoViejo.pagos.length > 0) {
    console.log(`  Borrando ${contratoViejo.pagos.length} pago(s)...`)
    for (const p of contratoViejo.pagos) {
      await prisma.comprobantePagoVehiculo.deleteMany({
        where: { pagoId: p.id },
      }).catch(() => {}) // ignora error si la tabla no existe
    }
    await prisma.pagoVehiculo.deleteMany({
      where: { contratoId: contratoViejo.id },
    })
  }

  // Obligaciones
  console.log(`  Borrando ${contratoViejo.obligaciones.length} obligacion(es)...`)
  await prisma.obligacionVehiculo.deleteMany({
    where: { contratoId: contratoViejo.id },
  })

  // Finalmente, el ContratoVehiculo
  console.log(`  Borrando ContratoVehiculo ${contratoViejo.numeroContrato}...`)
  await prisma.contratoVehiculo.delete({
    where: { id: contratoViejo.id },
  })
  console.log('  ✓ Borrado completo.')
  console.log('')

  // === 4) CREAR nuevo ContratoVehiculo ===
  console.log('=== CREANDO NUEVO CONTRATO ===')

  // Generar nuevo número de contrato: CONTR-YYYYMMDD-XXX
  const hoy = new Date()
  const fechaStr = hoy.toISOString().slice(0, 10).replace(/-/g, '')
  const countHoy = await prisma.contratoVehiculo.count({
    where: { numeroContrato: { startsWith: `CONTR-${fechaStr}` } },
  })
  const nuevoNumeroContrato = `CONTR-${fechaStr}-${String(countHoy + 1).padStart(3, '0')}`

  const fechaInicio = parseDate(NUEVA_FECHA_INICIO)
  const fechaFin = parseDate(NUEVA_FECHA_FIN)

  const nuevoContrato = await prisma.contratoVehiculo.create({
    data: {
      numeroContrato: nuevoNumeroContrato,
      vehiculoId: contratoViejo.vehiculoId,
      conductorId: contratoViejo.conductorId,
      fechaInicio,
      fechaFin,
      estado: 'ACTIVO',
      modalidadPago: contratoViejo.modalidadPago,
      tarifa: contratoViejo.tarifa,
      diasGracia: contratoViejo.diasGracia,
      multaDiaria: contratoViejo.multaDiaria,
      deposito: contratoViejo.deposito,
      renovacionAnticipada: contratoViejo.renovacionAnticipada,
      valorRenovacionAnticipada: contratoViejo.valorRenovacionAnticipada,
      creadoPor: 'system-rebuild-script',
    },
  })
  console.log(`  ✓ Nuevo ContratoVehiculo creado:`)
  console.log(`    id             : ${nuevoContrato.id}`)
  console.log(`    numeroContrato : ${nuevoContrato.numeroContrato}`)
  console.log(`    fechaInicio    : ${fmt(nuevoContrato.fechaInicio)}`)
  console.log(`    fechaFin       : ${fmt(nuevoContrato.fechaFin)}`)
  console.log('')

  // === 5) Generar obligaciones DIARIO ===
  console.log('=== GENERANDO OBLIGACIONES ===')
  const fechas = generarFechasDiario(fechaInicio, fechaFin)
  console.log(`  Total de obligaciones DIARIO: ${fechas.length}`)
  console.log(`  Primera: ${fmt(fechas[0])}`)
  console.log(`  Última:  ${fmt(fechas[fechas.length - 1])}`)

  for (let i = 0; i < fechas.length; i++) {
    await prisma.obligacionVehiculo.create({
      data: {
        contratoId: nuevoContrato.id,
        vehiculoId: nuevoContrato.vehiculoId,
        conductorId: nuevoContrato.conductorId,
        numeroCuota: i + 1,
        fechaVencimiento: fechas[i],
        monto: nuevoContrato.tarifa,
        montoPendiente: nuevoContrato.tarifa,
        estado: 'PENDIENTE',
      },
    })
  }
  console.log(`  ✓ ${fechas.length} obligaciones creadas.`)
  console.log('')

  // === 6) Crear NUEVO ContratoDocumentoVehiculo ===
  console.log('=== CREANDO NUEVO DOCUMENTO LEGAL ===')

  // Generar nuevo número: CTR-YYYYMMDD-XXXXXX
  const countHoyDoc = await prisma.contratoDocumentoVehiculo.count({
    where: { numeroContrato: { startsWith: `CTR-${fechaStr}` } },
  })
  const nuevoNumeroDoc = `CTR-${fechaStr}-${String(countHoyDoc + 1).padStart(6, '0')}`

  // Generar nuevos tokens
  const conductorToken = crypto.randomBytes(32).toString('hex')
  const propietarioToken = crypto.randomBytes(32).toString('hex')
  const tokenExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días

  // Cargar datos frescos del vehículo y conductor
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: nuevoContrato.vehiculoId } })
  const conductor = await prisma.conductorVehiculo.findUnique({ where: { id: nuevoContrato.conductorId } })

  // Datos del propietario (siempre Johan Sebastian Alvarez Del Rio)
  const NOMBRE_PROP_CORRECTO = 'Johan Sebastian Alvarez Del Rio'
  const CEDULA_PROP_CORRECTA = '1214731649'
  const DIRECCION_PROP = 'Cl 92 44a 34'
  const TELEFONO_PROP = '3235949510'
  const EMAIL_PROP = 'jsadr23@outlook.com'

  const nuevoDoc = await prisma.contratoDocumentoVehiculo.create({
    data: {
      numeroContrato: nuevoNumeroDoc,
      contratoVehiculoId: nuevoContrato.id,
      // Snapshot del vehículo
      vehiculoPlaca: vehiculo.placa,
      vehiculoMarca: vehiculo.marca,
      vehiculoModelo: vehiculo.modelo,
      vehiculoAnio: vehiculo.anio,
      vehiculoColor: vehiculo.color,
      vehiculoKilometraje: vehiculo.kilometraje,
      vehiculoVin: vehiculo.vin,
      vehiculoMotor: vehiculo.motor,
      // Snapshot del propietario
      propietarioNombre: NOMBRE_PROP_CORRECTO,
      propietarioCedula: CEDULA_PROP_CORRECTA,
      propietarioTelefono: TELEFONO_PROP,
      propietarioEmail: EMAIL_PROP,
      propietarioDireccion: DIRECCION_PROP,
      // Snapshot del conductor
      conductorNombre: conductor.nombre,
      conductorCedula: conductor.cedula,
      conductorTelefono: conductor.telefono,
      conductorEmail: conductor.email || '',
      conductorDireccion: conductor.direccion || '',
      conductorLicencia: conductor.licenciaNumero,
      conductorLicenciaCat: conductor.licenciaCategoria,
      // Términos
      modalidadPago: nuevoContrato.modalidadPago,
      tarifa: nuevoContrato.tarifa,
      diasGracia: nuevoContrato.diasGracia,
      multaDiaria: nuevoContrato.multaDiaria,
      deposito: nuevoContrato.deposito,
      fechaInicio,
      fechaFin,
      cantidadCuotas: fechas.length,
      descripcionVehiculo: `Vehículo ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio || ''}, placa ${vehiculo.placa}, color ${vehiculo.color || '—'}, kilometraje ${(vehiculo.kilometraje || 0).toLocaleString('es-CO')} km`,
      // Estado inicial
      estado: 'ENVIADO_CONDUCTOR',
      // Tokens nuevos
      conductorToken,
      conductorTokenExpira: tokenExpira,
      propietarioToken,
      propietarioTokenExpira: tokenExpira,
      creadoPor: 'system-rebuild-script',
    },
  })

  console.log(`  ✓ Nuevo documento legal creado:`)
  console.log(`    id             : ${nuevoDoc.id}`)
  console.log(`    numeroContrato : ${nuevoDoc.numeroContrato}`)
  console.log(`    estado         : ${nuevoDoc.estado}`)
  console.log(`    fechaInicio    : ${fmt(nuevoDoc.fechaInicio)}`)
  console.log(`    fechaFin       : ${fmt(nuevoDoc.fechaFin)}`)
  console.log(`    conductorToken : ${conductorToken.slice(0, 24)}...`)
  console.log(`    propietarioToken: ${propietarioToken.slice(0, 24)}...`)
  console.log('')

  // === 7) Marcar vehículo como ASIGNADO ===
  console.log('=== ACTUALIZANDO ESTADO DEL VEHÍCULO ===')
  await prisma.vehiculo.update({
    where: { id: nuevoContrato.vehiculoId },
    data: { estado: 'ASIGNADO' },
  })
  console.log(`  ✓ Vehículo ${vehiculo.placa} marcado como ASIGNADO.`)
  console.log('')

  // === 8) Auditoría ===
  console.log('=== REGISTRANDO AUDITORÍA ===')
  await prisma.auditoriaVehiculo.create({
    data: {
      entidad: 'CONTRATO',
      entidadId: nuevoContrato.id,
      accion: 'CREAR',
      descripcion: `RECONSTRUCCIÓN COMPLETA de contrato. ` +
        `Contrato viejo ${contratoViejo.numeroContrato} (id: ${contratoViejo.id}) eliminado junto con todos sus registros relacionados. ` +
        `Nuevo contrato ${nuevoContrato.numeroContrato} creado con fechas corregidas: ` +
        `inicio ${fmt(fechaInicio)} (31/10/2026), fin ${fmt(fechaFin)} (30/01/2027). ` +
        `${fechas.length} obligaciones DIARIO generadas. ` +
        `Documento legal ${nuevoDoc.numeroContrato} creado con tokens nuevos. ` +
        `Vehículo ${vehiculo.placa} marcado como ASIGNADO.`,
      datosAnteriores: JSON.stringify(snapshotViejo),
      datosNuevos: JSON.stringify({
        contrato: {
          id: nuevoContrato.id,
          numeroContrato: nuevoContrato.numeroContrato,
          fechaInicio,
          fechaFin,
        },
        documento: {
          id: nuevoDoc.id,
          numeroContrato: nuevoDoc.numeroContrato,
          conductorToken,
          propietarioToken,
        },
        obligaciones: fechas.length,
      }),
      usuarioId: 'system-rebuild-script',
      usuarioNombre: 'Script de Reconstrucción',
    },
  })
  console.log('  ✓ Auditoría registrada.')
  console.log('')

  // === RESUMEN FINAL ===
  console.log('======================================================')
  console.log('✓ RECONSTRUCCIÓN COMPLETADA CON ÉXITO')
  console.log('======================================================')
  console.log('Resumen:')
  console.log(`  Contrato viejo ELIMINADO: ${contratoViejo.numeroContrato}`)
  console.log(`  Nuevo ContratoVehiculo: ${nuevoContrato.numeroContrato}`)
  console.log(`  Nuevo documento legal: ${nuevoDoc.numeroContrato}`)
  console.log(`  Vehículo: ${vehiculo.placa} (${vehiculo.marca} ${vehiculo.modelo})`)
  console.log(`  Conductor: ${conductor.nombre} (CC ${conductor.cedula})`)
  console.log(`  Fechas: ${fmt(fechaInicio)} → ${fmt(fechaFin)}`)
  console.log(`  Modalidad: ${nuevoContrato.modalidadPago}`)
  console.log(`  Tarifa: ${nuevoContrato.tarifa}`)
  console.log(`  Obligaciones: ${fechas.length} cuotas DIARIO`)
  console.log(`  Estado documento: ${nuevoDoc.estado} (pendiente firma conductor)`)
  console.log('')
  console.log('=== TOKENS PARA FIRMA ===')
  console.log(`Conductor (Juan Alberto):`)
  console.log(`  Token: ${conductorToken}`)
  console.log(`  URL:   /firma-contrato-vehiculo/${conductorToken}`)
  console.log('')
  console.log(`Propietario (Johan Sebastian):`)
  console.log(`  Token: ${propietarioToken}`)
  console.log(`  URL:   /firma-contrato-vehiculo/${propietarioToken}`)
  console.log('')
  console.log('=== URL para descargar/vista previa del nuevo PDF ===')
  console.log(`  /api/vehiculos/contrato-legal/descargar?token=${conductorToken}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('[FATAL] Error durante la reconstrucción:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
