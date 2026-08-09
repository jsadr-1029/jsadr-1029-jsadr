// =====================================================
// SEED — Crear 4 cajas nuevas (Tarea U)
//   1. CAJA-FLEXIBILIDAD        → "Flexibilidad Financiera"
//   2. CAJA-INGRESOS-CAUSADOS   → "Ingresos Causados"
//   3. CAJA-PAGARE-CARTA        → "Pagaré y Carta de Instrucciones"
//   4. CAJA-USO-PLATAFORMA      → "Uso Plataforma"
//
// Idempotente: si una caja ya existe (por código), no se duplica.
// =====================================================
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60',
    },
  },
})

const cajasNuevas = [
  {
    codigo: 'CAJA-FLEXIBILIDAD',
    nombre: 'Flexibilidad Financiera',
    descripcion:
      'Ingresos por cobro del beneficio de Flexibilidad Financiera (BASICA $15.000 / PREMIUM $34.900). ' +
      'Se cobra UNA sola vez al inicio del crédito cuando el cliente activa el beneficio.',
  },
  {
    codigo: 'CAJA-INGRESOS-CAUSADOS',
    nombre: 'Ingresos Causados',
    descripcion:
      'Ingresos por concepto de "valor a cobrar por días causados" en créditos con periodo de corte. ' +
      'Corresponde al interés anticipado por los días entre la fecha del préstamo y el corte más cercano.',
  },
  {
    codigo: 'CAJA-PAGARE-CARTA',
    nombre: 'Pagaré y Carta de Instrucciones',
    descripcion:
      'Ingresos por cobro de generación de pagaré y carta de instrucciones (cargo editable, por defecto $19.900). ' +
      'Se cobra UNA sola vez al inicio del crédito cuando se generan estos documentos.',
  },
  {
    codigo: 'CAJA-USO-PLATAFORMA',
    nombre: 'Uso Plataforma',
    descripcion:
      'Ingresos por "Tarifa de Uso de Plataforma" (cargo editable, por defecto $4.900). ' +
      'Se cobra UNA sola vez al cliente por el uso de la plataforma tecnológica asociada al crédito.',
  },
]

async function main() {
  console.log('=== Creando cajas nuevas (Tarea U) ===\n')
  for (const c of cajasNuevas) {
    const existente = await prisma.cajaMenor.findUnique({ where: { codigo: c.codigo } })
    if (existente) {
      console.log(`  ✓ ${c.codigo} ya existe (id=${existente.id})`)
      continue
    }
    const creada = await prisma.cajaMenor.create({
      data: {
        codigo: c.codigo,
        nombre: c.nombre,
        descripcion: c.descripcion,
        saldoActual: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        activa: true,
      },
    })
    console.log(`  ✅ ${c.codigo} creada (id=${creada.id}) — ${c.nombre}`)
  }

  // Listar todas las cajas para verificación final
  console.log('\n=== Cajas existentes en BD ===')
  const todas = await prisma.cajaMenor.findMany({ orderBy: { codigo: 'asc' } })
  for (const c of todas) {
    console.log(`  • ${c.codigo.padEnd(28)} | ${c.nombre.padEnd(40)} | activa=${c.activa} | saldo=${c.saldoActual}`)
  }
  console.log(`\nTotal: ${todas.length} cajas`)
}

main()
  .catch((e) => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
