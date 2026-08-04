// Verify what's currently in Neon (the source of truth that Vercel reads from)
const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function decryptSensitive(encryptedText) {
  const raw = process.env.API_ENCRYPTION_KEY
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : crypto.createHash('sha256').update(raw).digest()
  const parts = encryptedText.split(':')
  if (parts.length !== 2) return encryptedText
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function main() {
  console.log('API_ENCRYPTION_KEY (local .env):')
  console.log(`  Length: ${process.env.API_ENCRYPTION_KEY.length} chars`)
  console.log(`  First 12: ${process.env.API_ENCRYPTION_KEY.slice(0, 12)}`)
  console.log(`  Last 12: ${process.env.API_ENCRYPTION_KEY.slice(-12)}`)
  console.log()

  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  console.log('ConexionAPI.EMAIL_SMTP:')
  console.log(`  id: ${smtp.id}`)
  console.log(`  usuario: ${smtp.usuario}`)
  console.log(`  password (encrypted): ${smtp.password?.slice(0, 30)}...`)
  console.log(`  password length: ${smtp.password?.length} chars`)
  console.log(`  updatedAt: ${smtp.updatedAt}`)

  if (smtp.password) {
    const decrypted = decryptSensitive(smtp.password)
    console.log(`  password (decrypted): ${decrypted.slice(0, 20)}...${decrypted.slice(-6)}`)
    console.log(`  password length (decrypted): ${decrypted.length} chars`)
    console.log(`  starts with xsmtpsib-? ${decrypted.startsWith('xsmtpsib-')}`)
    console.log(`  ends with AuEQHE? ${decrypted.endsWith('AuEQHE')}`)
    console.log(`  matches .env BREVO_SMTP_KEY? ${decrypted === process.env.BREVO_SMTP_KEY}`)
  }

  // Also check CorreoInstitucional
  const correo = await prisma.correoInstitucional.findFirst({ where: { email: 'jsa@jsadr.com.co' } })
  if (correo) {
    console.log()
    console.log('CorreoInstitucional jsa@jsadr.com.co:')
    console.log(`  smtpUser: ${correo.smtpUser}`)
    console.log(`  smtpPass (encrypted): ${correo.smtpPass?.slice(0, 30)}...`)
    console.log(`  updatedAt: ${correo.updatedAt}`)
    if (correo.smtpPass) {
      const decrypted = decryptSensitive(correo.smtpPass)
      console.log(`  smtpPass (decrypted): ${decrypted.slice(0, 20)}...${decrypted.slice(-6)}`)
      console.log(`  matches .env BREVO_SMTP_KEY? ${decrypted === process.env.BREVO_SMTP_KEY}`)
    }
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
