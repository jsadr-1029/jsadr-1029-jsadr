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
async function main() {
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      destinatario: true,
      asunto: true,
      estado: true,
      mensajeError: true,
      createdAt: true,
      correoInstitucionalId: true,
      remitenteEmail: true,
    },
  })
  for (const e of envios) {
    console.log({
      destinatario: e.destinatario,
      remitenteEmail: e.remitenteEmail,
      asunto: e.asunto,
      estado: e.estado,
      mensajeError: e.mensajeError?.slice(0, 200),
      createdAt: e.createdAt,
    })
  }
  await prisma.$disconnect()
}
main().catch(e => console.error('ERR:', e))
