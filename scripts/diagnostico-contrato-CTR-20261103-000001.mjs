// Script de diagnóstico profundo: lista TODOS los ContratoDocumentoVehiculo
// relacionados con el contrato CTR-20261103-000001 y el ContratoVehiculo
// asociado, para detectar duplicados o snapshots antiguos.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const NUMERO = 'CTR-20261103-000001'

function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  console.log('=== DIAGNÓSTICO PROFUNDO ===')
  console.log('')

  // 1) Buscar el documento principal por numeroContrato
  const documento = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: NUMERO },
    include: { contratoVehiculo: true },
  })

  if (!documento) {
    console.log(`[ERROR] No se encontró documento con numeroContrato = ${NUMERO}`)
    return
  }

  console.log(`Documento principal encontrado:`)
  console.log(`  id                : ${documento.id}`)
  console.log(`  contratoVehiculoId: ${documento.contratoVehiculoId}`)
  console.log(`  estado            : ${documento.estado}`)
  console.log(`  fechaInicio       : ${fmt(documento.fechaInicio)}`)
  console.log(`  fechaFin          : ${fmt(documento.fechaFin)}`)
  console.log(`  conductorToken    : ${documento.conductorToken?.slice(0, 16) || '(null)'}...`)
  console.log(`  propietarioToken  : ${documento.propietarioToken?.slice(0, 16) || '(null)'}...`)
  console.log(`  createdAt         : ${documento.createdAt?.toISOString()}`)
  console.log(`  updatedAt         : ${documento.updatedAt?.toISOString()}`)
  console.log('')

  // 2) Buscar TODOS los ContratoDocumentoVehiculo para el MISMO contratoVehiculoId
  //    (puede haber duplicados o versiones antiguas)
  const todosDocsMismoContrato = await prisma.contratoDocumentoVehiculo.findMany({
    where: { contratoVehiculoId: documento.contratoVehiculoId },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`=== TODOS los ContratoDocumentoVehiculo para contratoVehiculoId = ${documento.contratoVehiculoId} ===`)
  console.log(`Total documentos encontrados: ${todosDocsMismoContrato.length}`)
  console.log('')
  for (let i = 0; i < todosDocsMismoContrato.length; i++) {
    const d = todosDocsMismoContrato[i]
    console.log(`[Documento ${i + 1}]`)
    console.log(`  id                : ${d.id}`)
    console.log(`  numeroContrato    : ${d.numeroContrato}`)
    console.log(`  estado            : ${d.estado}`)
    console.log(`  fechaInicio       : ${fmt(d.fechaInicio)}`)
    console.log(`  fechaFin          : ${fmt(d.fechaFin)}`)
    console.log(`  createdAt         : ${d.createdAt?.toISOString()}`)
    console.log(`  updatedAt         : ${d.updatedAt?.toISOString()}`)
    console.log(`  conductorToken    : ${d.conductorToken?.slice(0, 16) || '(null)'}...`)
    console.log(`  propietarioToken  : ${d.propietarioToken?.slice(0, 16) || '(null)'}...`)
    console.log('')
  }

  // 3) Buscar TODOS los ContratoDocumentoVehiculo por número de contrato similar
  console.log(`=== Documentos con numeroContrato similar a CTR-20261103-* ===`)
  const similares = await prisma.contratoDocumentoVehiculo.findMany({
    where: { numeroContrato: { startsWith: 'CTR-20261103' } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Total documentos encontrados: ${similares.length}`)
  for (let i = 0; i < similares.length; i++) {
    const d = similares[i]
    console.log(`  [${i + 1}] ${d.numeroContrato} · estado=${d.estado} · inicio=${fmt(d.fechaInicio)} · fin=${fmt(d.fechaFin)} · contrato=${d.contratoVehiculoId}`)
  }
  console.log('')

  // 4) Buscar el ContratoVehiculo relacionado y verificar si tiene múltiples documentos legales
  console.log(`=== ContratoVehiculo relacionado ===`)
  const contrato = await prisma.contratoVehiculo.findUnique({
    where: { id: documento.contratoVehiculoId },
    include: { documentosContrato: { orderBy: { createdAt: 'asc' } } },
  })
  if (contrato) {
    console.log(`  id                : ${contrato.id}`)
    console.log(`  numeroContrato    : ${contrato.numeroContrato}`)
    console.log(`  estado            : ${contrato.estado}`)
    console.log(`  fechaInicio       : ${fmt(contrato.fechaInicio)}`)
    console.log(`  fechaFin          : ${fmt(contrato.fechaFin)}`)
    console.log(`  documentosContrato.length: ${contrato.documentosContrato.length}`)
    for (const dc of contrato.documentosContrato) {
      console.log(`    - ${dc.numeroContrato} · estado=${dc.estado} · inicio=${fmt(dc.fechaInicio)} · fin=${fmt(dc.fechaFin)}`)
    }
  }
  console.log('')

  // 5) Buscar si hay algún otro contrato con fechas 31/10 o 30/01
  console.log(`=== Otros documentos con fechas 31/10/2026 o 30/01/2027 (posibles duplicados con fechas erradas) ===`)
  const otrosConFechasErradas = await prisma.contratoDocumentoVehiculo.findMany({
    where: {
      OR: [
        // Fecha de inicio cerca de 31/10/2026
        { fechaInicio: { gte: new Date('2026-10-30T00:00:00Z'), lte: new Date('2026-11-01T23:59:59Z') } },
        // Fecha de fin cerca de 30/01/2027
        { fechaFin: { gte: new Date('2027-01-29T00:00:00Z'), lte: new Date('2027-01-31T23:59:59Z') } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Total documentos con fechas 31/10 o 30/01: ${otrosConFechasErradas.length}`)
  for (const d of otrosConFechasErradas) {
    console.log(`  - numeroContrato=${d.numeroContrato} · estado=${d.estado} · inicio=${fmt(d.fechaInicio)} · fin=${fmt(d.fechaFin)} · contrato=${d.contratoVehiculoId}`)
  }
}

main().finally(() => prisma.$disconnect())
