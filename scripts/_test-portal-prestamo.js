const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'

async function main() {
  console.log('=== TEST PORTAL CLIENTE - FLUJO PRÉSTAMO ===\n')

  // Buscar un préstamo con su cliente
  const prestamo = await prisma.prestamo.findFirst({
    where: { cliente: { activo: true } },
    select: { id: true, codigo: true, estado: true, clienteId: true, cliente: { select: { id: true, nombre: true, cedula: true } } }
  })
  if (!prestamo) {
    console.log('❌ No hay préstamos')
    return
  }
  console.log(`Préstamo: ${prestamo.codigo} (estado: ${prestamo.estado})`)
  console.log(`Cliente: ${prestamo.cliente.nombre} (cedula: ${prestamo.cliente.cedula})`)

  // Generar token de sesión para el cliente
  const token = crypto.randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + 2 * 60 * 60 * 1000)
  await prisma.cliente.update({
    where: { id: prestamo.clienteId },
    data: { tokenSesion: token, tokenExpira: expira }
  })
  console.log(`Token generado`)

  console.log('\n--- TESTS ---\n')

  // 1. GET /api/prestamos/{id} con token del portal - DEBE funcionar (es dueño)
  console.log('▶ GET /api/prestamos/{id} con token del portal (dueño):')
  let r = await fetch(`${BASE}/api/prestamos/${prestamo.id}`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 200 ? '✅' : '❌'}`)
  if (r.status !== 200) {
    const b = await r.json()
    console.log(`  Body: ${JSON.stringify(b).slice(0, 200)}`)
  }

  // 2. GET /api/prestamos/{id}/aceptar-tyc-otp con token del portal - DEBE funcionar
  console.log('\n▶ GET /api/prestamos/{id}/aceptar-tyc-otp con token del portal:')
  r = await fetch(`${BASE}/api/prestamos/${prestamo.id}/aceptar-tyc-otp`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 200 ? '✅' : '❌'}`)

  // 3. PATCH /api/prestamos/{id} con acción NO permitida (ej: aprobar) - DEBE RECHAZAR
  console.log('\n▶ PATCH /api/prestamos/{id} accion=aprobar (debe RECHAZAR al portal):')
  r = await fetch(`${BASE}/api/prestamos/${prestamo.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-portal-token': token },
    body: JSON.stringify({ accion: 'aprobar' })
  })
  console.log(`  Status: ${r.status} ${r.status === 403 ? '✅ (denegado)' : '❌'}`)
  if (r.status === 403) {
    const b = await r.json()
    console.log(`  Mensaje: ${b.error}`)
  }

  // 4. Buscar otro préstamo que NO sea del cliente y verificar que no pueda acceder
  const otroPrestamo = await prisma.prestamo.findFirst({
    where: { clienteId: { not: prestamo.clienteId } },
    select: { id: true, codigo: true }
  })
  if (otroPrestamo) {
    console.log(`\n▶ GET /api/prestamos/{otro-id} con token del portal (NO dueño):`)
    r = await fetch(`${BASE}/api/prestamos/${otroPrestamo.id}`, {
      headers: { 'x-portal-token': token }
    })
    console.log(`  Status: ${r.status} ${r.status === 403 ? '✅ (denegado - no es dueño)' : '❌'}`)
    if (r.status === 403) {
      const b = await r.json()
      console.log(`  Mensaje: ${b.error}`)
    }
  }

  // Limpiar
  await prisma.cliente.update({
    where: { id: prestamo.clienteId },
    data: { tokenSesion: null, tokenExpira: null }
  })
  console.log('\n(Token limpiado)')

  console.log('\n=== FIN ===')
}

main().catch(console.error).finally(() => prisma.$disconnect())
