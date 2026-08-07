/**
 * Audita clientes en busca de:
 * - Emails duplicados (no nulos) — riesgo de suplantación
 * - Emails mal formateados
 * - Cédulas duplicadas (no debería por @unique, pero verificar)
 * - Teléfonos sospechosamente cortos/largos
 *
 * No modifica datos. Solo reporta.
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const db = new PrismaClient()
  try {
    const clientes = await db.cliente.findMany({
      select: { id: true, nombre: true, cedula: true, email: true, telefono: true, activo: true },
      orderBy: { createdAt: 'desc' },
    })
    console.log(`Total clientes en BD: ${clientes.length}`)
    console.log('='.repeat(100))

    // 1. Emails duplicados (no nulos)
    const emailMap = new Map()
    for (const c of clientes) {
      if (!c.email) continue
      const e = c.email.toLowerCase().trim()
      if (!emailMap.has(e)) emailMap.set(e, [])
      emailMap.get(e).push(c)
    }
    const dups = [...emailMap.entries()].filter(([_, arr]) => arr.length > 1)
    console.log(`\n[1] EMAILS DUPLICADOS: ${dups.length} grupo(s)`)
    for (const [email, arr] of dups) {
      console.log(`  - "${email}" (${arr.length} clientes):`)
      for (const c of arr) {
        console.log(`      * id=${c.id}  cedula=${c.cedula}  nombre="${c.nombre}"  activo=${c.activo}`)
      }
    }

    // 2. Emails mal formateados
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const malos = clientes.filter(c => c.email && !emailRegex.test(c.email.trim()))
    console.log(`\n[2] EMAILS MAL FORMATEADOS: ${malos.length}`)
    for (const c of malos) {
      console.log(`  - id=${c.id}  cedula=${c.cedula}  email="${c.email}"`)
    }

    // 3. Cédulas duplicadas (debería ser 0 por @unique)
    const cedMap = new Map()
    for (const c of clientes) {
      if (!cedMap.has(c.cedula)) cedMap.set(c.cedula, [])
      cedMap.get(c.cedula).push(c)
    }
    const cedDups = [...cedMap.entries()].filter(([_, arr]) => arr.length > 1)
    console.log(`\n[3] CÉDULAS DUPLICADAS: ${cedDups.length} grupo(s)`)
    for (const [ced, arr] of cedDups) {
      console.log(`  - "${ced}" (${arr.length} clientes): ${arr.map(c => c.id).join(', ')}`)
    }

    // 4. Teléfonos sospechosos
    const telMalos = clientes.filter(c => c.telefono && (c.telefono.length < 7 || c.telefono.length > 15))
    console.log(`\n[4] TELÉFONOS SOSPECHOSOS (len<7 o >15): ${telMalos.length}`)
    for (const c of telMalos) {
      console.log(`  - id=${c.id}  cedula=${c.cedula}  telefono="${c.telefono}"`)
    }

    // 5. Clientes sin email (info)
    const sinEmail = clientes.filter(c => !c.email)
    console.log(`\n[5] CLIENTES SIN EMAIL: ${sinEmail.length} (permitido si preferenciaNotificacion != EMAIL/AMBOS)`)

    console.log('\n' + '='.repeat(100))
    console.log('AUDITORÍA COMPLETA')
  } finally {
    await db.$disconnect()
  }
}

main().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
