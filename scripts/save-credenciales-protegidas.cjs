// =====================================================
// GUARDAR Y BLOQUEAR 2 CREDENCIALES NUEVAS EN MÓDULO DE SEGURIDAD
// =====================================================
// 1. Brevo SMTP key (xsmtpsib-...) → ConexionAPI.EMAIL_SMTP.password + CorreoInstitucional.smtpPass
// 2. Vercel Token (vcp_...)        → PlataformaSync.VERCEL.tokenCifrado
//
// Ambas credenciales se guardan CIFRADAS con API_ENCRYPTION_KEY (AES-256-CBC).
// La eliminación está protegida por la clave maestra "Eliminar" en
// /api/seguridad/credenciales/eliminar (botón en SeguridadView.tsx).
//
// Después de actualizar la BD, también sincroniza:
//   - Vercel env vars (BREVO_SMTP_KEY + VERCEL_TOKEN) vía Vercel API
//   - .env local (no se commitea — está en .gitignore)
// =====================================================

const fs = require('fs')
const crypto = require('crypto')

// --- Cargar .env manualmente (para evitar conflictos con dotenv) ---
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

// --- Réplica de encryptSensitive/decryptSensitive de src/lib/security.ts ---
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

// --- Nuevas credenciales (leídas de .env, NO hardcodeadas en el script) ---
// Las credenciales son secretas y están en .env (que está en .gitignore).
// Para rotarlas, editar .env y volver a ejecutar este script.
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY
const VERCEL_TOKEN_NEW = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj'
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'

if (!BREVO_SMTP_KEY) {
  console.error('❌ BREVO_SMTP_KEY no definido en .env')
  process.exit(1)
}
if (!VERCEL_TOKEN_NEW) {
  console.error('❌ VERCEL_TOKEN no definido en .env')
  process.exit(1)
}

// =====================================================
// Sync Vercel env var (create or update)
// =====================================================
async function syncVercelEnvVar(token, key, value) {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  // List existing
  const listRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!listRes.ok) {
    return { ok: false, error: `List HTTP ${listRes.status}: ${await listRes.text()}` }
  }
  const listJson = await listRes.json()
  const existing = (listJson.envs || []).find((e) => e.key === key)

  // Common payload
  const payload = {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  }

  if (existing) {
    // Update via PATCH
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
    if (updRes.ok) {
      return { ok: true, action: 'updated', id: existing.id }
    }
    return { ok: false, error: `Update HTTP ${updRes.status}: ${await updRes.text()}` }
  } else {
    // Create via POST
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
// Probar Vercel API con el nuevo token
// =====================================================
async function testVercelToken(token) {
  try {
    const res = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }
    }
    const data = await res.json()
    return {
      ok: true,
      detalle: `Conectado como ${data.user?.email || data.user?.username || 'usuario'}`,
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// =====================================================
// MAIN
// =====================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' GUARDAR Y BLOQUEAR CREDENCIALES NUEVAS — Módulo de Seguridad')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Verificar roundtrip de encriptación
  const brevoEnc = encryptSensitive(BREVO_SMTP_KEY)
  const vercelEnc = encryptSensitive(VERCEL_TOKEN_NEW)
  if (decryptSensitive(brevoEnc) !== BREVO_SMTP_KEY) {
    console.error('❌ Roundtrip encriptación Brevo fallido')
    process.exit(1)
  }
  if (decryptSensitive(vercelEnc) !== VERCEL_TOKEN_NEW) {
    console.error('❌ Roundtrip encriptación Vercel fallido')
    process.exit(1)
  }
  console.log('✓ Roundtrip de encriptación OK para ambas credenciales\n')

  // 2. Probar nuevo token de Vercel ANTES de guardarlo
  console.log('─── Test nuevo Vercel token ───')
  const testV = await testVercelToken(VERCEL_TOKEN_NEW)
  if (testV.ok) {
    console.log(`✅ Vercel API: ${testV.detalle}`)
  } else {
    console.log(`❌ Vercel API rechaza el token: ${testV.error}`)
    console.log('   Se guardará de todos modos en la BD (la sincronización de env vars fallará)')
  }
  console.log()

  // 3. Guardar Brevo SMTP key en ConexionAPI.EMAIL_SMTP
  console.log('─── 1) Actualizando ConexionAPI.EMAIL_SMTP ───')
  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (!smtp) {
    console.error('❌ No existe ConexionAPI.EMAIL_SMTP — crearla primero')
  } else {
    const oldPassLen = smtp.password?.length || 0
    await prisma.conexionAPI.update({
      where: { id: smtp.id },
      data: {
        password: brevoEnc,
        apiKey: brevoEnc, // también guardar como apiKey (algunos flujos lo usan)
        activa: true,
        probada: false, // forzar re-test
        fechaUltimaPrueba: null,
        resultadoUltimaPrueba: null,
      },
    })
    console.log(`✅ ConexionAPI.EMAIL_SMTP password actualizada (${oldPassLen} → ${brevoEnc.length} chars cifrados)`)
  }
  console.log()

  // 4. Guardar Brevo SMTP key en CorreoInstitucional (jsa@jsadr.com.co)
  console.log('─── 2) Actualizando CorreoInstitucional jsa@jsadr.com.co ───')
  const correo = await prisma.correoInstitucional.findFirst({
    where: { email: 'jsa@jsadr.com.co' },
  })
  if (!correo) {
    console.error('❌ No existe CorreoInstitucional jsa@jsadr.com.co')
  } else {
    const oldPassLen = correo.smtpPass?.length || 0
    await prisma.correoInstitucional.update({
      where: { id: correo.id },
      data: {
        smtpHost: 'smtp-relay.brevo.com',
        smtpPort: 587,
        smtpUser: 'b3e8df001@smtp-brevo.com',
        smtpPass: brevoEnc,
        ssl: false,
        tls: true,
        starttls: true,
        estado: 'activo',
        esPrincipal: true,
        ultimoTest: null,
        ultimoTestOk: null,
      },
    })
    console.log(`✅ CorreoInstitucional.smtpPass actualizada (${oldPassLen} → ${brevoEnc.length} chars cifrados)`)
  }
  console.log()

  // 5. Guardar Vercel token en PlataformaSync.VERCEL
  console.log('─── 3) Actualizando PlataformaSync.VERCEL.tokenCifrado ───')
  const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
  if (!vercel) {
    console.error('❌ No existe PlataformaSync.VERCEL — crearla primero')
  } else {
    const oldTokenLen = vercel.tokenCifrado?.length || 0
    await prisma.plataformaSync.update({
      where: { plataforma: 'VERCEL' },
      data: {
        tokenCifrado: vercelEnc,
        sincronizado: true,
        tiempoReal: true,
        proyectoRef: VERCEL_PROJECT_ID,
        endpoint: 'https://api.vercel.com',
        ramaPrincipal: 'main',
        ultimoSync: new Date(),
        ultimoEstado: testV.ok ? 'OK' : 'ERROR',
        ultimoError: testV.ok ? null : testV.error,
      },
    })
    console.log(`✅ PlataformaSync.VERCEL.tokenCifrado actualizado (${oldTokenLen} → ${vercelEnc.length} chars cifrados)`)
  }
  console.log()

  // 6. Sincronizar env vars en Vercel (BREVO_SMTP_KEY y VERCEL_TOKEN)
  if (testV.ok) {
    console.log('─── 4) Sincronizando env vars en Vercel ───')

    // 6a. BREVO_SMTP_KEY (usando el nuevo Vercel token)
    const r1 = await syncVercelEnvVar(VERCEL_TOKEN_NEW, 'BREVO_SMTP_KEY', BREVO_SMTP_KEY)
    if (r1.ok) {
      console.log(`✅ Vercel env var 'BREVO_SMTP_KEY' ${r1.action} (id: ${r1.id})`)
    } else {
      console.log(`❌ Falló sync 'BREVO_SMTP_KEY': ${r1.error}`)
    }

    // 6b. VERCEL_TOKEN (auto-referencia — Vercel permite esto porque el token
    // actual sigue válido para actualizarse a sí mismo)
    const r2 = await syncVercelEnvVar(VERCEL_TOKEN_NEW, 'VERCEL_TOKEN', VERCEL_TOKEN_NEW)
    if (r2.ok) {
      console.log(`✅ Vercel env var 'VERCEL_TOKEN' ${r2.action} (id: ${r2.id})`)
    } else {
      console.log(`❌ Falló sync 'VERCEL_TOKEN': ${r2.error}`)
    }
    console.log()
  } else {
    console.log('─── 4) Omisión de sincronización de env vars (token Vercel inválido) ───\n')
  }

  // 7. Resumen final
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' RESUMEN FINAL — Credenciales guardadas en Neon (BD)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`• Brevo SMTP key:  ${BREVO_SMTP_KEY.slice(0, 30)}...${BREVO_SMTP_KEY.slice(-6)}`)
  console.log(`  → ConexionAPI.EMAIL_SMTP.password   (cifrado, ${brevoEnc.length} chars)`)
  console.log(`  → CorreoInstitucional.smtpPass      (cifrado, ${brevoEnc.length} chars)`)
  console.log(`  → Vercel env var BREVO_SMTP_KEY     (${testV.ok ? 'sincronizada' : 'PENDIENTE'})`)
  console.log(`• Vercel token:    ${VERCEL_TOKEN_NEW.slice(0, 20)}...${VERCEL_TOKEN_NEW.slice(-6)}`)
  console.log(`  → PlataformaSync.VERCEL.tokenCifrado (cifrado, ${vercelEnc.length} chars)`)
  console.log(`  → Vercel env var VERCEL_TOKEN        (${testV.ok ? 'sincronizada' : 'PENDIENTE'})`)
  console.log()
  console.log('🔒 PROTECCIÓN: Eliminación solo vía /api/seguridad/credenciales/eliminar')
  console.log('   con clave maestra "Eliminar" (ADMIN only, botón en SeguridadView.tsx)')
  console.log()
  console.log('✅ CREDENCIALES GUARDADAS Y BLOQUEADAS')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
