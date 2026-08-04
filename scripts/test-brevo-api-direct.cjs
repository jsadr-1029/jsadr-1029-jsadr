// Test directo desde el servidor de Vercel — llama a la API HTTPS de Brevo
// para ver qué error específico devuelve.
// Este script ejecuta el endpoint /api/email/test-brevo-api que vamos a crear.

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

const BREVO_API_KEY = process.env.BREVO_API_KEY

async function main() {
  console.log('Test local: Brevo HTTPS API con la API key\n')
  console.log(`API key: ${BREVO_API_KEY.slice(0, 25)}...${BREVO_API_KEY.slice(-6)}\n`)

  // 1. GET /v3/account
  console.log('─── 1) GET /v3/account ───')
  const r1 = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
  })
  console.log(`Status: ${r1.status}`)
  console.log(`Body: ${(await r1.text()).slice(0, 300)}`)
  console.log()

  // 2. POST /v3/smtp/email
  console.log('─── 2) POST /v3/smtp/email (envío real) ───')
  const r2 = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'JSADR Test Local', email: 'jsa@jsadr.com.co' },
      to: [{ email: 'jsa@jsadr.com.co' }],
      subject: `TEST Brevo API local ${new Date().toISOString()}`,
      htmlContent: '<p>Test local vía API HTTPS</p>',
    }),
  })
  console.log(`Status: ${r2.status}`)
  console.log(`Body: ${(await r2.text()).slice(0, 300)}`)
}

main().catch(e => console.error('ERROR:', e.message))
