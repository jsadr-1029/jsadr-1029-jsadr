// =====================================================
// PROBAR BREVO CON CREDENCIALES PASADAS POR ARGUMENTO
// =====================================================
// Uso:
//   node scripts/test-brevo-with-key.js <smtp_user> <smtp_key>
//
// Ejemplo:
//   node scripts/test-brevo-with-key.js b3e8df001@smtp-brevo.com "bGDw0LrI7XAtJF5M"
//
// No toca la BD. Solo verifica auth y envía un correo de prueba.
// Útil para diagnosticar 535 5.7.8 Authentication failed.
// =====================================================

const nodemailer = require('nodemailer')

async function main() {
  const [user, key] = process.argv.slice(2)
  if (!user || !key) {
    console.error('Uso: node scripts/test-brevo-with-key.js <smtp_user> <smtp_key>')
    console.error('Ejemplo: node scripts/test-brevo-with-key.js b3e8df001@smtp-brevo.com "bGDw0LrI7XAtJF5M"')
    process.exit(1)
  }

  console.log('=== PROBANDO BREVO SMTP (sin tocar BD) ===')
  console.log('Host:   smtp-relay.brevo.com')
  console.log('Puerto: 587')
  console.log('User:  ', user)
  console.log('Key:   ', key, '(longitud:', key.length, 'caracteres)')
  console.log('')

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass: key },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })

  console.log('[1/2] verify()...')
  try {
    await transporter.verify()
    console.log('✅ AUTH OK — credenciales válidas')
  } catch (err) {
    console.error('❌ AUTH FALLÓ:')
    console.error('  Code:', err.code)
    console.error('  Message:', err.message)
    console.error('  Response:', err.response)
    console.error('')
    console.error('Posibles causas:')
    console.error('  • La SMTP key se copió incompleta o con un carácter mal (revisar 1 vs l, 0 vs O)')
    console.error('  • La cuenta Brevo requiere completar verificación (paso ② en el panel)')
    console.error('  • La key fue regenerada y la anterior quedó revocada')
    process.exit(2)
  }

  console.log('\n[2/2] Enviando correo de prueba a jsa@jsadr.com.co...')
  const info = await transporter.sendMail({
    from: '"Aurora Bancaria" <jsa@jsadr.com.co>',
    to: 'jsa@jsadr.com.co',
    subject: '✓ Aurora Bancaria — Prueba Brevo OK',
    text: `Prueba exitosa vía Brevo con user=${user}.\nFecha: ${new Date().toISOString()}`,
  })
  console.log('✅ ENVIADO')
  console.log('  MessageId:', info.messageId)
  console.log('  Response:', info.response)
  console.log('\nRevisa la bandeja de jsa@jsadr.com.co (y spam por si acaso)')
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
