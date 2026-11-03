// Diagnóstico completo del contrato CTR-20261028-000001 (el que aparece en el PDF del usuario)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function fmt(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

async function main() {
  const doc = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: 'CTR-20261028-000001' },
    include: { contratoVehiculo: { include: { vehiculo: true, conductor: true } } },
  })

  if (!doc) {
    console.log('NO ENCONTRADO')
    return
  }

  console.log('=== DOCUMENTO LEGAL CTR-20261028-000001 ===')
  console.log(`id                : ${doc.id}`)
  console.log(`estado            : ${doc.estado}`)
  console.log(`fechaInicio       : ${fmt(doc.fechaInicio)}`)
  console.log(`fechaFin          : ${fmt(doc.fechaFin)}`)
  console.log(`vehiculoPlaca     : ${doc.vehiculoPlaca}`)
  console.log(`conductorNombre   : ${doc.conductorNombre}`)
  console.log(`conductorCedula    : ${doc.conductorCedula}`)
  console.log(`propietarioNombre : ${doc.propietarioNombre}`)
  console.log(`tarifa            : ${doc.tarifa}`)
  console.log(`modalidadPago     : ${doc.modalidadPago}`)
  console.log(`conductorToken    : ${doc.conductorToken?.slice(0, 20) || '(null)'}...`)
  console.log(`propietarioToken  : ${doc.propietarioToken?.slice(0, 20) || '(null)'}...`)
  console.log(`createdAt         : ${doc.createdAt?.toISOString()}`)
  console.log(`updatedAt         : ${doc.updatedAt?.toISOString()}`)
  console.log('')

  console.log('=== CONTRATO VEHÍCULO RELACIONADO ===')
  const c = doc.contratoVehiculo
  console.log(`id                : ${c.id}`)
  console.log(`numeroContrato    : ${c.numeroContrato}`)
  console.log(`estado           : ${c.estado}`)
  console.log(`fechaInicio       : ${fmt(c.fechaInicio)}`)
  console.log(`fechaFin          : ${fmt(c.fechaFin)}`)
  console.log(`vehiculo          : ${c.vehiculo?.placa} (${c.vehiculo?.marca} ${c.vehiculo?.modelo})`)
  console.log(`conductor         : ${c.conductor?.nombre} (CC ${c.conductor?.cedula})`)
  console.log('')

  // ¿El conductor o vehículo coinciden con el contrato CTR-20261103?
  console.log('=== COMPARACIÓN CON CTR-20261103-000001 ===')
  const nuevo = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: 'CTR-20261103-000001' },
  })
  if (nuevo) {
    console.log(`¿Mismo vehículo?   : ${doc.vehiculoPlaca === nuevo.vehiculoPlaca ? 'SÍ (' + doc.vehiculoPlaca + ')' : 'NO (' + doc.vehiculoPlaca + ' vs ' + nuevo.vehiculoPlaca + ')'}`)
    console.log(`¿Mismo conductor?  : ${doc.conductorCedula === nuevo.conductorCedula ? 'SÍ (' + doc.conductorNombre + ')' : 'NO (' + doc.conductorNombre + ' vs ' + nuevo.conductorNombre + ')'}`)
  }
}

main().finally(() => prisma.$disconnect())
