/**
 * Auditoría integral de seguridad M02-Clientes (post-fix).
 * Verifica hallazgos adicionales: PIN/clave bloqueo, intentos, tokens caducados,
 * emails duplicados restantes, clientes inactivos con tokens vivos.
 */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const db = new PrismaClient()
  try {
    console.log('══════════════════════════════════════════════════════════════════════')
    console.log('AUDITORÍA POST-FIX M02-CLIENTES —', new Date().toISOString())
    console.log('══════════════════════════════════════════════════════════════════════')

    // 1. Emails duplicados (debe ser 0)
    const todos = await db.cliente.findMany({ where: { email: { not: null } }, select: { id: true, nombre: true, email: true, cedula: true, activo: true } })
    const map = new Map()
    for (const c of todos) {
      const k = c.email.toLowerCase()
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(c)
    }
    const dups = [...map.entries()].filter(([_, arr]) => arr.length > 1)
    console.log(`\n[1] Emails duplicados: ${dups.length} ${dups.length === 0 ? '✅' : '❌'}`)
    for (const [e, arr] of dups) console.log(`   ✗ ${e}: ${arr.length} registros`)

    // 2. Clientes con PIN bloqueado activo
    const ahora = new Date()
    const pinBloq = await db.cliente.findMany({
      where: { pinBloqueadoHasta: { gt: ahora }, activo: true },
      select: { id: true, nombre: true, cedula: true, pinBloqueadoHasta: true, pinIntentos: true },
    })
    console.log(`\n[2] Clientes con PIN bloqueado activo: ${pinBloq.length}`)
    for (const c of pinBloq) console.log(`   - ${c.nombre} (${c.cedula}) bloqueado hasta ${c.pinBloqueadoHasta.toISOString()}, intentos=${c.pinIntentos}`)

    // 3. Clientes con clave bloqueada
    const claveBloq = await db.cliente.findMany({
      where: { claveBloqueadoHasta: { gt: ahora }, activo: true },
      select: { id: true, nombre: true, cedula: true, claveBloqueadoHasta: true, claveIntentos: true },
    })
    console.log(`\n[3] Clientes con clave bloqueada activa: ${claveBloq.length}`)
    for (const c of claveBloq) console.log(`   - ${c.nombre} (${c.cedula}) bloqueado hasta ${c.claveBloqueadoHasta.toISOString()}, intentos=${c.claveIntentos}`)

    // 4. Clientes con intentos PIN > 0 pero no bloqueados (anomalía)
    const intentosSinBloq = await db.cliente.findMany({
      where: { pinIntentos: { gt: 0 }, pinBloqueadoHasta: null, activo: true },
      select: { id: true, nombre: true, cedula: true, pinIntentos: true, ultimoAccesoPortal: true },
    })
    console.log(`\n[4] Clientes con intentos PIN>0 pero no bloqueados (pendientes de reset por login OK): ${intentosSinBloq.length}`)
    for (const c of intentosSinBloq) console.log(`   - ${c.nombre} (${c.cedula}) intentos=${c.pinIntentos} último=${c.ultimoAccesoPortal?.toISOString() || 'nunca'}`)

    // 5. Tokens de sesión vivos en clientes inactivos (riesgo: cuenta deshabilitada pero sesión sigue)
    const tokenVivoInactivo = await db.cliente.findMany({
      where: { activo: false, tokenSesion: { not: null }, tokenExpira: { gt: ahora } },
      select: { id: true, nombre: true, cedula: true, tokenExpira: true },
    })
    console.log(`\n[5] Clientes inactivos con token sesión vivo (RIESGO): ${tokenVivoInactivo.length} ${tokenVivoInactivo.length === 0 ? '✅' : '❌'}`)
    for (const c of tokenVivoInactivo) console.log(`   ✗ ${c.nombre} (${c.cedula}) token expira ${c.tokenExpira.toISOString()}`)

    // 6. Tokens reset de clave vivos (deberían expirar solos)
    const resetVivos = await db.cliente.findMany({
      where: { claveResetToken: { not: null }, claveResetExpira: { gt: ahora } },
      select: { id: true, nombre: true, cedula: true, claveResetExpira: true },
    })
    console.log(`\n[6] Tokens reset de clave vivos: ${resetVivos.length}`)
    for (const c of resetVivos) console.log(`   - ${c.nombre} (${c.cedula}) expira ${c.claveResetExpira.toISOString()}`)

    // 7. Clientes sin teléfono (debería ser 0, es obligatorio)
    const sinTel = await db.cliente.findMany({ where: { telefono: '' }, select: { id: true, nombre: true, cedula: true } })
    console.log(`\n[7] Clientes sin teléfono: ${sinTel.length} ${sinTel.length === 0 ? '✅' : '❌'}`)
    for (const c of sinTel) console.log(`   ✗ ${c.nombre} (${c.cedula})`)

    // 8. Resumen final
    const total = await db.cliente.count()
    const activos = await db.cliente.count({ where: { activo: true } })
    const inactivos = total - activos
    const conEmail = await db.cliente.count({ where: { email: { not: null } } })
    const sinEmail = total - conEmail
    console.log(`\n[8] Resumen:`)
    console.log(`   Total: ${total}`)
    console.log(`   Activos: ${activos} / Inactivos: ${inactivos}`)
    console.log(`   Con email: ${conEmail} / Sin email: ${sinEmail}`)
    console.log(`\n══════════════════════════════════════════════════════════════════════`)
  } finally {
    await db.$disconnect()
  }
}

main().catch(err => { console.error('ERROR:', err); process.exit(1) })
