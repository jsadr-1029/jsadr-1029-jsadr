// Reset firmas TYC de préstamos PENDIENTE_ACEPTACION de Johan
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const db = new PrismaClient()

async function main() {
  // Buscar préstamos PENDIENTE_ACEPTACION de Johan
  const prestamos = await db.prestamo.findMany({
    where: {
      cliente: { cedula: '1214731649' },
      estado: 'PENDIENTE_ACEPTACION',
    },
    select: { id: true, codigo: true, tycAceptado: true },
  })

  console.log(`Préstamos PENDIENTE_ACEPTACION: ${prestamos.length}`)
  for (const p of prestamos) {
    console.log(`  - ${p.codigo} (tycAceptado: ${p.tycAceptado})`)
  }

  // Eliminar firmas TYC existentes y resetear tycAceptado
  for (const p of prestamos) {
    const firmas = await db.firmaElectronica.deleteMany({
      where: { prestamoId: p.id, tipo: 'TYC' },
    })
    console.log(`  ${p.codigo}: ${firmas.count} firmas TYC eliminadas`)

    await db.prestamo.update({
      where: { id: p.id },
      data: {
        tycAceptado: false,
        tycFechaAceptacion: null,
      },
    })
  }

  console.log('\n✅ Firmas TYC reseteadas. Listo para pruebas.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
