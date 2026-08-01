// Test directo: verificar-codigo
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const prestamoId = 'cms9g0vmo0001r65kctz5gtlb'
  const codigoIngresado = '8DBHV2'

  console.log('=== TEST: verificar-codigo ===')
  console.log('Codigo ingresado:', codigoIngresado)

  const cc = await prisma.codigoConfirmacion.findUnique({ where: { prestamoId } })
  if (!cc) { console.log('No hay codigo'); return }
  console.log('Codigo en BD:', cc.codigo, '| verificado:', cc.verificado)

  if (cc.codigo !== codigoIngresado.toUpperCase()) {
    console.log('Codigo no coincide')
    return
  }

  await prisma.codigoConfirmacion.update({
    where: { id: cc.id },
    data: { verificado: true, usado: true, fechaVerificacion: new Date() }
  })
  console.log('Codigo marcado como verificado')

  await prisma.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'ACTIVO',
      tycAceptado: true,
      tycFechaAceptacion: new Date(),
      fechaDesembolso: new Date(),
    }
  })
  console.log('Prestamo activado (estado=ACTIVO)')

  const p = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    select: { codigo: true, estado: true, tycAceptado: true, metodoConfirmacion: true }
  })
  console.log('\nEstado final:', JSON.stringify(p, null, 2))
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
