// Prueba real de envío con nodemailer — captura el error exacto
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function decryptSensitive(encryptedText) {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  let key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex')
  else key = crypto.createHash('sha256').update(raw).digest()
  const parts = encryptedText.split(':')
  if (parts.length !== 2) return encryptedText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function main() {
  const correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) { console.error('No hay correo principal activo'); process.exit(1) }

  const pass = decryptSensitive(correo.smtpPass)
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
    socketTimeout: 20000,
  })

  try {
    console.log('Enviando correo real a jsadr23@outlook.com...')
    const info = await transporter.sendMail({
      from: `"${correo.nombreRemitente || 'Jsadr'}" <${correo.smtpUser}>`,
      to: 'jsadr23@outlook.com',
      subject: 'prueba reparacion SMTP',
      text: 'prueba',
    })
    console.log('✅ ENVIADO OK')
    console.log('messageId:', info.messageId)
    console.log('response:', info.response)
    console.log('envelope:', JSON.stringify(info.envelope))
    await transporter.close()
  } catch (err) {
    console.error('❌ ERROR REAL:')
    console.error('code:', err.code)
    console.error('message:', err.message)
    console.error('response:', err.response)
    console.error('responseCode:', err.responseCode)
    console.error('command:', err.command)
    process.exit(2)
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) }).finally(() => prisma.$disconnect())
