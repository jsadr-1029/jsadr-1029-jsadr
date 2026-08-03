// Genera un token de sesión válido para un cliente (sin necesidad de PIN)
// y prueba que el portal cliente funcione correctamente
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'

async function main() {
  console.log('=== TEST PORTAL CLIENTE (con token generado) ===\n')

  // Buscar un cliente activo
  const cliente = await prisma.cliente.findFirst({
    where: { activo: true },
    select: { id: true, nombre: true, cedula: true, telefono: true }
  })
  if (!cliente) {
    console.log('❌ No hay clientes activos')
    return
  }

  console.log(`Cliente: ${cliente.nombre} (cedula: ${cliente.cedula})`)

  // Generar token de sesión válido por 2 horas
  const token = crypto.randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + 2 * 60 * 60 * 1000)
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { tokenSesion: token, tokenExpira: expira }
  })
  console.log(`Token generado (válido 2h)`)

  console.log('\n--- TESTS DEL PORTAL CLIENTE ---\n')

  // 1. /api/portal/prestamos - DEBE funcionar
  console.log('▶ /api/portal/prestamos (con x-portal-token):')
  let r = await fetch(`${BASE}/api/portal/prestamos`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 200 ? '✅' : '❌'}`)

  // 2. /api/portal/{cedula} - DEBE funcionar
  console.log('\n▶ /api/portal/{cedula} (con x-portal-token):')
  r = await fetch(`${BASE}/api/portal/${cliente.cedula}`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 200 ? '✅' : '❌'}`)

  // 3. /api/clientes - NO debe funcionar (API interna)
  console.log('\n▶ /api/clientes (debe RECHAZAR al cliente del portal):')
  r = await fetch(`${BASE}/api/clientes`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 401 ? '✅ (denegado)' : '❌'}`)
  if (r.status !== 401) {
    const b = await r.json()
    console.log(`  Body: ${JSON.stringify(b).slice(0, 200)}`)
  }

  // 4. /api/usuarios - NO debe funcionar
  console.log('\n▶ /api/usuarios (debe RECHAZAR al cliente del portal):')
  r = await fetch(`${BASE}/api/usuarios`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 401 ? '✅ (denegado)' : '❌'}`)

  // 5. /api/dashboard - NO debe funcionar
  console.log('\n▶ /api/dashboard (debe RECHAZAR al cliente del portal):')
  r = await fetch(`${BASE}/api/dashboard`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 401 ? '✅ (denegado)' : '❌'}`)

  // 6. /api/prestamos - NO debe funcionar
  console.log('\n▶ /api/prestamos (debe RECHAZAR al cliente del portal):')
  r = await fetch(`${BASE}/api/prestamos`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 401 ? '✅ (denegado)' : '❌'}`)

  // 7. /api/pagos - NO debe funcionar
  console.log('\n▶ /api/pagos (debe RECHAZAR al cliente del portal):')
  r = await fetch(`${BASE}/api/pagos`, {
    headers: { 'x-portal-token': token }
  })
  console.log(`  Status: ${r.status} ${r.status === 401 ? '✅ (denegado)' : '❌'}`)

  // Limpiar el token después del test
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { tokenSesion: null, tokenExpira: null }
  })
  console.log('\n(Token limpiado después del test)')

  console.log('\n=== FIN ===')
}

main().catch(console.error).finally(() => prisma.$disconnect())
