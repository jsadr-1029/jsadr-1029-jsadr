// =====================================================
// Registro de número de teléfono en WABA
// -----------------------------------------------------
// Comandos:
//   npx tsx scripts/register-phone-number.ts request <cc> <number> <verified_name> [method]
//     method: SMS (default) | VOICE
//     Ej: npx tsx scripts/register-phone-number.ts request 57 3103674546 "JSADR" SMS
//   npx tsx scripts/register-phone-number.ts verify <phone_number_id> <code>
//     Ej: npx tsx scripts/register-phone-number.ts verify 1234567890 123456
// =====================================================

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA_ID = process.env.WHATSAPP_BUSINESS_ID
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'

async function solicitar(cc: string, number: string, verifiedName: string, method: string) {
  console.log(`=== SOLICITAR REGISTRO DE NÚMERO ===`)
  console.log(`País (cc): ${cc}`)
  console.log(`Número: ${number}`)
  console.log(`Nombre verificado: ${verifiedName}`)
  console.log(`Método: ${method}\n`)

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/phone_numbers`
  const body: any = {
    cc,
    phone_number: number,
    verified_name: verifiedName,
    method, // SMS o VOICE
  }

  console.log('POST', url)
  console.log('Body:', JSON.stringify(body, null, 2))
  console.log('')

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    console.error('  → Error:', data?.error?.message)
    process.exit(1)
  }
  console.log('✅ Solicitud enviada')
  console.log(JSON.stringify(data, null, 2))
  console.log('')
  console.log(`🔔 Meta enviará un código de 6 dígitos vía ${method} al +${cc}${number}.`)
  console.log(`   Para verificar: npx tsx scripts/register-phone-number.ts verify ${data.id} <codigo>`)
}

async function verificar(phoneNumberId: string, code: string) {
  console.log(`=== VERIFICAR NÚMERO ===`)
  console.log(`Phone Number ID: ${phoneNumberId}`)
  console.log(`Código: ${code}\n`)

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/verify`
  const body = { code }

  console.log('POST', url)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('❌ HTTP', resp.status, JSON.stringify(data, null, 2))
    console.error('  → Error:', data?.error?.message)
    process.exit(1)
  }
  console.log('✅ Verificación completada')
  console.log(JSON.stringify(data, null, 2))
}

async function main() {
  if (!TOKEN || !WABA_ID) {
    console.error('Faltan WHATSAPP_TOKEN o WHATSAPP_BUSINESS_ID en el entorno')
    process.exit(1)
  }
  const cmd = process.argv[2]
  if (cmd === 'request') {
    const cc = process.argv[3]
    const number = process.argv[4]
    const name = process.argv[5]
    const method = process.argv[6] || 'SMS'
    if (!cc || !number || !name) {
      console.error('Uso: request <cc> <number> <verified_name> [SMS|VOICE]')
      process.exit(1)
    }
    await solicitar(cc, number, name, method)
  } else if (cmd === 'verify') {
    const id = process.argv[3]
    const code = process.argv[4]
    if (!id || !code) {
      console.error('Uso: verify <phone_number_id> <code>')
      process.exit(1)
    }
    await verificar(id, code)
  } else {
    console.error('Comando inválido. Usa: request <cc> <number> <name> [method] | verify <id> <code>')
    process.exit(1)
  }
}

main()
