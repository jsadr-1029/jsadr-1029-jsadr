// Script de apoyo: asegura que exista un préstamo con codeudor para probar el flujo dual OTP.
// Estrategia:
//   1. Buscar un préstamo en estado SOLICITUD o PENDIENTE_ACEPTACION.
//   2. Si no tiene codeudor, setearle codeudorEmail/codeudorNombre/tieneCodeudor=true
//      directamente en la BD (vía Prisma).
//   3. Mostrar el ID para que el script principal lo use.
//
// Uso: node scripts/ensure-test-prestamo-with-codeudor.js

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const prestamos = await db.prestamo.findMany({
    where: {
      OR: [{ estado: 'SOLICITUD' }, { estado: 'PENDIENTE_ACEPTACION' }],
    },
    include: { cliente: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (prestamos.length === 0) {
    console.log('No hay préstamos en estado SOLICITUD o PENDIENTE_ACEPTACION.')
    console.log('Crea un préstamo nuevo desde la UI primero.')
    process.exit(1)
  }

  // Buscar el primero que tenga cliente con email
  const target = prestamos.find(p => p.cliente?.email)
  if (!target) {
    console.log('No hay préstamos con cliente que tenga email.')
    process.exit(1)
  }

  console.log(`Préstamo seleccionado: ${target.codigo} (id=${target.id})`)
  console.log(`  estado: ${target.estado}`)
  console.log(`  cliente.email: ${target.cliente.email}`)
  console.log(`  tieneCodeudor: ${target.tieneCodeudor}`)
  console.log(`  codeudorEmail: ${target.codeudorEmail || '(vacío)'}`)

  if (target.tieneCodeudor && target.codeudorEmail) {
    console.log('\n✓ Ya tiene codeudor — no se requiere actualización.')
    return
  }

  // Setearle codeudor de prueba
  const updated = await db.prestamo.update({
    where: { id: target.id },
    data: {
      tieneCodeudor: true,
      codeudorNombre: 'Codeudor Prueba',
      codeudorCedula: '999999999',
      codeudorTelefono: target.cliente.telefono || '3000000000',
      codeudorEmail: target.cliente.email, // mismo email para que llegue a una sola bandeja en dev
      codeudorDireccion: 'Dirección de prueba',
    },
  })

  console.log('\n✓ Préstamo actualizado con codeudor de prueba:')
  console.log(`  tieneCodeudor: ${updated.tieneCodeudor}`)
  console.log(`  codeudorNombre: ${updated.codeudorNombre}`)
  console.log(`  codeudorEmail: ${updated.codeudorEmail}`)
  console.log(`\nListo para probar el flujo dual OTP.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
