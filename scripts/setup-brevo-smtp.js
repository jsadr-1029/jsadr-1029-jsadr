// =====================================================
// CONFIGURAR BREVO SMTP COMO CORREO INSTITUCIONAL PRINCIPAL
// =====================================================
// Sustituye la configuración de smtp.mi.com.co (que estaba bloqueando
// por reputación de IP — 554 5.7.1) por el relay SMTP de Brevo.
//
// Credenciales obtenidas del panel de Brevo del usuario:
//   Host:    smtp-relay.brevo.com
//   Puerto:  587 (STARTTLS)
//   Usuario: b3e8df001@smtp-brevo.com
//   Pass:    bGDw0LrI7XAtJF5M  (SMTP key, NO la contraseña del panel)
//
// Brevo permite 300 correos/día gratis sin bloqueos de reputación
// porque la IP ya está whitelisted y monitoreada por ellos.
// =====================================================

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// --- Encriptar con AES-256-CBC (réplica de encryptSensitive de security.ts) ---
function encryptSensitive(text) {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  let key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = crypto.createHash('sha256').update(raw).digest()
  }
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// --- Desencriptar (para verificar roundtrip) ---
function decryptSensitive(encryptedText) {
  const raw = process.env.API_ENCRYPTION_KEY
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
    console.error('No se encontró correo institucional principal activo')
    process.exit(1)
  }

  console.log('=== CONFIGURACIÓN ACTUAL (smtp.mi.com.co) ===')
  console.log({
    email: correo.email,
    smtpHost: correo.smtpHost,
    smtpPort: correo.smtpPort,
    smtpUser: correo.smtpUser,
    ssl: correo.ssl,
    tls: correo.tls,
    starttls: correo.starttls,
    ultimoTestOk: correo.ultimoTestOk,
  })

  const BREVO_USER = 'b3e8df001@smtp-brevo.com'
  const BREVO_PASS = process.env.BREVO_SMTP_KEY || 'REDACTED_USE_ENV_VAR'
  const encryptedPass = encryptSensitive(BREVO_PASS)

  // Verificar roundtrip de encriptación
  const roundtrip = decryptSensitive(encryptedPass)
  if (roundtrip !== BREVO_PASS) {
    console.error('Roundtrip de encriptación fallido')
    process.exit(1)
  }
  console.log('\n✓ Roundtrip de encriptación OK')

  const actualizado = await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      smtpHost: 'smtp-relay.brevo.com',
      smtpPort: 587,
      smtpUser: BREVO_USER,
      smtpPass: encryptedPass,
      ssl: false,           // 587 usa STARTTLS, no SSL implícito
      tls: true,
      starttls: true,
      ultimoTest: null,     // reset para forzar re-test
      ultimoTestOk: null,
    },
  })

  console.log('\n=== CONFIGURACIÓN NUEVA (Brevo) ===')
  console.log({
    id: actualizado.id,
    email: actualizado.email,
    smtpHost: actualizado.smtpHost,
    smtpPort: actualizado.smtpPort,
    smtpUser: actualizado.smtpUser,
    ssl: actualizado.ssl,
    tls: actualizado.tls,
    starttls: actualizado.starttls,
  })

  console.log('\n✅ BD actualizada con credenciales Brevo encriptadas (AES-256-CBC)')
  console.log('\nPróximo paso: ejecutar scripts/test-brevo-send.js para enviar correo de prueba')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
