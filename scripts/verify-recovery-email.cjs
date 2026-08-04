// Verify the recovery email was actually sent
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const fs = require('fs')
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m)
if (dbUrlMatch) process.env.DATABASE_URL = dbUrlMatch[1].trim().replace(/^["']|["']$/g, '')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Últimos 5 envíos de correo ===')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { fechaEnvio: 'desc' },
    take: 5,
    select: {
      destinatario: true,
      asunto: true,
      estado: true,
      fechaEnvio: true,
      enviadoPorNombre: true,
      mensajeError: true,
    },
  })
  for (const e of envios) {
    console.log(`  ${e.fechaEnvio?.toISOString()} | ${e.estado} | ${e.destinatario} | ${e.asunto?.substring(0, 50)}`)
    if (e.mensajeError) console.log(`    ERROR: ${e.mensajeError}`)
  }

  console.log('\n=== Últimos 5 audit logs con accion RECUPERACION_CLAVE_SOLICITADA ===')
  const logs = await prisma.auditLog.findMany({
    where: { accion: 'RECUPERACION_CLAVE_SOLICITADA' },
    orderBy: { fecha: 'desc' },
    take: 5,
    select: {
      fecha: true,
      usuarioNombre: true,
      exito: true,
      errorMessage: true,
      detalles: true,
    },
  })
  for (const l of logs) {
    console.log(`  ${l.createdAt?.toISOString()} | exito=${l.exito} | ${l.usuarioNombre}`)
    if (l.errorMessage) console.log(`    ERROR: ${l.errorMessage}`)
    if (l.detalles) {
      try {
        const d = JSON.parse(l.detalles)
        console.log(`    Detalles: destinatarioEmail=${d.destinatarioEmail}, exitoEnvio=${d.exitoEnvio}, errorEnvio=${d.errorEnvio || 'N/A'}`)
      } catch {}
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
