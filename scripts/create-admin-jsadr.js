// Crea el usuario administrador principal del sistema Jsadr
// Cumple la política de claves del proyecto:
//   - Usuarios del sistema: "Js951029*"
// No cambiar esta clave sin autorización explícita del usuario.

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const db = new PrismaClient()

const USERNAME = 'Js1214731649'
const PASSWORD = 'Js951029*' // Política de claves del proyecto
const EMAIL = 'admin@jsadr.co'
const NOMBRE = 'Administrador JSADR'

async function main() {
  console.log('=== Creación del usuario administrador principal ===')
  console.log(`  username: ${USERNAME}`)
  console.log(`  email   : ${EMAIL}`)
  console.log(`  rol     : ADMIN`)
  console.log(`  password: ${PASSWORD} (política de claves del proyecto)`)
  console.log()

  // Hashear con bcrypt rounds=12 (igual que el resto del sistema)
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  console.log(`  passwordHash (preview): ${passwordHash.substring(0, 30)}...`)

  // Borrar si ya existe (por si se ejecuta múltiples veces)
  const deleted = await db.usuario.deleteMany({ where: { username: USERNAME } }).catch(() => ({ count: 0 }))
  if (deleted.count > 0) {
    console.log(`  ⚠ Usuario existente eliminado (${deleted.count} registro(s))`)
  }

  // Crear usuario admin
  const u = await db.usuario.create({
    data: {
      nombre: NOMBRE,
      username: USERNAME,
      email: EMAIL,
      passwordHash,
      rol: 'ADMIN',
      permisos: '["*"]', // todos los permisos
      activo: true,
      mfaEnabled: false,
      mustChangePassword: false,
    },
    select: {
      id: true,
      username: true,
      email: true,
      rol: true,
      activo: true,
      createdAt: true,
    },
  })

  console.log()
  console.log('✓ Usuario creado correctamente:')
  console.log(JSON.stringify(u, null, 2))

  // Verificar bcrypt.compare
  const ok = await bcrypt.compare(PASSWORD, u.passwordHash || passwordHash)
  // (select no trae passwordHash, usar el hash local)
  const verify = await bcrypt.compare(PASSWORD, passwordHash)
  console.log()
  console.log(`  bcrypt.compare verificación: ${verify ? 'OK' : 'FALLÓ'}`)

  // Listar todos los usuarios actuales
  const all = await db.usuario.findMany({ select: { username: true, rol: true, activo: true } })
  console.log()
  console.log(`=== Total usuarios en BD: ${all.length} ===`)
  for (const x of all) {
    console.log(`  - ${x.username}  (${x.rol})  activo=${x.activo}`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => db.$disconnect())
