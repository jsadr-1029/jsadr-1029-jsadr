// Script de verificación: consulta el estado actual de las fechas del contrato
// CTR-20261103-000001 en la base de datos Neon (producción).
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const NUMERO = 'CTR-20261103-000001'

function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  const doc = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: NUMERO },
    include: { contratoVehiculo: true },
  })
  if (!doc) {
    console.log(`[ERROR] Documento ${NUMERO} no encontrado`)
    return
  }
  console.log('=== ESTADO ACTUAL EN NEON (PRODUCCIÓN) ===')
  console.log('')
  console.log(`ContratoDocumentoVehiculo:`)
  console.log(`  numeroContrato : ${doc.numeroContrato}`)
  console.log(`  estado         : ${doc.estado}`)
  console.log(`  fechaInicio    : ${fmt(doc.fechaInicio)}  (esperado: 31/10/2026)`)
  console.log(`  fechaFin       : ${fmt(doc.fechaFin)}  (esperado: 30/01/2027)`)
  console.log('')
  console.log(`ContratoVehiculo (relacionado):`)
  console.log(`  numeroContrato : ${doc.contratoVehiculo.numeroContrato}`)
  console.log(`  estado         : ${doc.contratoVehiculo.estado}`)
  console.log(`  fechaInicio    : ${fmt(doc.contratoVehiculo.fechaInicio)}`)
  console.log(`  fechaFin       : ${fmt(doc.contratoVehiculo.fechaFin)}`)
  console.log('')
  // Verificar obligaciones
  const obligs = await prisma.obligacionVehiculo.findMany({
    where: { contratoId: doc.contratoVehiculoId },
    orderBy: { numeroCuota: 'asc' },
    take: 5,
  })
  console.log(`Obligaciones (primeras 5 de ${obligs.length} mostradas):`)
  for (const o of obligs) {
    console.log(`  Cuota #${o.numeroCuota} → vence ${fmt(o.fechaVencimiento)} · estado ${o.estado} · ${o.monto}`)
  }
}

main().finally(() => prisma.$disconnect())
