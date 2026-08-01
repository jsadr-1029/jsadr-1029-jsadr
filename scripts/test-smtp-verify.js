// Script de prueba directa: intenta conectar y autenticar contra smtp.mi.com.co:587
// usando las credenciales desencriptadas de la BD. No envía correo, solo verify().
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Réplica minimalista de decryptSensitive de src/lib/security.ts
function decryptSensitive(encryptedText) {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  // Si es hex de 64 chars → usar directo como key (32 bytes)
  // Si no → derivar con SHA-256
  let key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = crypto.createHash('sha256').update(raw).digest()
  }
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
  const correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) {
    console.error('No hay correo principal activo')
    process.exit(1)
  }

  console.log('Probando SMTP con config:')
  console.log({
    host: correo.smtpHost,
    port: correo.smtpPort,
    user: correo.smtpUser,
    starttls: correo.starttls,
    ssl: correo.ssl,
  })

  let pass = ''
  try {
    pass = decryptSensitive(correo.smtpPass)
  } catch (e) {
    console.error('Error desencriptando password:', e.message)
    process.exit(1)
  }
  console.log('Password desencriptado, longitud:', pass.length)

  const nodemailer = require('nodemailer')
  const port = Number(correo.smtpPort) || 587
  const secure = correo.ssl || port === 465
  const requireTLS = !secure && (correo.starttls || port === 587 || port === 25)

  const transporter = nodemailer.createTransport({
    host: correo.smtpHost,
    port,
    secure,
    requireTLS,
    auth: { user: correo.smtpUser, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  try {
    console.log('\nIniciando verify()...')
    await transporter.verify()
    console.log('✅ verify() OK — conexión y autenticación exitosas')
    await transporter.close()
  } catch (err) {
    console.error('❌ verify() FALLÓ:')
    console.error('Código:', err.code)
    console.error('Mensaje:', err.message)
    console.error('Response:', err.response)
    console.error('ResponseCode:', err.responseCode)
    process.exit(2)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
