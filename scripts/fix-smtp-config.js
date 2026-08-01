// Script para corregir la configuración SMTP del correo institucional principal
// Cambia smtp.hostinger.com → smtp.mi.com.co y activa STARTTLS (puerto 587)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })

  if (!correo) {
    console.error('No se encontró correo institucional principal activo')
    process.exit(1)
  }

  console.log('ANTES:', {
    email: correo.email,
    smtpHost: correo.smtpHost,
    smtpPort: correo.smtpPort,
    ssl: correo.ssl,
    tls: correo.tls,
    starttls: correo.starttls,
    ultimoTestOk: correo.ultimoTestOk,
  })

  const actualizado = await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      smtpHost: 'smtp.mi.com.co',
      smtpPort: 587,
      ssl: false,           // SSL implícito solo en 465; en 587 es STARTTLS
      tls: true,
      starttls: true,       // Forzar STARTTLS en puerto 587
      ultimoTest: null,     // reset para forzar re-test
      ultimoTestOk: null,
    },
  })

  console.log('DESPUÉS:', {
    email: actualizado.email,
    smtpHost: actualizado.smtpHost,
    smtpPort: actualizado.smtpPort,
    ssl: actualizado.ssl,
    tls: actualizado.tls,
    starttls: actualizado.starttls,
  })
  console.log('\n✅ Configuración SMTP corregida')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
