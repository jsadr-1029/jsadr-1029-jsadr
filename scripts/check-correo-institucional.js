// Script temporal para inspeccionar la configuración de CorreoInstitucional
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const correos = await prisma.correoInstitucional.findMany()
  console.log('=== Correos Institucionales ===')
  for (const c of correos) {
    console.log({
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      tipo: c.tipo,
      estado: c.estado,
      esPrincipal: c.esPrincipal,
      smtpHost: c.smtpHost,
      smtpPort: c.smtpPort,
      smtpUser: c.smtpUser,
      smtpPass_LENGTH: c.smtpPass ? c.smtpPass.length : 0,
      smtpPass_first15: c.smtpPass ? c.smtpPass.substring(0, 15) : null,
      ssl: c.ssl,
      tls: c.tls,
      starttls: c.starttls,
      aliasRemitente: c.aliasRemitente,
      nombreRemitente: c.nombreRemitente,
      ultimoTest: c.ultimoTest,
      ultimoTestOk: c.ultimoTestOk,
    })
  }
  console.log('Total:', correos.length)

  // También mostrar últimos envíos
  const envios = await prisma.envioCorreo.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  })
  console.log('\n=== Últimos 5 envíos ===')
  for (const e of envios) {
    console.log({
      id: e.id,
      remitenteEmail: e.remitenteEmail,
      destinatario: e.destinatario,
      asunto: e.asunto,
      estado: e.estado,
      mensajeError: e.mensajeError,
      fechaEnvio: e.fechaEnvio,
      createdAt: e.createdAt,
    })
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
