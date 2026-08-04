// Test if Brevo HTTPS API accepts the SMTP key (xsmtpsib-...)
// Brevo API endpoint: POST https://api.brevo.com/v3/smtp/email
// Headers: api-key: <key>, Content-Type: application/json
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

async function main() {
  const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY
  console.log(`Testing Brevo API with key: ${BREVO_SMTP_KEY.slice(0, 20)}...${BREVO_SMTP_KEY.slice(-6)}`)

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_SMTP_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'JSADR Test', email: 'jsa@jsadr.com.co' },
      to: [{ email: 'jsa@jsadr.com.co' }],
      subject: 'Test Brevo API (HTTPS) — should bypass IP restriction',
      htmlContent: '<p>Si recibiste este correo, el API HTTPS de Brevo funciona sin restricción de IP.</p>',
    }),
  })
  console.log(`HTTP ${res.status}`)
  const text = await res.text()
  console.log(`Body: ${text.slice(0, 500)}`)
}
main().catch(e => console.error('ERR:', e))
