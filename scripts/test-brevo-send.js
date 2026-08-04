// =====================================================
// PRUEBA DE ENVÍO REAL DE CORREO VÍA BREVO SMTP RELAY
// =====================================================
// Verifica:
//   1. Conexión SMTP a smtp-relay.brevo.com:587
//   2. Autenticación con la SMTP key
//   3. Envío real de un mensaje de prueba
//
// IMPORTANTE: Brevo requiere que el remitente (From) esté verificado
// en su panel (Senders → añadir jsa@jsadr.com.co y confirmar el email).
// Si no está verificado, Brevo rechazará con error 421/550 "unverified sender".
// =====================================================

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function decryptSensitive(encryptedText) {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
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

  console.log('=== CONFIGURACIÓN EN BD ===')
  console.log({
    host: correo.smtpHost,
    port: correo.smtpPort,
    user: correo.smtpUser,
    fromEmail: correo.email,
    fromName: correo.nombreRemitente || '(sin nombre)',
    starttls: correo.starttls,
    ssl: correo.ssl,
  })

  const pass = decryptSensitive(correo.smtpPass)
  console.log('Password desencriptado, longitud:', pass.length, 'caracteres')

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

  // 1. verify() — solo comprueba conexión y auth
  console.log('\n[1/2] Verificando conexión SMTP (verify)...')
  try {
    await transporter.verify()
    console.log('✅ verify() OK — conexión y autenticación OK con Brevo')
  } catch (err) {
    console.error('❌ verify() FALLÓ:')
    console.error('  Código:', err.code)
    console.error('  Mensaje:', err.message)
    console.error('  Response:', err.response)
    console.error('  ResponseCode:', err.responseCode)
    console.error('\nCausas comunes:')
    console.error('  - EAUTH: SMTP key incorrecta (vuelve a generarla en Brevo)')
    console.error('  - ETIMEDOUT/ECONNREFUSED: firewall bloqueando salida a 587')
    process.exit(2)
  }

  // 2. Enviar correo real
  console.log('\n[2/2] Enviando correo de prueba real...')
  const to = correo.email  // Autoenvío al propio correo institucional
  const info = await transporter.sendMail({
    from: `"${correo.nombreRemitente || 'Jo*** Se*** Al*** D** R**'}" <${correo.email}>`,
    to,
    subject: '✓ Jo*** Se*** Al*** D** R** — Prueba de envío vía Brevo SMTP',
    text: `Prueba exitosa de envío de correo vía Brevo SMTP relay.

Configuración:
- Host: ${correo.smtpHost}
- Puerto: ${correo.smtpPort}
- Usuario: ${correo.smtpUser}
- STARTTLS: ${correo.starttls ? 'activado' : 'desactivado'}

Fecha: ${new Date().toISOString()}

Si recibes este correo, la migración a Brevo fue exitosa.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: #16a34a;">✓ Prueba exitosa vía Brevo SMTP</h2>
        <p>La migración del correo institucional a <strong>Brevo SMTP relay</strong> se completó correctamente.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Host SMTP</td><td style="padding: 8px;">${correo.smtpHost}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Puerto</td><td style="padding: 8px;">${correo.smtpPort}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Usuario</td><td style="padding: 8px;">${correo.smtpUser}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">STARTTLS</td><td style="padding: 8px;">${correo.starttls ? 'Activado' : 'Desactivado'}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Fecha</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 13px;">Jo*** Se*** Al*** D** R** v4.0 — Sistema de préstamos</p>
      </div>
    `,
  })

  console.log('✅ CORREO ENVIADO:')
  console.log('  MessageId:', info.messageId)
  console.log('  Envelope from:', info.envelope?.from)
  console.log('  Envelope to:', info.envelope?.to)
  console.log('  Response:', info.response)

  // Actualizar BD con éxito
  await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      ultimoTest: new Date(),
      ultimoTestOk: true,
    },
  })

  console.log('\n✅ BD actualizada: ultimoTestOk=true')
  console.log('\n🎉 ¡MIGRACIÓN A BREVO COMPLETADA!')
  console.log(`   Revisa la bandeja de entrada de ${to} (y spam por si acaso)`)
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR:')
    console.error('  Mensaje:', e.message)
    console.error('  Código:', e.code)
    console.error('  Response:', e.response)
    console.error('  ResponseCode:', e.responseCode)
    console.error('\nCausas comunes con Brevo:')
    console.error('  - "unverified sender" → añadir jsa@jsadr.com.co en Brevo → Senders → Verify')
    console.error('  - "daily quota exceeded" → superaste 300 correos/día del plan gratis')
    console.error('  - EAUTH → SMTP key mal copiada')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
