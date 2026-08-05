require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Cargar decryptSensitive desde el módulo src/lib/security (compilado)
// O usar la lógica directamente:
const crypto = require('crypto')
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}
function decryptSensitive(encryptedText) {
  try {
    const key = getEncryptionKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    return `[DECRYPT_FAIL: ${err.message}]`
  }
}

async function main() {
  const c = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!c) { console.log('Sin conexión EMAIL_SMTP activa'); return }
  console.log('=== Conexión EMAIL_SMTP ===')
  console.log('id:', c.id)
  console.log('usuario (SMTP login):', c.usuario)
  console.log('url:', c.url)
  console.log('apiKey (primeros 30 chars):', c.apiKey ? c.apiKey.slice(0, 30) + '...' : 'NULL')
  console.log('apiKey length:', c.apiKey?.length || 0)
  console.log('apiKey starts with xkeysib-?', c.apiKey?.startsWith('xkeysib-'))
  console.log('password (primeros 30 chars):', c.password ? c.password.slice(0, 30) + '...' : 'NULL')
  console.log('password length:', c.password?.length || 0)
  
  // Intentar desencriptar password
  if (c.password) {
    const decryptedPass = decryptSensitive(c.password)
    if (decryptedPass.startsWith('[DECRYPT_FAIL')) {
      console.log('\n[!] password NO se pudo desencriptar:')
      console.log('   ', decryptedPass)
      console.log('   password (raw) primeros 50 chars:', c.password.slice(0, 50))
    } else {
      console.log('\npassword desencriptado OK:')
      console.log('  starts with xsmtpsib-?', decryptedPass.startsWith('xsmtpsib-'))
      console.log('  length:', decryptedPass.length)
      console.log('  primeros 12 chars:', decryptedPass.slice(0, 12) + '...')
      console.log('  últimos 6 chars:', decryptedPass.slice(-6))
    }
  }
  
  // Intentar desencriptar apiKey
  if (c.apiKey) {
    const decryptedKey = decryptSensitive(c.apiKey)
    if (decryptedKey.startsWith('[DECRYPT_FAIL')) {
      console.log('\n[!] apiKey NO se pudo desencriptar:')
      console.log('   ', decryptedKey)
    } else {
      console.log('\napiKey desencriptado OK:')
      console.log('  starts with xkeysib-?', decryptedKey.startsWith('xkeysib-'))
      console.log('  length:', decryptedKey.length)
      console.log('  primeros 12 chars:', decryptedKey.slice(0, 12) + '...')
      console.log('  últimos 6 chars:', decryptedKey.slice(-6))
    }
  }
}
main().catch(e => { console.error('ERR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
