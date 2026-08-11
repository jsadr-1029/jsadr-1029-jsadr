// Limpiar Otros Sí de pruebas anteriores (sin firma o de tests previos)
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const db = new PrismaClient()

async function main() {
  // Buscar préstamo de Johan con flexibilidad
  const prestamo = await db.prestamo.findFirst({
    where: {
      cliente: { cedula: '1214731649' },
      flexibilidadFinanciera: true,
    },
    select: { id: true, codigo: true, flexibilidadUsosEjercidos: true },
  })

  if (!prestamo) {
    console.log('No hay préstamo con flexibilidad')
    return
  }

  console.log(`Préstamo: ${prestamo.codigo}`)
  console.log(`Usos ejercidos antes: ${prestamo.flexibilidadUsosEjercidos}`)

  // Eliminar Otros Sí existentes
  const eliminados = await db.otroSiCambioFecha.deleteMany({
    where: { prestamoId: prestamo.id },
  })
  console.log(`Otros Sí eliminados: ${eliminados.count}`)

  // Eliminar firmas electrónicas de tipo ACUERDO_PAGO de este préstamo
  const firmasEliminadas = await db.firmaElectronica.deleteMany({
    where: {
      prestamoId: prestamo.id,
      tipo: 'ACUERDO_PAGO',
    },
  })
  console.log(`Firmas ACUERDO_PAGO eliminadas: ${firmasEliminadas.count}`)

  // Resetear usos ejercidos
  await db.prestamo.update({
    where: { id: prestamo.id },
    data: { flexibilidadUsosEjercidos: 0 },
  })
  console.log('Usos ejercidos reseteados a 0')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
