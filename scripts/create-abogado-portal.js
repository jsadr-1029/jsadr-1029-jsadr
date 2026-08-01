// =====================================================
// CREAR USUARIO ABOGADO PARA PORTAL JURÍDICO
// =====================================================
// El portal /juridico requiere:
//   - Usuario con rol 'ABOGADO' o 'GESTOR'
//   - Campo `cedula` obligatorio (es el "usuario" del login del portal)
//   - Campo `claveHash` (NO el mismo hash de admin, sino uno separado)
//
// Login del portal:
//   URL:     https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/juridico
//   Cédula:  1234567890
//   Clave:   JsadrAbogado2026*
// =====================================================

require('dotenv').config()
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const prisma = new PrismaClient()

// bcrypt impl inline (avoid depending on bcrypt being installed in node_modules root)
const bcrypt = require('bcryptjs')

async function main() {
  const CEDULA = '1234567890'
  const CLAVE_PORTAL = 'JsadrAbogado2026*'
  const NOMBRE = 'Abogado Jsadr'
  const USERNAME = 'abogado-jsadr'
  const EMAIL = 'abogado@jsadr.com.co'
  const ROL = 'ABOGADO'

  console.log(`Creando usuario ${ROL}: ${USERNAME} (cédula ${CEDULA})`)

  // Hashear la clave con bcrypt (12 rondas, mismo estándar que admin)
  const claveHash = await bcrypt.hash(CLAVE_PORTAL, 12)
  console.log(`  ✓ claveHash generado (bcrypt, ${claveHash.length} chars)`)

  // Buscar si ya existe por cédula o username
  const existente = await prisma.usuario.findFirst({
    where: {
      OR: [
        { cedula: CEDULA },
        { username: USERNAME },
      ],
    },
  })

  let usuario
  if (existente) {
    console.log(`  → Usuario ya existe (id=${existente.id}), actualizando...`)
    usuario = await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        nombre: NOMBRE,
        username: USERNAME,
        email: EMAIL,
        cedula: CEDULA,
        rol: ROL,
        claveHash,
        activo: true,
        bloqueadoHasta: null,
        intentosFallidos: 0,
        mustChangePassword: false,
        tokenSesion: null,
        tokenExpira: null,
      },
    })
    console.log(`  ✓ Actualizado`)
  } else {
    usuario = await prisma.usuario.create({
      data: {
        nombre: NOMBRE,
        username: USERNAME,
        email: EMAIL,
        cedula: CEDULA,
        rol: ROL,
        passwordHash: claveHash,  // admin login also uses same bcrypt (required by schema)
        claveHash,                // portal jurídico uses this field
        activo: true,
        intentosFallidos: 0,
        mustChangePassword: false,
      },
    })
    console.log(`  ✓ Creado (id=${usuario.id})`)
  }

  // Verificación final: leer de vuelta
  const check = await prisma.usuario.findUnique({ where: { id: usuario.id } })
  console.log('\n=== VERIFICACIÓN ===')
  console.log('  id:', check.id)
  console.log('  nombre:', check.nombre)
  console.log('  username:', check.username)
  console.log('  email:', check.email)
  console.log('  rol:', check.rol)
  console.log('  cedula:', check.cedula)
  console.log('  activo:', check.activo)
  console.log('  bloqueadoHasta:', check.bloqueadoHasta)
  console.log('  claveHash presente:', !!check.claveHash)
  console.log('  mustChangePassword:', check.mustChangePassword)

  // Verificar bcrypt match
  const match = await bcrypt.compare(CLAVE_PORTAL, check.claveHash)
  console.log('  bcrypt.compare(CLAVE_PORTAL, hash):', match ? '✓ OK' : '✗ FALLÓ')

  console.log('\n=== CREDENCIALES PORTAL ABOGADO ===')
  console.log(`URL:     https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai/juridico`)
  console.log(`Cédula:  ${CEDULA}`)
  console.log(`Clave:   ${CLAVE_PORTAL}`)
  console.log(`Rol:     ${ROL}`)
}

main()
  .catch((e) => {
    console.error('❌ ERROR:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
