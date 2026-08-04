// =====================================================
// GUARDAR Y BLOQUEAR BREVO API KEY (xkeysib-...) EN MÓDULO DE SEGURIDAD
// =====================================================
// 1. Guarda BREVO_API_KEY en ConexionAPI.EMAIL_SMTP (campo apiKey, cifrado)
// 2. Sincroniza env var BREVO_API_KEY en Vercel
// 3. Verifica que la API key funciona con /v3/account
//
// La eliminación está protegida por la clave maestra "Eliminar" en
// /api/seguridad/credenciales/eliminar (botón en SeguridadView.tsx).
// =====================================================

const fs = require('fs')
const crypto = require('crypto')

// Cargar .env manualmente
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Réplica de encryptSensitive/decryptSensitive
const ALGORITHM = 'aes-256-cbc'
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}
function encryptSensitive(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}
function decryptSensitive(encryptedText) {
  try {
    const key = getEncryptionKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText
  }
}

const BREVO_API_KEY = process.env.BREVO_API_KEY
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj'
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'

if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY no definido en .env')
  process.exit(1)
}
if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN no definido en .env')
  process.exit(1)
}

// =====================================================
// Probar Brevo API key contra /v3/account
// =====================================================
async function testBrevoApiKey(apiKey) {
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json()
    return {
      ok: true,
      detalle: `Conectado como ${data.email || data.companyName || 'cuenta Brevo'} (plan: ${data.plan?.[0]?.type || 'desconocido'})`,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// =====================================================
// Probar envío real vía Brevo HTTP API (POST /v3/smtp/email)
// =====================================================
async function testBrevoSendEmail(apiKey) {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'JSADR Test', email: 'jsa@jsadr.com.co' },
        to: [{ email: 'jsa@jsadr.com.co' }],
        subject: `TEST Brevo HTTP API — ${new Date().toISOString()}`,
        htmlContent: '<p>Este correo confirma que la API key de Brevo funciona vía HTTPS API.</p>',
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json()
    return { ok: true, detalle: `Enviado. messageId=${data.messageId}` }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// =====================================================
// Sync Vercel env var
// =====================================================
async function syncVercelEnvVar(token, key, value) {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  const listRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!listRes.ok) {
    return { ok: false, error: `List HTTP ${listRes.status}: ${await listRes.text()}` }
  }
  const listJson = await listRes.json()
  const existing = (listJson.envs || []).find((e) => e.key === key)

  const payload = {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  }

  if (existing) {
    const updRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )
    if (updRes.ok) return { ok: true, action: 'updated', id: existing.id }
    return { ok: false, error: `Update HTTP ${updRes.status}: ${await updRes.text()}` }
  } else {
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (createRes.ok) {
      const data = await createRes.json()
      return { ok: true, action: 'created', id: data.id }
    }
    return { ok: false, error: `Create HTTP ${createRes.status}: ${await createRes.text()}` }
  }
}

// =====================================================
// MAIN
// =====================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' GUARDAR BREVO API KEY (xkeysib-...) — Módulo de Seguridad')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log(`API key: ${BREVO_API_KEY.slice(0, 25)}...${BREVO_API_KEY.slice(-6)}\n`)

  // 1. Verificar roundtrip de encriptación
  const apiEnc = encryptSensitive(BREVO_API_KEY)
  if (decryptSensitive(apiEnc) !== BREVO_API_KEY) {
    console.error('❌ Roundtrip encriptación API key fallido')
    process.exit(1)
  }
  console.log('✓ Roundtrip de encriptación OK\n')

  // 2. Probar la API key ANTES de guardarla
  console.log('─── Test Brevo API key (GET /v3/account) ───')
  const testAcc = await testBrevoApiKey(BREVO_API_KEY)
  if (testAcc.ok) {
    console.log(`✅ ${testAcc.detalle}`)
  } else {
    console.log(`❌ API key inválida: ${testAcc.error}`)
    process.exit(1)
  }
  console.log()

  console.log('─── Test envío real vía Brevo HTTP API (POST /v3/smtp/email) ───')
  const testSend = await testBrevoSendEmail(BREVO_API_KEY)
  if (testSend.ok) {
    console.log(`✅ ${testSend.detalle}`)
  } else {
    console.log(`❌ Falló envío de prueba: ${testSend.error}`)
  }
  console.log()

  // 3. Guardar API key en ConexionAPI.EMAIL_SMTP.apiKey (cifrada)
  console.log('─── 1) Actualizando ConexionAPI.EMAIL_SMTP.apiKey ───')
  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (!smtp) {
    console.error('❌ No existe ConexionAPI.EMAIL_SMTP')
    process.exit(1)
  }
  const oldKeyLen = smtp.apiKey?.length || 0
  await prisma.conexionAPI.update({
    where: { id: smtp.id },
    data: {
      apiKey: apiEnc, // guardar API key cifrada
      probada: true,
      fechaUltimaPrueba: new Date(),
      resultadoUltimaPrueba: testAcc.detalle,
    },
  })
  console.log(`✅ ConexionAPI.EMAIL_SMTP.apiKey actualizada (${oldKeyLen} → ${apiEnc.length} chars cifrados)`)
  console.log(`   (api key desencripta a: ${decryptSensitive(apiEnc).slice(0, 25)}...${decryptSensitive(apiEnc).slice(-6)})\n`)

  // 4. Sincronizar env var BREVO_API_KEY en Vercel
  console.log('─── 2) Sincronizando env var BREVO_API_KEY en Vercel ───')
  const r = await syncVercelEnvVar(VERCEL_TOKEN, 'BREVO_API_KEY', BREVO_API_KEY)
  if (r.ok) {
    console.log(`✅ Vercel env var 'BREVO_API_KEY' ${r.action} (id: ${r.id})`)
  } else {
    console.log(`❌ Falló sync 'BREVO_API_KEY': ${r.error}`)
  }
  console.log()

  // 5. Resumen
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' RESUMEN FINAL — Brevo API key guardada y bloqueada')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`• Brevo API key: ${BREVO_API_KEY.slice(0, 25)}...${BREVO_API_KEY.slice(-6)}`)
  console.log(`  → ConexionAPI.EMAIL_SMTP.apiKey  (cifrado, ${apiEnc.length} chars)`)
  console.log(`  → Vercel env var BREVO_API_KEY   (${r.ok ? 'sincronizada' : 'PENDIENTE'})`)
  console.log()
  console.log('🔒 PROTECCIÓN: Eliminación solo vía /api/seguridad/credenciales/eliminar')
  console.log('   con clave maestra "Eliminar" (ADMIN only, botón en SeguridadView.tsx)')
  console.log('   Plataforma: BREVO_API')
  console.log()
  console.log('✅ BREVO API KEY GUARDADA Y BLOQUEADA')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
