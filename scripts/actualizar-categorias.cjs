// =====================================================================
// actualizar-categorias.cjs
// =====================================================================
// Actualiza las 4 categorías en Neon para reflejar la nueva política:
//
//   CAT-1 Básica    — min $150.000,  max $500.000
//   CAT-2 Estándar  — min $150.000,  max $700.000
//   CAT-3 Premium   — min $150.000,  max $1.200.000
//   CAT-4 Ejecutiva — min $150.000,  max $0 (0 = SIN LÍMITE)
//
// Conserva la tasa de interés anual y la tasa de mora existentes de cada
// categoría, ya que el usuario no solicitó cambiarlas.
// =====================================================================
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const NUEVA_POLITICA = [
  { codigo: 'CAT-1', nombre: 'Categoría Básica',    montoMinimo: 150000, montoMaximo: 500000   },
  { codigo: 'CAT-2', nombre: 'Categoría Estándar',  montoMinimo: 150000, montoMaximo: 700000   },
  { codigo: 'CAT-3', nombre: 'Categoría Premium',   montoMinimo: 150000, montoMaximo: 1200000  },
  { codigo: 'CAT-4', nombre: 'Categoría Ejecutiva', montoMinimo: 150000, montoMaximo: 0 /* sin límite */ },
]

async function main() {
  console.log('\n=== Actualizando categorías en Neon ===\n')
  for (const p of NUEVA_POLITICA) {
    const actualizada = await db.categoriaCliente.update({
      where: { codigo: p.codigo },
      data: {
        nombre: p.nombre,
        montoMinimo: p.montoMinimo,
        montoMaximo: p.montoMaximo,
      },
    })
    const maxStr = actualizada.montoMaximo === 0 ? 'SIN LÍMITE' : `$${actualizada.montoMaximo.toLocaleString('es-CO')}`
    console.log(`✓ ${actualizada.codigo} | ${actualizada.nombre}`)
    console.log(`    min: $${actualizada.montoMinimo.toLocaleString('es-CO')} | max: ${maxStr}`)
    console.log(`    tasa anual: ${actualizada.tasaInteresAnual}% | mora: ${actualizada.tasaMoraAnual}%`)
  }

  // Verificación final
  const cats = await db.categoriaCliente.findMany({ orderBy: { codigo: 'asc' } })
  console.log('\n=== Estado final ===')
  for (const c of cats) {
    const maxStr = c.montoMaximo === 0 ? 'SIN LÍMITE' : `$${c.montoMaximo.toLocaleString('es-CO')}`
    console.log(`- ${c.codigo} | ${c.nombre} | min $${c.montoMinimo.toLocaleString('es-CO')} | max ${maxStr}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
