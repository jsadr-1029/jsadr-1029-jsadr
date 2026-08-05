require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()

function decryptBackup(encryptedText) {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', BACKUP_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    return `[DECRYPT_FAIL: ${err.message}]`
  }
}

// Probar varias llaves posibles
function tryWithKey(keyBuf, label) {
  try {
    const parts = process.argv[2].split(':')
    if (parts.length !== 2) return null
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    return null
  }
}

async function main() {
  const c = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!c) { console.log('Sin conexión'); return }
  
  console.log('=== Probando desencriptar password con BACKUP_KEY ===')
  const passBackup = decryptBackup(c.password)
  console.log('Resultado:', passBackup.startsWith('[DECRYPT_FAIL') ? 'FALLO' : 'OK')
  if (!passBackup.startsWith('[DECRYPT_FAIL')) {
    console.log('  password (backup) primeros 12:', passBackup.slice(0, 12))
    console.log('  password (backup) length:', passBackup.length)
    console.log('  starts with xsmtpsib-?', passBackup.startsWith('xsmtpsib-'))
  }
  
  console.log('\n=== Probando desencriptar apiKey con BACKUP_KEY ===')
  const keyBackup = decryptBackup(c.apiKey)
  console.log('Resultado:', keyBackup.startsWith('[DECRYPT_FAIL') ? 'FALLO' : 'OK')
  if (!keyBackup.startsWith('[DECRYPT_FAIL')) {
    console.log('  apiKey (backup) primeros 12:', keyBackup.slice(0, 12))
    console.log('  apiKey (backup) length:', keyBackup.length)
    console.log('  starts with xkeysib-?', keyBackup.startsWith('xkeysib-'))
  }
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
