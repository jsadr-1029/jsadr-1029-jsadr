const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
;(async () => {
  const p = await prisma.prestamo.findFirst({
    select: { id: true, codigo: true, cliente: { select: { nombre: true, cedula: true, direccion: true, telefono: true, email: true, barrio: true, municipio: true } }, tieneCodeudor: true, firmas: { select: { id: true, estadoFirma: true, esFirmaCodeudor: true } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log(JSON.stringify(p, null, 2))
  await prisma.$disconnect()
})()
