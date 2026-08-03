const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  // Contar registros en varias tablas para verificar conexión
  const counts = {
    usuarios: await prisma.usuario.count(),
    clientes: await prisma.cliente.count(),
    prestamos: await prisma.prestamo.count(),
    firmas: await prisma.firmaElectronica.count(),
  }
  console.log('✓ Conexión Neon OK')
  console.log('  Usuarios:', counts.usuarios)
  console.log('  Clientes:', counts.clientes)
  console.log('  Préstamos:', counts.prestamos)
  console.log('  Firmas:', counts.firmas)
  await prisma.$disconnect()
}
main().catch(e => { console.error('✗ Error:', e.message); process.exit(1) })
