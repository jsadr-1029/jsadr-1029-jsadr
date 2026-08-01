// =====================================================
// POBLAR smtpPassBackup para el correo institucional principal
// =====================================================
// Toma el plaintext del SMTP pass (Brevo), lo encripta con encryptBackup
// (llave hardcoded en src/lib/security.ts — independiente de .env),
// y guarda el backup en correoInstitucional.smtpPassBackup.
//
// También re-encripta smtpPass con la API_ENCRYPTION_KEY actual, por si
// había quedado huérfano de una llave anterior.
//
// Uso: node --env-file=.env scripts/poblar-smtp-backup.js
// =====================================================

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// === Llave hardcoded (debe coincidir con src/lib/security.ts) ===
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'

function getBackupKey() {
  return crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
}

function encryptBackup(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getBackupKey(), iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}

function decryptBackup(encText) {
  const parts = encText.split(':')
  if (parts.length !== 2) return encText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', getBackupKey(), iv)
  let dec = decipher.update(parts[1], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// === Llave de .env (encryptSensitive) ===
function getEnvKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptSensitive(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getEnvKey(), iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}

// === Credenciales Brevo conocidas ===
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: process.env.BREVO_SMTP_KEY || 'REDACTED_USE_ENV_VAR',
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr - Aurora Bancaria',
}

async function main() {
  console.log('=== Poblar smtpPassBackup para correo institucional principal ===\n')

  const correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) {
    console.error('No hay correo institucional principal activo.')
    process.exit(1)
  }

  console.log('Correo principal encontrado:', correo.email)
  console.log('  smtpHost actual :', correo.smtpHost)
  console.log('  smtpUser actual :', correo.smtpUser)
  console.log('  tiene smtpPass  :', !!correo.smtpPass)
  console.log('  tiene backup    :', !!correo.smtpPassBackup)

  // === 1. Cifrar plaintext con llave hardcoded (backup) ===
  const backupEncrypted = encryptBackup(BREVO.pass)
  if (decryptBackup(backupEncrypted) !== BREVO.pass) {
    console.error('Roundtrip de encryptBackup fallido')
    process.exit(1)
  }
  console.log('\n✓ encryptBackup OK (roundtrip verificado)')

  // === 2. Cifrar plaintext con llave de .env (smtpPass principal) ===
  const smtpPassEncrypted = encryptSensitive(BREVO.pass)
  console.log('✓ encryptSensitive OK (con API_ENCRYPTION_KEY de .env)')

  // === 3. Actualizar correoInstitucional con ambas ===
  await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      smtpHost: BREVO.host,
      smtpPort: BREVO.port,
      smtpUser: BREVO.user,
      smtpPass: smtpPassEncrypted,
      smtpPassBackup: backupEncrypted,
      ssl: false,
      tls: true,
      starttls: true,
      nombreRemitente: BREVO.fromName,
      aliasRemitente: BREVO.fromEmail,
      ultimoTest: null,
      ultimoTestOk: null,
    },
  })
  console.log('\n✓ correoInstitucional actualizado con smtpPass + smtpPassBackup')

  // === 4. Sincronizar conexionAPI ===
  const configuracionExtra = JSON.stringify({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    fromName: BREVO.fromName,
    fromEmail: BREVO.fromEmail,
  })

  const previos = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const p of previos) {
    await prisma.conexionAPI.delete({ where: { id: p.id } })
  }
  console.log(`  - Eliminados ${previos.length} registros EMAIL_SMTP previos en conexionAPI`)

  await prisma.conexionAPI.create({
    data: {
      nombre: `SMTP — ${correo.email}`,
      tipo: 'EMAIL_SMTP',
      descripcion: `Sincronizado desde Configuración Global → Correo (${correo.email}). Host: ${BREVO.host}:${BREVO.port}`,
      url: `${BREVO.host}:${BREVO.port}`,
      apiKey: BREVO.fromEmail,
      usuario: BREVO.user,
      password: smtpPassEncrypted,
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })
  console.log('✓ conexionAPI actualizada con nuevo registro EMAIL_SMTP activo')

  // === 5. Verificación final: leer de BD y desencriptar ===
  const verif = await prisma.correoInstitucional.findUnique({ where: { id: correo.id } })
  const passFromEnv = (() => {
    try {
      const parts = verif.smtpPass.split(':')
      const iv = Buffer.from(parts[0], 'hex')
      const decipher = crypto.createDecipheriv('aes-256-cbc', getEnvKey(), iv)
      let dec = decipher.update(parts[1], 'hex', 'utf8')
      dec += decipher.final('utf8')
      return dec
    } catch (e) { return `ERROR: ${e.message}` }
  })()
  const passFromBackup = decryptBackup(verif.smtpPassBackup)

  console.log('\n=== VERIFICACIÓN ===')
  console.log('  smtpPass desencriptado (con API_ENCRYPTION_KEY):', passFromEnv === BREVO.pass ? '✓ OK' : '✗ MISMATCH')
  console.log('  smtpPassBackup desencriptado (con llave hardcoded):', passFromBackup === BREVO.pass ? '✓ OK' : '✗ MISMATCH')
  console.log('  Ambos coinciden con el plaintext Brevo:', passFromEnv === BREVO.pass && passFromBackup === BREVO.pass ? '✓' : '✗')

  console.log('\n🎉 Backup SMTP poblado correctamente.')
  console.log('   Ya puedes usar el botón "Restaurar desde backup" en Configuración Global → SMTP.')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
