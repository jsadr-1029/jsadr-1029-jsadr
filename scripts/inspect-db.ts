// Script to inspect existing clients, loans, and verify Johan Alvarez exists
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const db = new PrismaClient()

async function main() {
  const clientes = await db.cliente.findMany({
    select: {
      id: true,
      nombre: true,
      cedula: true,
      email: true,
      telefono: true,
      categoriaId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log('=== CLIENTES (últimos 10) ===')
  console.table(clientes)

  const johan = await db.cliente.findFirst({
    where: { cedula: '1214731649' },
    include: {
      prestamos: {
        select: {
          id: true,
          codigo: true,
          estado: true,
          montoPrincipal: true,
          fechaSolicitud: true,
        },
      },
    },
  })

  console.log('\n=== JOHAN ALVAREZ (cedula 1214731649) ===')
  console.log(JSON.stringify(johan, null, 2))

  const totalPrestamos = await db.prestamo.count()
  const totalPagos = await db.pago.count()
  const totalSolicitudes = await db.solicitudNuevoCliente.count()
  console.log(`\n=== TOTALES ===`)
  console.log(`Préstamos: ${totalPrestamos}`)
  console.log(`Pagos: ${totalPagos}`)
  console.log(`Solicitudes de nuevo cliente: ${totalSolicitudes}`)

  const categorias = await db.categoriaCliente.findMany({
    select: { id: true, codigo: true, nombre: true, tasaInteresAnual: true, montoMinimo: true, montoMaximo: true },
  })
  console.log(`\n=== CATEGORÍAS ===`)
  console.table(categorias)

  const cuentas = await db.cuentaRecaudo.findMany({
    select: { id: true, codigo: true, nombre: true, banco: true, tipoCuenta: true, numeroCuenta: true, activa: true },
  })
  console.log(`\n=== CUENTAS DE RECAUDO ===`)
  console.table(cuentas)
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
