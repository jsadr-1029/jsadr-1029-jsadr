// Check all recent audit logs
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const fs = require('fs')
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m)
if (dbUrlMatch) process.env.DATABASE_URL = dbUrlMatch[1].trim().replace(/^["']|["']$/g, '')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Últimos 10 audit logs (cualquier acción) ===')
  const logs = await prisma.auditLog.findMany({
    orderBy: { fecha: 'desc' },
    take: 10,
    select: {
      fecha: true,
      usuarioNombre: true,
      accion: true,
      exito: true,
      errorMessage: true,
      detalles: true,
    },
  })
  for (const l of logs) {
    const det = l.detalles ? (l.detalles.length > 200 ? l.detalles.substring(0, 200) + '...' : l.detalles) : ''
    console.log(`  ${l.fecha?.toISOString() || 'sin fecha'} | ${l.accion} | exito=${l.exito} | ${l.usuarioNombre || ''}`)
    if (l.errorMessage) console.log(`    ERROR: ${l.errorMessage}`)
    if (det) console.log(`    Detalles: ${det}`)
  }

  console.log('\n=== Últimos 5 EnvioCorreo ===')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { fechaEnvio: 'desc' },
    take: 5,
  })
  for (const e of envios) {
    console.log(`  ${e.fechaEnvio?.toISOString()} | ${e.estado} | ${e.destinatario} | ${(e.asunto || '').substring(0, 60)}`)
    if (e.mensajeError) console.log(`    ERROR: ${e.mensajeError}`)
  }

  console.log('\n=== Verificar ConexionAPI.EMAIL_SMTP ===')
  const smtp = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP' },
    select: { id: true, nombre: true, usuario: true, password: true, activa: true, fechaUltimaPrueba: true, probada: true, resultadoUltimaPrueba: true },
  })
  console.log('  ConexionAPI:', JSON.stringify({
    id: smtp?.id,
    nombre: smtp?.nombre,
    usuario: smtp?.usuario,
    passwordLength: smtp?.password?.length || 0,
    passwordStartsWith: smtp?.password?.substring(0, 20) + '...',
    activa: smtp?.activa,
  }, null, 2))

  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
