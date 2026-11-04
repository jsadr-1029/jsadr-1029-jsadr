// =====================================================
// CORRECCIÓN INTEGRAL del contrato CTR-20261104-000001
// -----------------------------------------------------
// Problemas detectados:
// 1. Tarifa mal guardada: $80 en vez de $80,000
// 2. El PDF muestra fechas erradas (24/10 y 23/01) pero la DB
//    tiene fechas correctas (31/10 y 30/01). Esto es caché de
//    Vercel con un PDF generado anteriormente.
//
// Solución:
// 1. Actualizar tarifa en ContratoDocumentoVehiculo y ContratoVehiculo
// 2. Regenerar las 91 obligaciones con tarifa $80,000
// 3. Generar tokens NUEVOS (conductorToken + propietarioToken)
//    para invalidar cualquier PDF cacheado por el token anterior
// 4. Registrar auditoría
// =====================================================

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const NUMERO_DOC = 'CTR-20261104-000001'
const NUEVA_TARIFA = 80000

function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  console.log('======================================================')
  console.log('CORRECCIÓN INTEGRAL DEL CONTRATO')
  console.log('======================================================')
  console.log(`Documento legal: ${NUMERO_DOC}`)
  console.log(`Nueva tarifa: $${NUEVA_TARIFA.toLocaleString('es-CO')}`)
  console.log('')

  // 1) Buscar documento legal
  const doc = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: NUMERO_DOC },
    include: { contratoVehiculo: { include: { vehiculo: true, conductor: true } } },
  })
  if (!doc) {
    console.log(`[ERROR] No se encontró documento ${NUMERO_DOC}`)
    process.exit(1)
  }

  console.log('=== ANTES DE LA CORRECCIÓN ===')
  console.log(`  Documento legal:`)
  console.log(`    id             : ${doc.id}`)
  console.log(`    numeroContrato : ${doc.numeroContrato}`)
  console.log(`    estado         : ${doc.estado}`)
  console.log(`    fechaInicio    : ${fmt(doc.fechaInicio)}`)
  console.log(`    fechaFin       : ${fmt(doc.fechaFin)}`)
  console.log(`    tarifa (MALA)  : ${doc.tarifa}`)
  console.log(`    conductorToken : ${doc.conductorToken?.slice(0, 24) || 'NULL'}...`)
  console.log(`    propietarioToken: ${doc.propietarioToken?.slice(0, 24) || 'NULL'}...`)
  console.log('')
  console.log(`  ContratoVehiculo:`)
  console.log(`    id             : ${doc.contratoVehiculo.id}`)
  console.log(`    numeroContrato : ${doc.contratoVehiculo.numeroContrato}`)
  console.log(`    tarifa (MALA)  : ${doc.contratoVehiculo.tarifa}`)
  console.log(`    fechaInicio    : ${fmt(doc.contratoVehiculo.fechaInicio)}`)
  console.log(`    fechaFin       : ${fmt(doc.contratoVehiculo.fechaFin)}`)
  console.log('')

  const snapshotAntes = {
    documento: {
      id: doc.id,
      tarifa: doc.tarifa,
      conductorToken: doc.conductorToken,
      propietarioToken: doc.propietarioToken,
    },
    contrato: {
      id: doc.contratoVehiculo.id,
      tarifa: doc.contratoVehiculo.tarifa,
    },
  }

  // 2) Generar nuevos tokens
  const nuevoConductorToken = crypto.randomBytes(32).toString('hex')
  const nuevoPropietarioToken = crypto.randomBytes(32).toString('hex')
  const tokenExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // 3) Actualizar ContratoDocumentoVehiculo
  console.log('=== ACTUALIZANDO DOCUMENTO LEGAL ===')
  await prisma.contratoDocumentoVehiculo.update({
    where: { id: doc.id },
    data: {
      tarifa: NUEVA_TARIFA,
      conductorToken: nuevoConductorToken,
      conductorTokenExpira: tokenExpira,
      propietarioToken: nuevoPropietarioToken,
      propietarioTokenExpira: tokenExpira,
    },
  })
  console.log(`  ✓ Tarifa actualizada: ${doc.tarifa} → ${NUEVA_TARIFA}`)
  console.log(`  ✓ conductorToken nuevo: ${nuevoConductorToken.slice(0, 24)}...`)
  console.log(`  ✓ propietarioToken nuevo: ${nuevoPropietarioToken.slice(0, 24)}...`)
  console.log('')

  // 4) Actualizar ContratoVehiculo
  console.log('=== ACTUALIZANDO CONTRATO VEHÍCULO ===')
  await prisma.contratoVehiculo.update({
    where: { id: doc.contratoVehiculo.id },
    data: { tarifa: NUEVA_TARIFA },
  })
  console.log(`  ✓ Tarifa actualizada: ${doc.contratoVehiculo.tarifa} → ${NUEVA_TARIFA}`)
  console.log('')

  // 5) Regenerar obligaciones PENDIENTES con la nueva tarifa
  console.log('=== REGENERANDO OBLIGACIONES ===')
  const obligs = await prisma.obligacionVehiculo.findMany({
    where: { contratoId: doc.contratoVehiculo.id },
    orderBy: { numeroCuota: 'asc' },
  })
  const pendientes = obligs.filter(o => o.estado === 'PENDIENTE')
  const otras = obligs.filter(o => o.estado !== 'PENDIENTE')
  console.log(`  Total: ${obligs.length}, PENDIENTES (regenerar): ${pendientes.length}, Otras: ${otras.length}`)

  if (pendientes.length > 0) {
    // Eliminar pendientes
    await prisma.obligacionVehiculo.deleteMany({
      where: { contratoId: doc.contratoVehiculo.id, estado: 'PENDIENTE' },
    })
    console.log(`  ✓ Eliminadas ${pendientes.length} obligaciones PENDIENTES`)

    // Recrear con nueva tarifa (manteniendo las fechas originales)
    const maxCuota = otras.reduce((m, o) => Math.max(m, o.numeroCuota || 0), 0)
    for (let i = 0; i < pendientes.length; i++) {
      await prisma.obligacionVehiculo.create({
        data: {
          contratoId: doc.contratoVehiculo.id,
          vehiculoId: doc.contratoVehiculo.vehiculoId,
          conductorId: doc.contratoVehiculo.conductorId,
          numeroCuota: maxCuota + i + 1,
          fechaVencimiento: pendientes[i].fechaVencimiento,
          monto: NUEVA_TARIFA,
          montoPendiente: NUEVA_TARIFA,
          estado: 'PENDIENTE',
        },
      })
    }
    console.log(`  ✓ ${pendientes.length} obligaciones recreadas con tarifa $${NUEVA_TARIFA.toLocaleString('es-CO')}`)
  }
  console.log('')

  // 6) Auditoría
  console.log('=== REGISTRANDO AUDITORÍA ===')
  await prisma.auditoriaVehiculo.create({
    data: {
      entidad: 'CONTRATO_DOCUMENTO',
      entidadId: doc.id,
      accion: 'MODIFICAR',
      descripcion: `CORRECCIÓN INTEGRAL del contrato ${NUMERO_DOC}. ` +
        `Tarifa corregida: ${doc.tarifa} → ${NUEVA_TARIFA}. ` +
        `Tokens regenerados para invalidar PDF cacheado por Vercel. ` +
        `${pendientes.length} obligaciones PENDIENTES recreadas con nueva tarifa. ` +
        `Las fechas en DB ya estaban correctas (31/10/2026 y 30/01/2027), ` +
        `el problema era caché de Vercel.`,
      datosAnteriores: JSON.stringify(snapshotAntes),
      datosNuevos: JSON.stringify({
        documento: { id: doc.id, tarifa: NUEVA_TARIFA, conductorToken: nuevoConductorToken, propietarioToken: nuevoPropietarioToken },
        contrato: { id: doc.contratoVehiculo.id, tarifa: NUEVA_TARIFA },
      }),
      usuarioId: 'system-fix-integral',
      usuarioNombre: 'Script de Corrección Integral',
    },
  })
  console.log('  ✓ Auditoría registrada.')
  console.log('')

  console.log('======================================================')
  console.log('✓ CORRECCIÓN COMPLETADA')
  console.log('======================================================')
  console.log('Resumen:')
  console.log(`  Documento legal: ${NUMERO_DOC}`)
  console.log(`  Contrato vehículo: ${doc.contratoVehiculo.numeroContrato}`)
  console.log(`  Vehículo: ${doc.contratoVehiculo.vehiculo.placa} (${doc.contratoVehiculo.vehiculo.marca} ${doc.contratoVehiculo.vehiculo.modelo})`)
  console.log(`  Conductor: ${doc.contratoVehiculo.conductor.nombre}`)
  console.log(`  Fechas (sin cambios, ya estaban correctas):`)
  console.log(`    inicio: ${fmt(doc.fechaInicio)}`)
  console.log(`    fin:    ${fmt(doc.fechaFin)}`)
  console.log(`  Tarifa corregida: $${doc.tarifa} → $${NUEVA_TARIFA.toLocaleString('es-CO')}`)
  console.log(`  Obligaciones: ${pendientes.length} recreadas con nueva tarifa`)
  console.log(`  Tokens: NUEVOS (los viejos ya no funcionan, invalida cualquier PDF cacheado)`)
  console.log('')
  console.log('=== NUEVOS TOKENS PARA FIRMA / DESCARGA ===')
  console.log(`Conductor: ${nuevoConductorToken}`)
  console.log(`Propietario: ${nuevoPropietarioToken}`)
  console.log('')
  console.log('=== URL para vista previa / descarga del PDF ===')
  console.log(`/api/vehiculos/contrato-legal/descargar?token=${nuevoConductorToken}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('[FATAL] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
