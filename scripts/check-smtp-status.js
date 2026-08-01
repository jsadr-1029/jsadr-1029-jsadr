// Quick check: is there an active EMAIL_SMTP connection in BD, and is API_ENCRYPTION_KEY set?
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const conns = await prisma.conexionAPI.findMany({
    where: { tipo: 'EMAIL_SMTP' },
    select: { id: true, tipo: true, activa: true, usuario: true, url: true, configuracionExtra: true, password: true }
  })
  console.log('=== EMAIL_SMTP connections found:', conns.length, '===')
  conns.forEach(c => {
    console.log(`- id=${c.id} activa=${c.activa} user=${c.usuario} url=${c.url} hasExtra=${!!c.configuracionExtra} hasPass=${!!c.password} passLen=${c.password?.length || 0}`)
    if (c.configuracionExtra) {
      try {
        const ex = JSON.parse(c.configuracionExtra)
        console.log('  extra:', { host: ex.host, port: ex.port, secure: ex.secure, fromName: ex.fromName, fromEmail: ex.fromEmail })
      } catch {}
    }
  })

  console.log('\n=== API_ENCRYPTION_KEY in env:', process.env.API_ENCRYPTION_KEY ? `SET (${process.env.API_ENCRYPTION_KEY.length} chars)` : 'NOT SET')
  console.log('=== DATABASE_URL in env:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
