// =====================================================
// RESTAURAR + SINCRONIZAR CONFIG BREVO SMTP
// =====================================================
// Hace 3 cosas:
//   1. Re-encripta la SMTP key de Brevo con la API_ENCRYPTION_KEY
//      actual (recién regenerada en .env) y actualiza
//      correoInstitucional.smtpPass
//   2. Inserta un registro EMAIL_SMTP en conexionAPI (la tabla
//      que la app realmente lee en src/lib/email.ts)
//   3. Verifica el envío con un correo de prueba real
// =====================================================

const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// --- helpers de cifrado (réplica de security.ts) ---
function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}
function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}
function decrypt(encText) {
  const parts = encText.split(':')
  if (parts.length !== 2) return encText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv)
  let dec = decipher.update(parts[1], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// --- credenciales Brevo (constantes conocidas) ---
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: process.env.BREVO_SMTP_KEY || 'REDACTED_USE_ENV_VAR',
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr · Jo*** Se*** Al*** D** R**',
}

async function main() {
  console.log('=== Paso 1: Re-encriptar smtpPass en correoInstitucional ===')
  const correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) throw new Error('No hay correo institucional principal activo')

  const newEncryptedPass = encrypt(BREVO.pass)
  // Roundtrip check
  if (decrypt(newEncryptedPass) !== BREVO.pass) {
    throw new Error('Roundtrip de encriptación fallido')
  }
  console.log('  ✓ Roundtrip AES-256-CBC OK')

  await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      smtpHost: BREVO.host,
      smtpPort: BREVO.port,
      smtpUser: BREVO.user,
      smtpPass: newEncryptedPass,
      ssl: false,
      tls: true,
      starttls: true,
      ultimoTest: null,
      ultimoTestOk: null,
    },
  })
  console.log('  ✓ correoInstitucional actualizado (id=' + correo.id + ')')

  console.log('\n=== Paso 2: Insertar registro EMAIL_SMTP en conexionAPI ===')
  // Borrar cualquier registro previo (por si quedó de un intento anterior)
  const existing = await prisma.conexionAPI.findMany({
    where: { tipo: 'EMAIL_SMTP' },
  })
  for (const e of existing) {
    await prisma.conexionAPI.delete({ where: { id: e.id } })
    console.log('  - Eliminado registro previo id=' + e.id)
  }

  const configuracionExtra = JSON.stringify({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    fromName: BREVO.fromName,
    fromEmail: BREVO.fromEmail,
  })

  const conn = await prisma.conexionAPI.create({
    data: {
      nombre: 'Brevo SMTP (correo institucional)',
      tipo: 'EMAIL_SMTP',
      descripcion: 'Relay SMTP de Brevo (smtp-relay.brevo.com:587). 300 correos/día gratis.',
      url: `${BREVO.host}:${BREVO.port}`,
      apiKey: BREVO.fromEmail,           // email del remitente
      usuario: BREVO.user,                // SMTP user
      password: newEncryptedPass,         // SMTP pass encriptado con AES-256-CBC
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })
  console.log('  ✓ Registro creado en conexionAPI (id=' + conn.id + ')')

  console.log('\n=== Paso 3: Test de envío real vía Brevo ===')
  const transporter = nodemailer.createTransport({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    auth: { user: BREVO.user, pass: BREVO.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })

  console.log('  [3a] verify()...')
  await transporter.verify()
  console.log('      ✓ Conexión y autenticación OK')

  console.log('  [3b] sendMail()...')
  const info = await transporter.sendMail({
    from: `"${BREVO.fromName}" <${BREVO.fromEmail}>`,
    to: BREVO.fromEmail,
    subject: '✓ Jo*** Se*** Al*** D** R** — Restauración de correo vía Brevo',
    text: `Restauración exitosa.

Configuración aplicada:
- Host: ${BREVO.host}
- Puerto: ${BREVO.port}
- Usuario: ${BREVO.user}
- STARTTLS: activado
- API_ENCRYPTION_KEY: regenerado (rotación)

Cambios:
1. .env regenerado con 6 secretos aleatorios (API_ENCRYPTION_KEY, JWT_SECRET, JWT_REFRESH_SECRET, OTP_CHAT_SECRET, PORTAL_SESSION_SECRET, CHAT_DYN_SECRET)
2. correoInstitucional.smtpPass re-encriptado con la nueva API_ENCRYPTION_KEY
3. Registro EMAIL_SMTP creado en conexionAPI (tabla que lee src/lib/email.ts)

Fecha: ${new Date().toISOString()}

Si recibes este correo, la app podrá enviar correos desde cualquier módulo.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: #16a34a;">✓ Restauración de correo vía Brevo</h2>
        <p>La configuración SMTP se sincronizó correctamente entre <code>correoInstitucional</code> y <code>conexionAPI</code>.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Host SMTP</td><td style="padding: 8px;">${BREVO.host}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Puerto</td><td style="padding: 8px;">${BREVO.port} (STARTTLS)</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Usuario</td><td style="padding: 8px;">${BREVO.user}</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">From</td><td style="padding: 8px;">${BREVO.fromName} &lt;${BREVO.fromEmail}&gt;</td></tr>
          <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Fecha</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 13px;">Jo*** Se*** Al*** D** R** v4.0</p>
      </div>`,
  })
  console.log('      ✓ Correo enviado')
  console.log('        MessageId:', info.messageId)
  console.log('        Response:', info.response)

  // Marcar como probado en ambas tablas
  await prisma.conexionAPI.update({
    where: { id: conn.id },
    data: {
      probada: true,
      fechaUltimaPrueba: new Date(),
      resultadoUltimaPrueba: 'OK - verify() y sendMail() exitosos',
    },
  })
  await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      ultimoTest: new Date(),
      ultimoTestOk: true,
    },
  })
  console.log('  ✓ BD actualizada (probada=true, ultimoTestOk=true)')

  console.log('\n🎉 ¡RESTAURACIÓN COMPLETADA!')
  console.log('   Revisa la bandeja de ' + BREVO.fromEmail + ' (y spam por si acaso).')
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR:', e.message)
    if (e.code) console.error('  code:', e.code)
    if (e.response) console.error('  response:', e.response)
    if (e.responseCode) console.error('  responseCode:', e.responseCode)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
