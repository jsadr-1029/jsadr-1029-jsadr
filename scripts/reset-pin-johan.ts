// Resetear PIN de Johan para que el sistema lo vuelva a crear en la próxima prueba
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const db = new PrismaClient()

async function main() {
  const cliente = await db.cliente.findFirst({
    where: { cedula: '1214731649' },
    select: { id: true, nombre: true, pinHash: true, pinIntentos: true, pinBloqueadoHasta: true },
  })

  if (!cliente) {
    console.log('Cliente no encontrado')
    return
  }

  console.log(`Cliente: ${cliente.nombre}`)
  console.log(`PIN actual: ${cliente.pinHash ? 'SÍ' : 'NO'}`)
  console.log(`Intentos: ${cliente.pinIntentos}`)
  console.log(`Bloqueado hasta: ${cliente.pinBloqueadoHasta || 'no'}`)

  // Resetear PIN e intentos
  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      pinHash: null,
      pinCreatedAt: null,
      pinIntentos: 0,
      pinBloqueadoHasta: null,
    },
  })
  console.log('✅ PIN reseteado. El sistema lo creará en el próximo login.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
