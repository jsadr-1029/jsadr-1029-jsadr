// =====================================================
// MIGRACIÓN: reparar préstamos en PENDIENTE_ACEPTACION
// con metodoConfirmacion=null que tienen un CódigoConfirmacion
// (enviados vía el botón 📧 antes del fix)
// =====================================================
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Migración: setear metodoConfirmacion=CORREO en préstamos legacy ===\n')

  // 1. Buscar préstamos en PENDIENTE_ACEPTACION con metodoConfirmacion null
  const prestamosLegacy = await prisma.prestamo.findMany({
    where: {
      estado: 'PENDIENTE_ACEPTACION',
      metodoConfirmacion: null,
    },
    select: {
      id: true,
      codigo: true,
      estado: true,
      metodoConfirmacion: true,
      tycEnviado: true,
      cliente: { select: { nombre: true, email: true } },
    },
  })

  console.log(`Préstamos en PENDIENTE_ACEPTACION con metodoConfirmacion=null: ${prestamosLegacy.length}`)

  if (prestamosLegacy.length === 0) {
    console.log('\n✓ No hay préstamos legacy que migrar.')
    return
  }

  // 2. Para cada uno, verificar si tiene un CódigoConfirmacion (lo que indica
  //    que el código fue enviado por correo vía el endpoint enviar-codigo)
  let migrados = 0
  let sinCodigo = 0
  for (const p of prestamosLegacy) {
    const codigo = await prisma.codigoConfirmacion.findFirst({
      where: { prestamoId: p.id },
    })
    if (codigo) {
      // Tiene código de confirmación → fue enviado por correo
      await prisma.prestamo.update({
        where: { id: p.id },
        data: { metodoConfirmacion: 'CORREO' },
      })
      migrados++
      console.log(`  ✓ ${p.codigo} → CORREO (cliente: ${p.cliente.nombre}, email: ${p.cliente.email || 'sin email'})`)
    } else {
      sinCodigo++
      console.log(`  ⚠ ${p.codigo} → sin CódigoConfirmacion, no se migra (cliente: ${p.cliente.nombre})`)
    }
  }

  console.log(`\n=== Resumen ===`)
  console.log(`  Migrados a CORREO: ${migrados}`)
  console.log(`  Sin código (requieren reenvío manual): ${sinCodigo}`)
  console.log(`  Total revisados: ${prestamosLegacy.length}`)

  if (migrados > 0) {
    console.log('\n🎉 Migración completada. Los préstamos migrados ahora mostrarán')
    console.log('   el input "Verificar y Activar" en el modal de detalle.')
  }
}

main()
  .catch((e) => { console.error('❌ ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
