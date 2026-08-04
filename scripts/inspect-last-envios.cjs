// Inspecciona los últimos envíos de correo para ver qué pasó
const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const envios = await prisma.envioCorreo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    for (const e of envios) {
      console.log(`\n[${e.id.slice(-8)}] ${e.createdAt.toISOString()}`)
      console.log(`  destinatario: ${e.destinatario}`)
      console.log(`  asunto: ${e.asunto}`)
      console.log(`  estado: ${e.estado}`)
      console.log(`  enviadoPorNombre: ${e.enviadoPorNombre}`)
      console.log(`  mensajeError: ${e.mensajeError || '(ninguno)'}`)
      console.log(`  metadata: ${(e.metadata || '').slice(0, 200)}`)
    }
  } catch (e) {
    console.error('ERROR:', e.message)
  } finally {
    await prisma.$disconnect()
  }
})()
