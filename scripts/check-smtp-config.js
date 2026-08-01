// Script temporal para inspeccionar la configuración SMTP en la BD
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const conexiones = await prisma.conexionAPI.findMany({
    where: { tipo: 'EMAIL_SMTP' },
  })
  console.log('=== Conexiones EMAIL_SMTP ===')
  for (const c of conexiones) {
    console.log({
      id: c.id,
      nombre: c.nombre,
      url: c.url,
      usuario: c.usuario,
      password_LENGTH: c.password ? c.password.length : 0,
      password_first10: c.password ? c.password.substring(0, 10) : null,
      apiKey: c.apiKey,
      configuracionExtra: c.configuracionExtra,
      activa: c.activa,
      probada: c.probada,
      resultadoUltimaPrueba: c.resultadoUltimaPrueba,
      fechaUltimaPrueba: c.fechaUltimaPrueba,
    })
  }
  console.log('Total:', conexiones.length)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
