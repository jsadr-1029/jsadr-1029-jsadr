// Test directo: enviar correo vía Brevo SMTP con la NUEVA key
// para confirmar que la rotación funcionó.

const fs = require('fs')
const nodemailer = require('nodemailer')

// Cargar .env
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const BREVO_KEY = process.env.BREVO_SMTP_KEY

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log(' TEST Brevo SMTP con NUEVA key')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Key: ${BREVO_KEY.slice(0, 25)}...${BREVO_KEY.slice(-6)}`)
  console.log()

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: 'b3e8df001@smtp-brevo.com',
      pass: BREVO_KEY,
    },
  })

  console.log('─── 1) verify() ───')
  try {
    const r = await transporter.verify()
    console.log('✅ SMTP verify OK:', r)
  } catch (e) {
    console.log('❌ SMTP verify falló:', e.message)
    process.exit(1)
  }
  console.log()

  console.log('─── 2) sendMail() real ───')
  try {
    const info = await transporter.sendMail({
      from: '"JSADR Test" <jsa@jsadr.com.co>',
      to: 'jsa@jsadr.com.co',
      subject: 'TEST rotación Brevo key — ' + new Date().toISOString(),
      text: 'Este correo confirma que la nueva SMTP key funciona end-to-end.',
    })
    console.log('✅ Enviado. messageId:', info.messageId)
    console.log('   response:', info.response)
  } catch (e) {
    console.log('❌ sendMail falló:', e.message)
    process.exit(1)
  }
  console.log()
  console.log('═══════════════════════════════════════════════════')
  console.log(' ✅ NUEVA BREVO KEY FUNCIONA END-TO-END')
  console.log('═══════════════════════════════════════════════════')
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
