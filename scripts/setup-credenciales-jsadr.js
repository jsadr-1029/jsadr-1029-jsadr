// =====================================================
// setup-credenciales-jsadr.js
// =====================================================
// Crea/actualiza los DOS usuarios de acceso principal:
//
//   1) ADMIN  — username "Jsadr"     / clave "731649"
//      → ingresa por /login (login unificado)
//      → redirige a / (dashboard admin)
//      → también ingresa por /admin (Portal Administrador)
//        porque la API /api/admin/portal/auth usa el usuario
//        hard-coded "Jsadr" + hash bcrypt("731649") en
//        Configuracion.portal_admin_hash.
//
//   2) ABOGADO — username "JD_jsadr" / clave "731649"
//      → ingresa por /login (login unificado)
//      → redirige a /juridico (portal del abogado)
//      → también ingresa por /juridico directamente
//        porque la API /api/juridico/portal/auth ahora busca
//        por cedula O username.
//
// El script es IDEMPOTENTE: puede ejecutarse múltiples veces.
// =====================================================

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Forzar la URL de Neon (misma que usa la app en producción)
process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const db = new PrismaClient()

const CLAVE = '731649' // Misma clave para ambos usuarios (a petición del cliente)

async function upsertUsuario({
  username,
  cedula,
  nombre,
  email,
  rol,
  permisos,
}) {
  const claveHash = await bcrypt.hash(CLAVE, 12)
  console.log(`\n=== ${rol} :: ${username} ===`)
  console.log(`  cedula : ${cedula}`)
  console.log(`  email  : ${email}`)
  console.log(`  nombre : ${nombre}`)
  console.log(`  hash   : ${claveHash.substring(0, 30)}... (${claveHash.length} chars)`)

  // Buscar existente por username O cedula
  const existente = await db.usuario.findFirst({
    where: {
      OR: [{ username }, { cedula }],
    },
  })

  let usuario
  if (existente) {
    console.log(`  → Usuario ya existe (id=${existente.id}), actualizando...`)
    usuario = await db.usuario.update({
      where: { id: existente.id },
      data: {
        nombre,
        username,
        email,
        cedula,
        rol,
        permisos: permisos || existente.permisos || null,
        passwordHash: claveHash, // para /api/auth/login (sistema)
        claveHash,                // para /api/juridico/portal/auth (portal jurídico)
        activo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
        mustChangePassword: false,
        mfaEnabled: false,
        mfaSecret: null,
        tokenSesion: null,
        tokenExpira: null,
        ultimoAcceso: new Date(),
      },
    })
    console.log(`  ✓ Actualizado (id=${usuario.id})`)
  } else {
    console.log(`  → Creando nuevo usuario...`)
    usuario = await db.usuario.create({
      data: {
        nombre,
        username,
        email,
        cedula,
        rol,
        permisos: permisos || null,
        passwordHash: claveHash,
        claveHash,
        activo: true,
        intentosFallidos: 0,
        mustChangePassword: false,
        mfaEnabled: false,
      },
    })
    console.log(`  ✓ Creado (id=${usuario.id})`)
  }

  // Verificación final
  const check = await db.usuario.findUnique({ where: { id: usuario.id } })
  const matchPassword = check.passwordHash
    ? await bcrypt.compare(CLAVE, check.passwordHash)
    : false
  const matchClaveHash = check.claveHash
    ? await bcrypt.compare(CLAVE, check.claveHash)
    : false

  console.log('\n  === VERIFICACIÓN ===')
  console.log(`  id              : ${check.id}`)
  console.log(`  nombre          : ${check.nombre}`)
  console.log(`  username        : ${check.username}`)
  console.log(`  email           : ${check.email}`)
  console.log(`  rol             : ${check.rol}`)
  console.log(`  cedula          : ${check.cedula}`)
  console.log(`  activo          : ${check.activo}`)
  console.log(`  bloqueadoHasta  : ${check.bloqueadoHasta}`)
  console.log(`  passwordHash    : ${check.passwordHash ? 'presente' : 'AUSENTE'}`)
  console.log(`  claveHash       : ${check.claveHash ? 'presente' : 'AUSENTE'}`)
  console.log(`  mustChangePass  : ${check.mustChangePassword}`)
  console.log(`  mfaEnabled      : ${check.mfaEnabled}`)
  console.log(`  bcrypt.compare(${CLAVE}, passwordHash): ${matchPassword ? '✓ OK' : '✗ FALLÓ'}`)
  console.log(`  bcrypt.compare(${CLAVE}, claveHash)   : ${matchClaveHash ? '✓ OK' : '✗ FALLÓ'}`)

  return usuario
}

async function main() {
  console.log('=====================================================')
  console.log(' SETUP CREDENCIALES JSADR (admin + abogado)        ')
  console.log('=====================================================')
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'OK' : 'FALTA'}`)

  // 1) Usuario ADMIN — "Jsadr" / "731649"
  await upsertUsuario({
    username: 'Jsadr',
    cedula: 'Jsadr', // cedula = mismo username para que el portal admin lo encuentre
    nombre: 'Administrador Jsadr',
    email: 'jsadr@jsadr.co',
    rol: 'ADMIN',
    permisos: '["*"]', // todos los permisos
  })

  // 2) Usuario ABOGADO — "JD_jsadr" / "731649"
  await upsertUsuario({
    username: 'JD_jsadr',
    cedula: 'JD_jsadr', // cedula = mismo username (compatible con API del portal jurídico)
    nombre: 'Abogado Jsadr',
    email: 'jd_jsadr@jsadr.co',
    rol: 'ABOGADO',
    permisos: null,
  })

  // Resumen final: listar todos los usuarios con rol ADMIN o ABOGADO
  console.log('\n=====================================================')
  console.log(' RESUMEN — usuarios ADMIN y ABOGADO en BD')
  console.log('=====================================================')
  const usuarios = await db.usuario.findMany({
    where: { rol: { in: ['ADMIN', 'ABOGADO', 'GESTOR', 'CONSULTOR'] } },
    select: {
      id: true,
      nombre: true,
      username: true,
      email: true,
      rol: true,
      cedula: true,
      activo: true,
      createdAt: true,
    },
    orderBy: { rol: 'asc' },
  })
  for (const u of usuarios) {
    console.log(
      `  - [${u.rol.padEnd(10)}] ${u.username.padEnd(20)} cedula=${u.cedula || '-'.padEnd(12)} activo=${u.activo}  (${u.email})`
    )
  }
  console.log(`\nTotal: ${usuarios.length} usuarios internos`)

  console.log('\n=====================================================')
  console.log(' CREDENCIALES FINALES (listas para usar)')
  console.log('=====================================================')
  console.log('  ADMIN')
  console.log('    Login URL : https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/login')
  console.log('               https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/admin')
  console.log('    Usuario   : Jsadr')
  console.log('    Clave     : 731649')
  console.log('    Redirige  : / (dashboard admin)')
  console.log('')
  console.log('  ABOGADO')
  console.log('    Login URL : https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/login')
  console.log('               https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/juridico')
  console.log('    Usuario   : JD_jsadr')
  console.log('    Clave     : 731649')
  console.log('    Redirige  : /juridico (portal del abogado)')
  console.log('=====================================================')
}

main()
  .catch((e) => {
    console.error('❌ ERROR:', e.message)
    console.error(e.stack)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
