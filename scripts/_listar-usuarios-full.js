// Lista los usuarios del sistema con sus credenciales para testing
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      username: true,
      rol: true,
      activo: true,
      cedula: true,
      ultimoAcceso: true,
    }
  })
  console.log('=== USUARIOS DEL SISTEMA ===')
  console.table(usuarios.map(u => ({
    nombre: u.nombre,
    username: u.username,
    rol: u.rol,
    cedula: u.cedula || '-',
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso?.toISOString() || '-'
  })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
