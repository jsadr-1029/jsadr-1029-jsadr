// Re-guarda credenciales Brevo con la API_ENCRYPTION_KEY actual
// Uso:
//   BREVO_API_KEY=xkeysib-...  BREVO_SMTP_KEY=xsmtpsib-...  node scripts/save-brevo-creds.js
//
// Si no se pasan los valores como env vars, el script los pide por stdin (prompt).
// Las credenciales se guardan en:
//   - ConexionAPI.EMAIL_SMTP.apiKey + password (re-cifradas con llave actual)
//   - CorreoInstitucional.smtpPass (re-cifrada)
//   - CorreoInstitucional.smtpPassBackup (cifrada con llave hardcoded de disaster-recovery)

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const readline = require('readline')

const prisma = new PrismaClient()
const ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'jsadr-encryption-key-32bytes!!'

// Backup key seed (hardcoded — debe coincidir con BACKUP_KEY_SEED en src/lib/security.ts)
const BACKUP_KEY_SEED = 'jsadr-backup-key-recovery-2024!!'

function getEncryptionKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

function getBackupKey() {
  return crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
}

function encryptSensitive(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function encryptBackup(text) {
  const key = getBackupKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()) }))
}

async function main() {
  console.log('=== Re-cifrado de credenciales Brevo ===')
  console.log('API_ENCRYPTION_KEY:', ENCRYPTION_KEY)
  console.log('Hash:', getEncryptionKey().toString('hex').substring(0, 16) + '...')
  console.log()

  let apiKey = process.env.BREVO_API_KEY
  let smtpKey = process.env.BREVO_SMTP_KEY

  if (!apiKey) {
    apiKey = await ask('Pega la API KEY de Brevo (xkeysib-...): ')
  }
  if (!smtpKey) {
    smtpKey = await ask('Pega la SMTP KEY de Brevo (xsmtpsib-...): ')
  }

  if (!apiKey || !smtpKey) {
    console.error('ERROR: faltan credenciales')
    process.exit(1)
  }
  if (!apiKey.startsWith('xkeysib-')) {
    console.warn('⚠️  La API KEY no empieza con "xkeysib-" — puede estar mal')
  }
  if (!smtpKey.startsWith('xsmtpsib-')) {
    console.warn('⚠️  La SMTP KEY no empieza con "xsmtpsib-" — puede estar mal')
  }

  console.log()
  console.log('Re-cifrando con llave actual y guardando en BD...')

  // 1. ConexionAPI.EMAIL_SMTP
  const encryptedApi = encryptSensitive(apiKey)
  const encryptedPass = encryptSensitive(smtpKey)
  await prisma.conexionAPI.updateMany({
    where: { tipo: 'EMAIL_SMTP' },
    data: {
      apiKey: encryptedApi,
      password: encryptedPass,
      activa: true,
      probada: false, // forzar re-prueba
    },
  })
  console.log('✓ ConexionAPI.EMAIL_SMTP actualizada')

  // 2. CorreoInstitucional (esPrincipal)
  const encryptedSmtpPass = encryptSensitive(smtpKey)
  const encryptedBackup = encryptBackup(smtpKey)
  await prisma.correoInstitucional.updateMany({
    where: { esPrincipal: true, estado: 'activo' },
    data: {
      smtpPass: encryptedSmtpPass,
      smtpPassBackup: encryptedBackup, // disaster-recovery
    },
  })
  console.log('✓ CorreoInstitucional.smtpPass actualizada')
  console.log('✓ CorreoInstitucional.smtpPassBackup poblada (disaster-recovery)')

  // 3. Verificación inmediata — desencriptar con la llave actual
  const checkConexion = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (checkConexion) {
    const parts = checkConexion.apiKey.split(':')
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(parts[0], 'hex'))
    const decrypted = decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8')
    console.log()
    console.log('=== VERIFICACIÓN ===')
    console.log('apiKey desencriptada correctamente:', decrypted.substring(0, 12) + '...' === apiKey.substring(0, 12) + '...' ? '✓ SÍ' : '✗ NO')
  }

  console.log()
  console.log('=== LISTO ===')
  console.log('Las credenciales Brevo ahora están cifradas con la API_ENCRYPTION_KEY actual.')
  console.log('Los correos electrónicos (OTP, recuperación de clave, notificaciones) deberían funcionar.')
  console.log('Próximo paso: prueba un envío desde /api/email accion=enviar-prueba.')
}

main()
  .catch((err) => { console.error('ERROR:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
