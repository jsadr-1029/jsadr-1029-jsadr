const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const firmas = await prisma.firmaElectronica.findMany({
    select: { id: true, estadoFirma: true, fechaFirmaCompleta: true, clienteId: true, prestamoId: true, otpCanal: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log(`Total firmas: ${firmas.length}`)
  const estados = {}
  firmas.forEach(f => { estados[f.estadoFirma] = (estados[f.estadoFirma] || 0) + 1 })
  console.log('Estados:', estados)
  const completadas = firmas.filter(f => f.estadoFirma === 'COMPLETADA')
  console.log('Completadas:', completadas.length)
  if (completadas.length > 0) {
    completadas.slice(0, 3).forEach(f => console.log(' ', f.id, f.estadoFirma, f.fechaFirmaCompleta))
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
