// scripts/get-vercel-status-johan.cjs
// Obtiene el estado del último deploy de Vercel sin necesidad de token:
// consulta el endpoint público del proyecto y verifica que el deploy más
// reciente esté sirviendo el código actual.
//
// Alternativa: si el token está disponible en PlataformaSync, lo usa.
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const crypto = require('crypto')

process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const prisma = new PrismaClient()

const VERCEL_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj'
const VERCEL_TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'
const PROJECT_URL = 'jsadr-1029-jsadr.vercel.app'

// Mirror src/lib/security.ts decrypt
function decrypt(encryptedB64, keyHex, ivB64) {
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivB64, 'base64')
  const data = Buffer.from(encryptedB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(data, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function main() {
  // 1. Cargar API_ENCRYPTION_KEY del .env (puede no estar, en cuyo caso no podemos desencriptar)
  let API_ENCRYPTION_KEY = null
  try {
    const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
    const m = envContent.match(/^API_ENCRYPTION_KEY=(.*)$/m)
    if (m) {
      let v = m[1].trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      API_ENCRYPTION_KEY = v
    }
  } catch {}

  let vercelToken = null
  try {
    const sync = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (sync && sync.tokenCifrado && API_ENCRYPTION_KEY) {
      // tokenCifrado formato: "ivB64:encryptedB64"
      const [ivB64, encB64] = sync.tokenCifrado.split(':')
      if (ivB64 && encB64) {
        try {
          vercelToken = decrypt(encB64, API_ENCRYPTION_KEY, ivB64)
        } catch (e) {
          console.log('  No se pudo desencriptar token Vercel (formato inesperado?):', e.message)
        }
      }
    } else if (sync && sync.tokenCifrado && !API_ENCRYPTION_KEY) {
      console.log('  tokenCifrado existe en BD pero API_ENCRYPTION_KEY no está en .env — no se puede desencriptar.')
    } else if (!sync) {
      console.log('  No hay registro PlataformaSync.VERCEL en Neon.')
    }
  } catch (e) {
    console.log('  Error consultando PlataformaSync.VERCEL:', e.message)
  }

  // 2. Si tenemos token, consultar API de Vercel
  if (vercelToken) {
    console.log('\n=== CONSULTANDO VERCEL API ===')
    try {
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&limit=8`,
        { headers: { Authorization: `Bearer ${vercelToken}` } },
      )
      if (!res.ok) {
        console.log(`  HTTP ${res.status}: ${await res.text()}`)
      } else {
        const json = await res.json()
        console.log(`  Total deploys listados: ${(json.deployments || []).length}`)
        for (const d of (json.deployments || []).slice(0, 8)) {
          const sha = (d.meta?.githubCommitSha || '').slice(0, 7)
          const msg = (d.meta?.githubCommitMessage || '').split('\n')[0].slice(0, 60)
          const state = d.readyState
          const url = d.url
          const ts = d.createdAt
          const isProd = d.target === 'production' ? '[PROD]' : '      '
          console.log(`  ${isProd} ${sha} | ${state.padEnd(8)} | ${ts} | ${url}`)
          console.log(`          msg: ${msg}`)
        }
      }
    } catch (e) {
      console.log('  Error consultando Vercel API:', e.message)
    }
  } else {
    console.log('\n  No se obtuvo vercelToken — saltando API Vercel.')
  }

  // 3. Verificar URL pública del proyecto
  console.log('\n=== VERIFICACIÓN PÚBLICA DEL PROYECTO ===')
  try {
    const res = await fetch(`https://${PROJECT_URL}/api/estado-mantenimiento`, {
      method: 'GET',
      headers: { 'User-Agent': 'johan-cleanup-watch/1.0' },
    })
    console.log(`  GET https://${PROJECT_URL}/api/estado-mantenimiento → HTTP ${res.status}`)
    if (res.ok) {
      const txt = await res.text()
      console.log(`  Body (primeros 300 chars): ${txt.slice(0, 300)}`)
    }
  } catch (e) {
    console.log('  Error consultando URL pública:', e.message)
  }

  // 4. Verificar estado-cuenta de Johan → debe mostrar 0 préstamos
  console.log('\n=== VERIFICACIÓN POST-DEPLOY (saldo Johan) ===')
  try {
    const res = await fetch(`https://${PROJECT_URL}/api/portal/mi-estado`, {
      method: 'GET',
      headers: { 'x-portal-cedula': '1214731649' },
    })
    console.log(`  GET https://${PROJECT_URL}/api/portal/mi-estado (cedula=1214731649) → HTTP ${res.status}`)
    if (res.ok) {
      const data = await res.json()
      console.log(`  Body: ${JSON.stringify(data).slice(0, 500)}`)
    } else {
      const txt = await res.text()
      console.log(`  Body: ${txt.slice(0, 300)}`)
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }

  // 5. Verificación directa vía reportes/balance → debería dar 0
  console.log('\n=== VERIFICACIÓN REPORTES/BALANCE ===')
  try {
    const res = await fetch(`https://${PROJECT_URL}/api/reportes/balance`, {
      method: 'GET',
    })
    console.log(`  GET https://${PROJECT_URL}/api/reportes/balance → HTTP ${res.status}`)
    if (res.ok) {
      const data = await res.json()
      const saldoTotal = data.saldoTotal ?? data.totalSaldo ?? data.total ?? data.balance ?? data.resumen?.saldoTotal
      console.log(`  Saldo total del sistema (debería ser $0): $${saldoTotal ?? JSON.stringify(data).slice(0, 300)}`)
    } else {
      const txt = await res.text()
      console.log(`  Body: ${txt.slice(0, 300)}`)
    }
  } catch (e) {
    console.log('  Error:', e.message)
  }
}

main()
  .catch((e) => console.error('ERR:', e))
  .finally(async () => {
    await prisma.$disconnect()
  })
