const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'

async function main() {
  console.log('=== TEST PORTAL ABOGADO ===\n')

  // Buscar el abogado
  const abogado = await prisma.usuario.findFirst({
    where: { rol: 'ABOGADO' },
    select: { id: true, nombre: true, username: true, cedula: true, claveHash: true, tokenSesion: true, tokenExpira: true }
  })
  if (!abogado) {
    console.log('❌ No hay abogado en la BD')
    return
  }

  console.log(`Abogado: ${abogado.nombre} (cedula: ${abogado.cedula})`)
  console.log(`Tiene claveHash: ${!!abogado.claveHash}`)
  console.log(`Tiene token sesión activo: ${!!abogado.tokenSesion && abogado.tokenExpira > new Date()}`)

  // Hacer login con cedula + clave 951029
  console.log('\nLogin del portal abogado (cedula + clave 951029)...')
  let r = await fetch(`${BASE}/api/juridico/portal/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: abogado.cedula, clave: '951029' })
  })
  let b = await r.json()
  console.log(`  Status: ${r.status}`)
  if (b.success) {
    console.log(`  ✅ Login OK, token: ${b.data?.token?.slice(0, 20)}...`)
    const token = b.data.token

    // 1. /api/juridico/portal/casos - DEBE funcionar
    console.log('\n▶ /api/juridico/portal/casos:')
    r = await fetch(`${BASE}/api/juridico/portal/casos?token=${token}`)
    console.log(`  Status: ${r.status} ${r.status === 200 ? '✅' : '❌'}`)
    if (r.status !== 200) {
      const b2 = await r.json()
      console.log(`  Body: ${JSON.stringify(b2).slice(0, 200)}`)
    }

    // 2. /api/clientes - NO debe funcionar
    console.log('\n▶ /api/clientes (debe RECHAZAR al abogado):')
    r = await fetch(`${BASE}/api/clientes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    console.log(`  Status: ${r.status} ${r.status === 401 || r.status === 403 ? '✅ (denegado)' : '❌'}`)

    // 3. /api/usuarios - NO debe funcionar
    console.log('\n▶ /api/usuarios (debe RECHAZAR al abogado):')
    r = await fetch(`${BASE}/api/usuarios`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    console.log(`  Status: ${r.status} ${r.status === 401 || r.status === 403 ? '✅ (denegado)' : '❌'}`)

    // 4. /api/dashboard - NO debe funcionar
    console.log('\n▶ /api/dashboard (debe RECHAZAR al abogado):')
    r = await fetch(`${BASE}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    console.log(`  Status: ${r.status} ${r.status === 401 || r.status === 403 ? '✅ (denegado)' : '❌'}`)
  } else {
    console.log(`  ❌ Login falló: ${b.error}`)
  }

  console.log('\n=== FIN ===')
}

main().catch(console.error).finally(() => prisma.$disconnect())
