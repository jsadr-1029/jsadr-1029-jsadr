const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nombre: true,
      username: true,
      email: true,
      rol: true,
      cedula: true,
      activo: true,
      mfaEnabled: true,
      ultimoAcceso: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log('=== USUARIOS DEL SISTEMA JSADR ===\n')
  console.log('Total:', usuarios.length, 'usuarios\n')
  console.log('─'.repeat(120))
  console.log('USERNAME'.padEnd(25) + 'ROL'.padEnd(15) + 'NOMBRE'.padEnd(35) + 'CEDULA'.padEnd(15) + 'EMAIL'.padEnd(35) + 'ACTIVO')
  console.log('─'.repeat(120))
  for (const u of usuarios) {
    console.log(
      (u.username || '—').padEnd(25) +
      (u.rol || '—').padEnd(15) +
      (u.nombre || '—').padEnd(35) +
      (u.cedula || '—').padEnd(15) +
      (u.email || '—').padEnd(35) +
      (u.activo ? '✅' : '❌')
    )
  }
  console.log('─'.repeat(120))
  console.log('\nNotas:')
  console.log('- Las contraseñas NO se almacenan en texto plano (bcrypt hash).')
  console.log('- Para recuperar una clave, usar: https://jsadr.com.co/recuperar-clave')
  console.log('- MFA activo se marca en columna separada:')
  const conMfa = usuarios.filter(u => u.mfaEnabled)
  if (conMfa.length > 0) {
    console.log('  Usuarios con MFA activo:')
    for (const u of conMfa) {
      console.log('    - ' + u.username + ' (' + u.rol + ')')
    }
  } else {
    console.log('  Ningún usuario tiene MFA activo actualmente.')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
