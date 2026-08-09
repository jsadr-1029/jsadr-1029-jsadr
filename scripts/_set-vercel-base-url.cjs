// =====================================================
// Configurar NEXT_PUBLIC_BASE_URL y NEXT_PUBLIC_APP_URL
// en el proyecto de Vercel (jsadr.com.co) vía API REST.
//
// Uso:
//   VERCEL_TOKEN="vcp_xxx..." node scripts/_set-vercel-base-url.cjs
//
// Si no se pasa VERCEL_TOKEN por env, intenta recuperarlo de
// PlataformaSync (BD Neon) usando API_ENCRYPTION_KEY del .env.
// =====================================================
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Cargar .env
try {
  const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) {
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  }
} catch (e) {}

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj'
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'
const BASE_URL_VALUE = 'https://jsadr.com.co'

async function recoverTokenFromDB() {
  try {
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60',
        },
      },
    })
    const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    await prisma.$disconnect()
    if (!vercel || !vercel.tokenCifrado) return null

    const rawKey = process.env.API_ENCRYPTION_KEY
    if (!rawKey) {
      console.error('✗ API_ENCRYPTION_KEY no definida — no se puede descifrar el token de la BD')
      return null
    }
    const key = /^[0-9a-fA-F]{64}$/.test(rawKey) ? Buffer.from(rawKey, 'hex') : crypto.createHash('sha256').update(rawKey).digest()
    const parts = vercel.tokenCifrado.split(':')
    if (parts.length !== 2) return null
    const iv = Buffer.from(parts[0], 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let dec = decipher.update(parts[1], 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  } catch (e) {
    console.error('✗ Error recuperando token de BD:', e.message)
    return null
  }
}

async function getExistingEnvs(token) {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`GET /env → HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.envs || []
}

async function deleteEnv(token, envId, key) {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${envId}?teamId=${VERCEL_TEAM_ID}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const txt = await res.text()
    console.warn(`  ⚠ No se pudo eliminar ${key} (${envId}): HTTP ${res.status}`)
    return false
  }
  return true
}

async function createEnv(token, key, value, targets = ['production', 'preview', 'development']) {
  const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  const body = {
    key,
    value,
    type: 'plain',
    target: targets,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`POST /env ${key} → HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  return true
}

async function main() {
  console.log('=== Configurar NEXT_PUBLIC_BASE_URL en Vercel ===\n')

  let token = process.env.VERCEL_TOKEN
  if (!token) {
    console.log('VERCEL_TOKEN no pasado por env. Intentando recuperarlo de BD Neon...')
    token = await recoverTokenFromDB()
  }
  if (!token) {
    console.error('\n✗ No se pudo obtener VERCEL_TOKEN.')
    console.error('  Opciones:')
    console.error('   1) VERCEL_TOKEN="vcp_xxx..." node scripts/_set-vercel-base-url.cjs')
    console.error('   2) Configurar manualmente en Vercel dashboard:')
    console.error('      → Settings → Environment Variables')
    console.error('      → NEXT_PUBLIC_BASE_URL = https://jsadr.com.co')
    console.error('      → NEXT_PUBLIC_APP_URL  = https://jsadr.com.co')
    console.error('      → Aplicar a Production, Preview, Development')
    process.exit(1)
  }
  console.log(`✓ VERCEL_TOKEN: ${token.slice(0, 12)}...${token.slice(-6)} (${token.length} chars)`)
  console.log(`✓ VERCEL_PROJECT_ID: ${VERCEL_PROJECT_ID}`)
  console.log(`✓ VERCEL_TEAM_ID: ${VERCEL_TEAM_ID}`)
  console.log(`✓ Valor a configurar: ${BASE_URL_VALUE}\n`)

  // Validar token
  const userRes = await fetch('https://api.vercel.com/v2/user', { headers: { Authorization: `Bearer ${token}` } })
  if (!userRes.ok) {
    console.error(`✗ Token inválido o expirado: HTTP ${userRes.status}`)
    process.exit(1)
  }
  const userData = await userRes.json()
  console.log(`✓ Usuario Vercel: ${userData.user?.email || userData.user?.username}\n`)

  // Listar envs existentes
  console.log('→ Obteniendo variables de entorno actuales...')
  const existing = await getExistingEnvs(token)
  const keysToUpdate = ['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_APP_URL']

  for (const key of keysToUpdate) {
    const matches = existing.filter((e) => e.key === key)
    if (matches.length === 0) {
      console.log(`\n→ ${key}: no existe. Creando...`)
      await createEnv(token, key, BASE_URL_VALUE)
      console.log(`  ✓ ${key} = ${BASE_URL_VALUE} (production, preview, development)`)
    } else {
      console.log(`\n→ ${key}: ya existe (${matches.length} entrada(s)).`)
      for (const m of matches) {
        const targets = (m.target || []).join(',')
        const valuePreview = m.value
          ? (m.value.length > 30 ? `${m.value.slice(0, 12)}...${m.value.slice(-6)}` : m.value)
          : '[encrypted]'
        console.log(`   - id=${m.id} target=${targets} value=${valuePreview} type=${m.type}`)

        // Si el valor NO es exactamente BASE_URL_VALUE, borrar y recrear
        if (m.value !== BASE_URL_VALUE) {
          console.log(`   → Eliminando entrada ${m.id}...`)
          await deleteEnv(token, m.id, key)
          console.log(`   → Creando nueva entrada con valor ${BASE_URL_VALUE}...`)
          await createEnv(token, key, BASE_URL_VALUE)
          console.log(`   ✓ ${key} actualizada`)
        } else {
          console.log(`   ✓ Ya tiene el valor correcto, sin cambios`)
        }
      }
    }
  }

  console.log('\n=== Verificación final ===')
  const updated = await getExistingEnvs(token)
  for (const key of keysToUpdate) {
    const matches = updated.filter((e) => e.key === key)
    if (matches.length === 0) {
      console.log(`  ✗ ${key}: NO fue creada`)
    } else {
      for (const m of matches) {
        const targets = (m.target || []).join(',')
        const valuePreview = m.value
          ? (m.value.length > 30 ? `${m.value.slice(0, 12)}...${m.value.slice(-6)}` : m.value)
          : '[encrypted]'
        console.log(`  ✓ ${key} = ${valuePreview}  target=${targets}`)
      }
    }
  }

  console.log('\n✅ Configuración completada.')
  console.log('   NOTA: Las variables nuevas se aplican a nuevos deploys.')
  console.log('   Si hay un deploy en curso, se aplicará cuando termine.')
  console.log('   Para forzar redeploy: Vercel dashboard → Deployments → Redeploy.')
}

main().catch((e) => {
  console.error('\n✗ ERROR:', e.message)
  process.exit(1)
})
