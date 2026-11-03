// =====================================================
// FIX DE FECHAS — Contrato CTR-20261103-000001
// -----------------------------------------------------
// Problema reportado:
//   - Fecha de inicio almacenada:  24/10/2026  → debe ser 31/10/2026
//   - Fecha de terminación almacenada: 23/01/2027 → debe ser 30/01/2027
//
// El contrato se descarga desde "Gestión de Vehículos → Contratos → Vista previa",
// que lee de la tabla ContratoDocumentoVehiculo (snapshot). Ese snapshot se creó
// copiando fechaInicio/fechaFin de ContratoVehiculo en el momento de generar
// el documento legal, por lo que AMBAS tablas quedaron con las fechas erradas.
//
// Este script:
//   1) Localiza el ContratoDocumentoVehiculo por numeroContrato.
//   2) Actualiza fechaInicio y fechaFin en ContratoDocumentoVehiculo.
//   3) Actualiza fechaInicio y fechaFin en el ContratoVehiculo relacionado.
//   4) Regenera las obligaciones PENDIENTES con base en la nueva fechaInicio
//      (las obligaciones PAGADAS/PARCiales se conservan tal cual).
//   5) Crea un registro de Auditoría dejando constancia del cambio.
//
// Uso:
//   cd /home/z/my-project
//   node --experimental-vm-modules scripts/fix-fechas-contrato-CTR-20261103-000001.mjs
//   (o con bun: bun scripts/fix-fechas-contrato-CTR-20261103-000001.mjs)
// =====================================================

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

// Cargar .env explícitamente (igual que src/lib/db.ts)
config({ path: '.env' })

// Forzar DATABASE_URL desde .env si es Postgres (igual que src/lib/db.ts)
import fs from 'fs'
import path from 'path'
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/^DATABASE_URL=(.+)$/m)
    if (match && match[1]) {
      const url = match[1].trim().replace(/^["']|["']$/g, '')
      if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
        process.env.DATABASE_URL = url
      }
    }
  }
} catch (e) {
  // silenciar
}

const prisma = new PrismaClient()

// === Parámetros de la corrección ===
const NUMERO_CONTRATO = 'CTR-20261103-000001'
const NUEVA_FECHA_INICIO = '2026-10-31'   // 31/10/2026
const NUEVA_FECHA_FIN = '2027-01-30'     // 30/01/2027

// Helper: convertir YYYY-MM-DD a Date a medianoche UTC
// (igual que hace new Date('YYYY-MM-DD') en el API original)
function parseDate(s) {
  return new Date(s + 'T00:00:00.000Z')
}

// Helper: generar fechas de vencimiento para modalidad DIARIO (L-S, sin domingos)
function generarFechasVencimientoDiario(fechaInicio, cantidadCuotas) {
  const fechas = []
  const base = new Date(fechaInicio)
  let cursor = new Date(base)
  let generadas = 0
  while (generadas < cantidadCuotas) {
    const dia = cursor.getDay() // 0=Dom, 1=Lun, ..., 6=Sab
    if (dia !== 0) {
      fechas.push(new Date(cursor))
      generadas++
    }
    cursor.setDate(cursor.getDate() + 1)
    if (fechas.length > 365) break
  }
  return fechas
}

// Helper: formato legible de fecha
function fmtFecha(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  console.log('======================================================')
  console.log(`FIX DE FECHAS — Contrato ${NUMERO_CONTRATO}`)
  console.log('======================================================')
  console.log(`Nuevas fechas: inicio ${NUEVA_FECHA_INICIO} (${fmtFecha(parseDate(NUEVA_FECHA_INICIO))})`)
  console.log(`               fin    ${NUEVA_FECHA_FIN} (${fmtFecha(parseDate(NUEVA_FECHA_FIN))})`)
  console.log('')

  // 1) Buscar el documento legal
  const documento = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: NUMERO_CONTRATO },
    include: { contratoVehiculo: true },
  })

  if (!documento) {
    console.error(`[ERROR] No se encontró ningún documento legal con numeroContrato = ${NUMERO_CONTRATO}`)
    console.error('        Verifica que el contrato exista y que el número esté escrito exactamente igual.')
    process.exit(1)
  }

  console.log('[BEFORE] ContratoDocumentoVehiculo:')
  console.log('  id                :', documento.id)
  console.log('  numeroContrato    :', documento.numeroContrato)
  console.log('  contratoVehiculoId:', documento.contratoVehiculoId)
  console.log('  estado            :', documento.estado)
  console.log('  fechaInicio       :', documento.fechaInicio, '→', fmtFecha(documento.fechaInicio))
  console.log('  fechaFin          :', documento.fechaFin, '→', fmtFecha(documento.fechaFin))
  console.log('  modalidadPago     :', documento.modalidadPago)
  console.log('  tarifa            :', documento.tarifa)
  console.log('')

  const contratoVehiculoId = documento.contratoVehiculoId
  const contrato = documento.contratoVehiculo
  if (!contrato) {
    console.error('[ERROR] El documento legal no tiene ContratoVehiculo relacionado.')
    process.exit(1)
  }

  console.log('[BEFORE] ContratoVehiculo:')
  console.log('  id                :', contrato.id)
  console.log('  numeroContrato    :', contrato.numeroContrato)
  console.log('  fechaInicio       :', contrato.fechaInicio, '→', fmtFecha(contrato.fechaInicio))
  console.log('  fechaFin          :', contrato.fechaFin, '→', fmtFecha(contrato.fechaFin))
  console.log('  estado            :', contrato.estado)
  console.log('  modalidadPago     :', contrato.modalidadPago)
  console.log('')

  // 2) Snapshot ANTERIOR para auditoría
  const snapshotAntes = {
    documento: {
      id: documento.id,
      fechaInicio: documento.fechaInicio,
      fechaFin: documento.fechaFin,
    },
    contrato: {
      id: contrato.id,
      fechaInicio: contrato.fechaInicio,
      fechaFin: contrato.fechaFin,
    },
  }

  // 3) Actualizar ContratoDocumentoVehiculo
  const nuevaFechaInicio = parseDate(NUEVA_FECHA_INICIO)
  const nuevaFechaFin = parseDate(NUEVA_FECHA_FIN)

  console.log('[UPDATE] Actualizando ContratoDocumentoVehiculo...')
  const docActualizado = await prisma.contratoDocumentoVehiculo.update({
    where: { id: documento.id },
    data: {
      fechaInicio: nuevaFechaInicio,
      fechaFin: nuevaFechaFin,
    },
  })
  console.log('  fechaInicio:', docActualizado.fechaInicio, '→', fmtFecha(docActualizado.fechaInicio))
  console.log('  fechaFin   :', docActualizado.fechaFin, '→', fmtFecha(docActualizado.fechaFin))
  console.log('')

  // 4) Actualizar ContratoVehiculo
  console.log('[UPDATE] Actualizando ContratoVehiculo...')
  const contratoActualizado = await prisma.contratoVehiculo.update({
    where: { id: contratoVehiculoId },
    data: {
      fechaInicio: nuevaFechaInicio,
      fechaFin: nuevaFechaFin,
    },
  })
  console.log('  fechaInicio:', contratoActualizado.fechaInicio, '→', fmtFecha(contratoActualizado.fechaInicio))
  console.log('  fechaFin   :', contratoActualizado.fechaFin, '→', fmtFecha(contratoActualizado.fechaFin))
  console.log('')

  // 5) Regenerar obligaciones PENDIENTES (las PAGADAS/VENCIDAS se conservan)
  console.log('[OBLIGACIONES] Revisando obligaciones existentes...')
  const obligaciones = await prisma.obligacionVehiculo.findMany({
    where: { contratoId: contratoVehiculoId },
    orderBy: { numeroCuota: 'asc' },
  })

  console.log(`  Total obligaciones: ${obligaciones.length}`)
  const pendientes = obligaciones.filter(o => o.estado === 'PENDIENTE')
  const otras = obligaciones.filter(o => o.estado !== 'PENDIENTE')
  console.log(`  - PENDIENTES (se regenerarán): ${pendientes.length}`)
  console.log(`  - Otras estados (se conservan): ${otras.length}`)
  if (otras.length > 0) {
    console.log('    Estados conservados:')
    const porEstado = {}
    for (const o of otras) {
      porEstado[o.estado] = (porEstado[o.estado] || 0) + 1
    }
    for (const [est, n] of Object.entries(porEstado)) {
      console.log(`      ${est}: ${n}`)
    }
  }
  console.log('')

  if (pendientes.length > 0) {
    // Eliminar pendientes existentes
    console.log('[OBLIGACIONES] Eliminando obligaciones PENDIENTES antiguas...')
    const del = await prisma.obligacionVehiculo.deleteMany({
      where: { contratoId: contratoVehiculoId, estado: 'PENDIENTE' },
    })
    console.log(`  Eliminadas: ${del.count}`)

    // Generar nuevas con la nueva fechaInicio
    // Para DIARIO: cuenta como primera obligación el día de inicio si es L-S.
    // Si la nueva fechaInicio es domingo, la primera obligación será el lunes siguiente.
    const modalidad = contrato.modalidadPago
    console.log(`[OBLIGACIONES] Regenerando ${pendientes.length} obligaciones con modalidad ${modalidad} desde ${fmtFecha(nuevaFechaInicio)}...`)

    let nuevasFechas = []
    if (modalidad === 'DIARIO') {
      nuevasFechas = generarFechasVencimientoDiario(nuevaFechaInicio, pendientes.length)
    } else if (modalidad === 'SEMANAL') {
      for (let i = 1; i <= pendientes.length; i++) {
        const v = new Date(nuevaFechaInicio)
        v.setDate(v.getDate() + (i * 7))
        nuevasFechas.push(v)
      }
    } else if (modalidad === 'QUINCENAL') {
      for (let i = 1; i <= pendientes.length; i++) {
        const v = new Date(nuevaFechaInicio)
        v.setDate(v.getDate() + (i * 15))
        nuevasFechas.push(v)
      }
    } else if (modalidad === 'MENSUAL') {
      for (let i = 1; i <= pendientes.length; i++) {
        const v = new Date(nuevaFechaInicio)
        v.setMonth(v.getMonth() + i)
        nuevasFechas.push(v)
      }
    } else {
      // PERSONALIZADO u otro: no podemos regenerar automáticamente.
      // En ese caso, simplemente desplazamos cada pendiente por el mismo delta de días.
      console.log('  [WARN] Modalidad PERSONALIZADA: ajustando fechas con delta de días.')
      const deltaMs = nuevaFechaInicio.getTime() - snapshotAntes.contrato.fechaInicio.getTime()
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24))
      console.log(`  Delta de días: ${deltaDays}`)
      nuevasFechas = pendientes.map(o => {
        const oldDate = new Date(o.fechaVencimiento)
        oldDate.setDate(oldDate.getDate() + deltaDays)
        return oldDate
      })
    }

    // La numeración continúa desde el máximo numeroCuota existente
    const maxCuota = otras.reduce((m, o) => Math.max(m, o.numeroCuota || 0), 0)
    console.log(`  Numeración continúa desde cuota #${maxCuota + 1}`)

    for (let i = 0; i < nuevasFechas.length; i++) {
      await prisma.obligacionVehiculo.create({
        data: {
          contratoId: contratoVehiculoId,
          vehiculoId: contrato.vehiculoId,
          conductorId: contrato.conductorId,
          numeroCuota: maxCuota + i + 1,
          fechaVencimiento: nuevasFechas[i],
          monto: contrato.tarifa,
          montoPendiente: contrato.tarifa,
          estado: 'PENDIENTE',
        },
      })
    }
    console.log(`  Creadas ${nuevasFechas.length} nuevas obligaciones PENDIENTES.`)
    console.log('  Primeras 3 fechas de vencimiento:')
    for (let i = 0; i < Math.min(3, nuevasFechas.length); i++) {
      console.log(`    Cuota #${maxCuota + i + 1} → ${fmtFecha(nuevasFechas[i])}`)
    }
  } else {
    console.log('  No hay obligaciones PENDIENTES que regenerar.')
  }
  console.log('')

  // 6) Crear registro de auditoría
  console.log('[AUDITORIA] Creando registro de auditoría...')
  try {
    await prisma.auditoriaVehiculo.create({
      data: {
        entidad: 'CONTRATO_DOCUMENTO',
        entidadId: documento.id,
        accion: 'MODIFICAR',
        descripcion: `CORRECCIÓN DE FECHAS — Contrato ${NUMERO_CONTRATO}. ` +
          `Fecha inicio: ${fmtFecha(snapshotAntes.documento.fechaInicio)} → ${fmtFecha(nuevaFechaInicio)}. ` +
          `Fecha fin: ${fmtFecha(snapshotAntes.documento.fechaFin)} → ${fmtFecha(nuevaFechaFin)}. ` +
          `Actualizadas tablas ContratoDocumentoVehiculo y ContratoVehiculo. ` +
          `${pendientes.length} obligaciones PENDIENTES regeneradas.`,
        datosAnteriores: JSON.stringify(snapshotAntes),
        datosNuevos: JSON.stringify({
          documento: { id: documento.id, fechaInicio: nuevaFechaInicio, fechaFin: nuevaFechaFin },
          contrato: { id: contratoVehiculoId, fechaInicio: nuevaFechaInicio, fechaFin: nuevaFechaFin },
        }),
        usuarioId: 'system-fix-script',
        usuarioNombre: 'Script de Corrección',
      },
    })
    console.log('  Registro de auditoría creado.')
  } catch (e) {
    console.warn('  [WARN] No se pudo crear registro de auditoría:', e.message)
  }
  console.log('')

  console.log('======================================================')
  console.log('✓ CORRECCIÓN COMPLETADA')
  console.log('======================================================')
  console.log('Resumen de cambios:')
  console.log(`  ContratoDocumentoVehiculo (${documento.id}):`)
  console.log(`    fechaInicio: ${fmtFecha(snapshotAntes.documento.fechaInicio)} → ${fmtFecha(nuevaFechaInicio)}`)
  console.log(`    fechaFin:    ${fmtFecha(snapshotAntes.documento.fechaFin)} → ${fmtFecha(nuevaFechaFin)}`)
  console.log(`  ContratoVehiculo (${contratoVehiculoId}):`)
  console.log(`    fechaInicio: ${fmtFecha(snapshotAntes.contrato.fechaInicio)} → ${fmtFecha(nuevaFechaInicio)}`)
  console.log(`    fechaFin:    ${fmtFecha(snapshotAntes.contrato.fechaFin)} → ${fmtFecha(nuevaFechaFin)}`)
  console.log(`  Obligaciones: ${pendientes.length} regeneradas, ${otras.length} conservadas.`)
  console.log('')
  console.log('Ahora puedes volver a descargar el contrato desde')
  console.log('"Gestión de Vehículos → Contratos → Vista previa" y debería')
  console.log('mostrar las fechas correctas.')
  console.log('')
}

main()
  .catch((e) => {
    console.error('[FATAL] Error durante la corrección:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
