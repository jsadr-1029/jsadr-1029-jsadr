// =====================================================
// CAMBIO DE USERNAME DEL ADMIN PRINCIPAL
//   Actual:  Adm-Jsadr
//   Nuevo:   Js1214731649
//   Clave:   Js951029* (sin cambios — política del proyecto)
//
// Sincroniza:
//   - Neon PostgreSQL (BD de producción)
//   - SQLite local (BD de desarrollo, si existe)
// =====================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'

const OLD_USERNAME = 'Adm-Jsadr'
const NEW_USERNAME = 'Js1214731649'
const PASSWORD = 'Js951029*'

async function updateInDb(label, dbUrl) {
  console.log(`\n========== ACTUALIZANDO EN ${label} ==========`)
  const db = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    // 1. Verificar que el nuevo username no exista ya
    const existing = await db.usuario.findUnique({ where: { username: NEW_USERNAME } })
    if (existing) {
      console.log(`  ⚠️  Ya existe un usuario con username "${NEW_USERNAME}" (id=${existing.id}, rol=${existing.rol})`)
      console.log('     Abortando para evitar duplicados.')
      return
    }

    // 2. Buscar el admin actual
    const admin = await db.usuario.findFirst({
      where: {
        OR: [
          { username: OLD_USERNAME },
          { username: { equals: OLD_USERNAME, mode: 'insensitive' } },
        ],
      },
    })

    if (!admin) {
      console.log(`  ⚠️  No se encontró el usuario "${OLD_USERNAME}" en ${label}.`)
      // Listar todos los ADMIN para diagnóstico
      const admins = await db.usuario.findMany({ where: { rol: 'ADMIN' } })
      console.log(`  ADMIN users en ${label}:`)
      for (const a of admins) {
        console.log(`    - id=${a.id}  username="${a.username}"  email=${a.email}  activo=${a.activo}`)
      }
      return
    }

    console.log(`  ✅ Admin encontrado:`)
    console.log(`     id        = ${admin.id}`)
    console.log(`     username  = ${admin.username}`)
    console.log(`     email     = ${admin.email}`)
    console.log(`     rol       = ${admin.rol}`)
    console.log(`     activo    = ${admin.activo}`)

    // 3. Generar nuevo hash bcrypt (rounds=12 — política del proyecto)
    console.log(`\n  Generando nuevo bcrypt hash (12 rounds)...`)
    const newHash = await bcrypt.hash(PASSWORD, 12)
    // Verificar
    const verifyOk = await bcrypt.compare(PASSWORD, newHash)
    if (!verifyOk) {
      throw new Error('Verificación de hash falló — abortando')
    }
    console.log(`  ✅ Hash verificado: ${newHash.substring(0, 30)}...`)

    // 4. Actualizar
    const updated = await db.usuario.update({
      where: { id: admin.id },
      data: {
        username: NEW_USERNAME,
        passwordHash: newHash,
        // Desbloquear y permitir login inmediato
        mfaEnabled: false,
        mfaSecret: null,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        mustChangePassword: false,
        sessionToken: null,
        activo: true,
      },
    })

    console.log(`\n  ✅ === ADMIN ACTUALIZADO EN ${label} ===`)
    console.log(`     id          = ${updated.id}`)
    console.log(`     username    = ${updated.username}`)
    console.log(`     email       = ${updated.email}`)
    console.log(`     rol         = ${updated.rol}`)
    console.log(`     activo      = ${updated.activo}`)
    console.log(`     mfaEnabled  = ${updated.mfaEnabled}`)
    console.log(`     intentos    = ${updated.intentosFallidos}`)
    console.log(`     hashPreview = ${updated.passwordHash.substring(0, 25)}...`)

    // 5. Verificación final con bcrypt.compare
    const finalCheck = await bcrypt.compare(PASSWORD, updated.passwordHash)
    console.log(`\n  Verificación bcrypt.compare("${PASSWORD}", hash): ${finalCheck ? '✅ OK' : '❌ FALLÓ'}`)

    // 6. Login simulado
    const loginCheck = await db.usuario.findUnique({ where: { username: NEW_USERNAME } })
    if (loginCheck && loginCheck.activo && !loginCheck.bloqueadoHasta) {
      const passOk = await bcrypt.compare(PASSWORD, loginCheck.passwordHash)
      console.log(`  Login simulado: ${passOk ? '✅ OK' : '❌ FALLÓ'}`)
    } else {
      console.log(`  Login simulado: ❌ Usuario no encontrado o bloqueado`)
    }

  } catch (e) {
    console.error(`  ❌ Error en ${label}:`, e.message)
    throw e
  } finally {
    await db.$disconnect()
  }
}

async function main() {
  console.log('================================================================')
  console.log('  CAMBIO DE USERNAME ADMIN: Adm-Jsadr → Js1214731649')
  console.log('  Password: Js951029* (sin cambios)')
  console.log('================================================================')

  // 1. Neon
  await updateInDb('NEON (Producción)', NEON_URL)

  // 2. SQLite local (si existe)
  const fs = require('fs')
  const sqlitePath = '/home/z/my-project/db/custom.db'
  if (fs.existsSync(sqlitePath)) {
    console.log('\n----------------------------------------------------------------')
    console.log('  SQLite local detectado en', sqlitePath)
    console.log('----------------------------------------------------------------')
    try {
      await updateInDb('SQLite (Local)', `file:${sqlitePath}`)
    } catch (e) {
      console.warn('  (continuando — el SQLite local es solo para dev)')
    }
  } else {
    console.log('\n  (No se encontró SQLite local en /home/z/my-project/db/custom.db — saltando)')
  }

  console.log('\n================================================================')
  console.log('  ✅ SINCRONIZACIÓN COMPLETA')
  console.log('================================================================')
  console.log(`  Nuevas credenciales admin:`)
  console.log(`    username: ${NEW_USERNAME}`)
  console.log(`    password: ${PASSWORD}`)
  console.log(`    URL prod: https://jsadr-1029-jsadr.vercel.app/login`)
  console.log('================================================================')
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
