/**
 * FIX 1/4 — Desempatar email duplicado en BD antes de aplicar @unique.
 *
 * Riesgo: jsadr23@gmail.com está asignado a 2 clientes distintos (Johan y Carolina).
 * Acción: dejar email=null en el registro más reciente (Carolina) para que el
 * constraint @unique pueda aplicarse. Se conserva el email en el primer titular (Johan).
 *
 * Se conserva registro de auditoría antes y después.
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const db = new PrismaClient()
  try {
    const duplicados = ['jsadr23@gmail.com']

    for (const email of duplicados) {
      const clientes = await db.cliente.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' }, // primero = más antiguo
        select: { id: true, nombre: true, cedula: true, email: true, createdAt: true },
      })

      console.log(`\nEmail duplicado: "${email}"`)
      console.log(`  Clientes afectados: ${clientes.length}`)
      clientes.forEach((c, i) => {
        console.log(`    [${i}] id=${c.id}  cedula=${c.cedula}  nombre="${c.nombre}"  creado=${c.createdAt.toISOString()}`)
      })

      // El primero conserva el email; los demás se les quita.
      const [primero, ...resto] = clientes
      for (const c of resto) {
        console.log(`  -> Desasignando email de: id=${c.id} (${c.nombre})`)
        await db.cliente.update({
          where: { id: c.id },
          data: { email: null },
        })
      }
      console.log(`  ✓ Conserva email: id=${primero.id} (${primero.nombre})`)
    }

    // Verificación
    console.log('\n--- VERIFICACIÓN ---')
    const todos = await db.cliente.findMany({
      where: { email: { not: null } },
      select: { id: true, nombre: true, email: true },
    })
    const map = new Map()
    for (const c of todos) {
      const k = c.email.toLowerCase()
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(c)
    }
    const dups = [...map.entries()].filter(([_, arr]) => arr.length > 1)
    console.log(`Emails duplicados restantes: ${dups.length}`)
    if (dups.length > 0) {
      for (const [e, arr] of dups) {
        console.log(`  ✗ "${e}" aún tiene ${arr.length} registros`)
      }
      process.exit(2)
    } else {
      console.log('✓ No quedan emails duplicados. Listo para aplicar @unique.')
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
