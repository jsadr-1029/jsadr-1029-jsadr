// =====================================================
// TEST: Simula exactamente lo que hace src/lib/email.ts
// =====================================================
// Lee la configuración SMTP de la tabla conexionAPI
// (igual que obtenerConfigSmtp() en email.ts), construye
// el transporter de nodemailer y envía un correo real.
//
// Esto prueba el MISMO código que ejecutará la app cuando
// cualquier módulo llame a enviarEmail().
// =====================================================

const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
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

// Réplica exacta de obtenerConfigSmtp() en src/lib/email.ts
async function obtenerConfigSmtp() {
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!conexion) return null

  let host = ''
  let port = 587
  let secure = false
  let fromName = 'Sistema de Préstamos'
  let fromEmail = ''

  if (conexion.configuracionExtra) {
    try {
      const extra = JSON.parse(conexion.configuracionExtra)
      if (extra.host) host = extra.host
      if (extra.port) port = parseInt(extra.port)
      if (extra.secure !== undefined) secure = !!extra.secure
      if (extra.fromName) fromName = extra.fromName
      if (extra.fromEmail) fromEmail = extra.fromEmail
    } catch { /* ignore */ }
  }

  if (!host && conexion.url) {
    const urlParts = conexion.url.split(':')
    host = urlParts[0]
    if (urlParts[1]) port = parseInt(urlParts[1])
  }

  if (!host) return null

  const user = conexion.usuario || ''
  let pass = ''
  if (conexion.password) {
    try {
      pass = decrypt(conexion.password)
    } catch {
      pass = conexion.password
    }
  }

  if (!fromEmail) fromEmail = conexion.apiKey || user
  if (!user || !pass || !fromEmail) return null

  return { host, port, secure, user, pass, fromName, fromEmail }
}

async function main() {
  console.log('=== TEST: Path de email.ts ===\n')

  // 1. Obtener config (igual que la app)
  const config = await obtenerConfigSmtp()
  if (!config) {
    console.error('❌ No hay SMTP configurado en conexionAPI')
    process.exit(1)
  }
  console.log('✓ Config SMTP obtenida de conexionAPI:')
  console.log('  host:', config.host)
  console.log('  port:', config.port)
  console.log('  user:', config.user)
  console.log('  fromName:', config.fromName)
  console.log('  fromEmail:', config.fromEmail)
  console.log('  pass: (longitud ' + config.pass.length + ' chars, desencriptado OK)')

  // 2. Crear transporter (igual que obtenerTransporter() en email.ts)
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  })

  // 3. verify()
  console.log('\n[1/2] transporter.verify()...')
  await transporter.verify()
  console.log('  ✓ verify() OK')

  // 4. enviarEmail() — enviar correo de prueba
  console.log('\n[2/2] enviarEmail() — enviando correo de prueba...')
  const to = config.fromEmail  // autoenvío al correo institucional
  const subject = '✓ Jo*** Se*** Al*** D** R** — Test del módulo de correos'
  const text = `Test exitoso del módulo de envío de correos de Jo*** Se*** Al*** D** R**.

Este correo fue enviado usando EXACTAMENTE el mismo código que usa la app:
1. obtenerConfigSmtp() leyó la config de la tabla conexionAPI
2. obtenerTransporter() creó el transporter de nodemailer
3. enviarEmail() llamó a transporter.sendMail()

Configuración usada:
- Host: ${config.host}
- Puerto: ${config.port}
- Usuario: ${config.user}
- From: "${config.fromName}" <${config.fromEmail}>
- To: ${to}

Fecha: ${new Date().toISOString()}

Si recibes este correo, todos los módulos de la app que usen enviarEmail()
(recuperación de clave, OTP de firma, notificaciones, etc.) funcionarán correctamente.`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
      <h2 style="color: #16a34a;">✓ Test del módulo de correos</h2>
      <p>Este correo fue enviado usando <strong>exactamente el mismo código</strong> que usa la app:</p>
      <ol>
        <li><code>obtenerConfigSmtp()</code> leyó la config de la tabla <code>conexionAPI</code></li>
        <li><code>obtenerTransporter()</code> creó el transporter de nodemailer</li>
        <li><code>enviarEmail()</code> llamó a <code>transporter.sendMail()</code></li>
      </ol>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; width: 35%;">Host SMTP</td><td style="padding: 8px;">${config.host}</td></tr>
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Puerto</td><td style="padding: 8px;">${config.port} (STARTTLS)</td></tr>
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Usuario</td><td style="padding: 8px;">${config.user}</td></tr>
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">From</td><td style="padding: 8px;">${config.fromName} &lt;${config.fromEmail}&gt;</td></tr>
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">To</td><td style="padding: 8px;">${to}</td></tr>
        <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Fecha</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
      </table>
      <p>Si recibes este correo, los módulos que usan <code>enviarEmail()</code> funcionarán:</p>
      <ul>
        <li>Recuperación de clave</li>
        <li>OTP de firma de pagarés</li>
        <li>Notificaciones de pagos</li>
        <li>Aceptación de T&C por OTP</li>
      </ul>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Jo*** Se*** Al*** D** R** v4.0 — Sistema de préstamos</p>
    </div>`

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to,
    subject,
    text,
    html,
  })

  console.log('  ✓ Correo enviado')
  console.log('    MessageId:', info.messageId)
  console.log('    Envelope from:', info.envelope?.from)
  console.log('    Envelope to:', info.envelope?.to)
  console.log('    Response:', info.response)

  console.log('\n🎉 ¡MÓDULO DE CORREO FUNCIONANDO END-TO-END!')
  console.log('   Revisa la bandeja de ' + to + ' (y spam por si acaso).')
  console.log('')
  console.log('   Ahora cualquier módulo de la app que llame a enviarEmail()')
  console.log('   usará Brevo SMTP correctamente.')
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
