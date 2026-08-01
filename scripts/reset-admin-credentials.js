// Reset admin credentials: username=adm-jsadr, password=REDACTED
// Uses bcrypt with 12 rounds (same as src/lib/security.ts)
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const db = new PrismaClient()
const BCRYPT_ROUNDS = 12
const NEW_USERNAME = 'adm-jsadr'
const NEW_PASSWORD = process.env.ADMIN_PASS || 'CHANGE_ME'

async function main() {
  // Find current admin
  const admin = await db.usuario.findFirst({ where: { rol: 'ADMIN' } })
  if (!admin) {
    console.error('No ADMIN user found in DB')
    process.exit(1)
  }
  console.log(`Found admin: id=${admin.id}, current username=${admin.username}`)

  // Check if the target username is already taken by another user
  const existing = await db.usuario.findUnique({ where: { username: NEW_USERNAME } })
  if (existing && existing.id !== admin.id) {
    console.error(`Username "${NEW_USERNAME}" already taken by user id=${existing.id}`)
    process.exit(1)
  }

  // Generate real bcrypt hash with 12 rounds
  console.log(`Generating bcrypt hash with ${BCRYPT_ROUNDS} rounds...`)
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, BCRYPT_ROUNDS)
  console.log(`Hash preview: ${passwordHash.substring(0, 30)}...`)

  // Verify hash works before saving
  const verify = await bcrypt.compare(NEW_PASSWORD, passwordHash)
  if (!verify) {
    console.error('Hash verification failed — aborting')
    process.exit(1)
  }
  console.log('Hash verified OK')

  // Update admin: new username, new hash, ensure MFA disabled and account unlocked
  const updated = await db.usuario.update({
    where: { id: admin.id },
    data: {
      username: NEW_USERNAME,
      passwordHash,
      // Disable MFA so the user can log in immediately
      mfaEnabled: false,
      mfaSecret: null,
      // Unlock account
      intentosFallidos: 0,
      bloqueadoHasta: null,
      // Don't force password change
      mustChangePassword: false,
      // Clear any stale session tokens
      sessionToken: null,
      // Mark as active
      activo: true,
    },
  })

  console.log('\n=== ADMIN USER UPDATED ===')
  console.log(`  id:           ${updated.id}`)
  console.log(`  nombre:       ${updated.nombre}`)
  console.log(`  email:        ${updated.email}`)
  console.log(`  username:     ${updated.username}`)
  console.log(`  rol:          ${updated.rol}`)
  console.log(`  activo:       ${updated.activo}`)
  console.log(`  mfaEnabled:   ${updated.mfaEnabled}`)
  console.log(`  passwordHash: ${updated.passwordHash.substring(0, 30)}... (12 rounds)`)
  console.log(`\n  Login:  username="${NEW_USERNAME}"  password="${NEW_PASSWORD}"`)
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
