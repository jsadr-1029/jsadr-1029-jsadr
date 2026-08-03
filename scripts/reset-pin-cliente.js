/**
 * Resetear PIN de un cliente del portal a "1234" (política del proyecto)
 *
 * Uso: node /home/z/my-project/scripts/reset-pin-cliente.js <cedula>
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const p = new PrismaClient()
const CEDULA = process.argv[2] || '1214731649'
const NUEVO_PIN = '1234'

async function main() {
  console.log(`=== Reset PIN cliente portal ===`)
  console.log(`Cédula: ${CEDULA}`)
  console.log(`Nuevo PIN: ${NUEVO_PIN}\n`)

  const cliente = await p.cliente.findUnique({ where: { cedula: CEDULA } })
  if (!cliente) {
    console.error(`ERROR: No se encontró cliente con cédula ${CEDULA}`)
    process.exit(1)
  }

  console.log(`Cliente encontrado:`)
  console.log(`  Nombre: ${cliente.nombre}`)
  console.log(`  Teléfono: ${cliente.telefono}`)
  console.log(`  Email: ${cliente.email}`)
  console.log(`  Activo: ${cliente.activo}`)
  console.log(`  PIN actual: ${cliente.pinHash ? ' configurado' : 'sin configurar'}`)

  // Generar nuevo hash
  const pinHash = bcrypt.hashSync(NUEVO_PIN, 10)

  // Actualizar
  await p.cliente.update({
    where: { id: cliente.id },
    data: {
      pinHash,
      pinCreatedAt: new Date(),
      pinIntentos: 0,
      pinBloqueadoHasta: null,
    },
  })

  console.log(`\n[OK] PIN actualizado a "${NUEVO_PIN}"`)

  // Verificar
  const ok = bcrypt.compareSync(NUEVO_PIN, pinHash)
  console.log(`[OK] Verificación bcrypt.compare: ${ok ? '✓' : '✗'}`)

  // Probar login vía API
  console.log(`\n=== Probando login vía API ===`)
  const r = await fetch('http://localhost:3000/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: CEDULA, pin: NUEVO_PIN }),
  })
  const data = await r.json()
  console.log(`HTTP ${r.status}`)
  console.log(`Response:`, JSON.stringify(data, null, 2).slice(0, 500))

  if (data.success) {
    console.log(`\n=== [OK] Login exitoso ===`)
    console.log(`  Token: ${data.token?.slice(0, 30)}...`)
    console.log(`  Cliente ID: ${data.clienteId}`)
    console.log(`  Nombre: ${data.nombre}`)
  } else {
    console.log(`\n=== [FALLO] Login rechazado ===`)
    console.log(`  Error: ${data.error}`)
  }
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
}).finally(async () => {
  await p.$disconnect()
})
