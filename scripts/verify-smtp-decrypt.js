const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

const raw = process.env.API_ENCRYPTION_KEY
let key
if (/^[0-9a-fA-F]{64}$/.test(raw)) {
  key = Buffer.from(raw, 'hex')
} else {
  key = crypto.createHash('sha256').update(raw).digest()
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':')
  if (parts.length !== 2) return encryptedText
  const iv = Buffer.from(parts[0], 'hex')
  const data = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(data, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

;(async () => {
  const c = await prisma.correoInstitucional.findUnique({
    where: { id: 'cms72g9lf0000skrgnk9403hb' }
  })
  console.log('email:', c.email)
  console.log('smtpHost:', c.smtpHost, ':', c.smtpPort)
  console.log('smtpUser:', c.smtpUser)
  console.log('smtpPass (raw DB):', c.smtpPass ? c.smtpPass.slice(0,40) + '...' : null)
  console.log('smtpPass (decrypted):', c.smtpPass ? decrypt(c.smtpPass) : null)
  await prisma.$disconnect()
})().catch(e => { console.error('ERROR:', e); process.exit(1) })
