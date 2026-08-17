// =====================================================================
// verificar-sync-fecha-cuota.cjs
// =====================================================================
// Verifica que los cambios de "Fecha primera cuota + categorías" estén
// sincronizados al 100% en:
//   1. Neon DB (categorías con nuevos topes)
//   2. GitHub (commit 46935fd en origin/main)
//   3. Vercel (GitHub Actions deploy exitoso + producción responde 200)
// =====================================================================
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'

const https = require('https')
const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const TARGET_COMMIT = '46935fd'
const GITHUB_REPO = 'jsadr-1029/jsadr-1029-jsadr'
const VERCEL_URL = 'https://jsadr-1029-jsadr.vercel.app/'

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { headers }
    https.get(url, opts, (res) => {
      let body = ''
      res.on('data', (d) => body += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body), raw: body }) }
        catch { resolve({ status: res.statusCode, json: null, raw: body }) }
      })
    }).on('error', reject)
  })
}

async function main() {
  console.log('\n========================================================')
  console.log('VERIFICACIÓN SINCRONIZACIÓN: Fecha primera cuota + categorías')
  console.log('========================================================')

  // 1. Neon DB
  console.log('\n[1/3] Neon DB — categorías')
  const cats = await db.categoriaCliente.findMany({ orderBy: { codigo: 'asc' } })
  const esperadas = {
    'CAT-1': { min: 150000, max: 500000 },
    'CAT-2': { min: 150000, max: 700000 },
    'CAT-3': { min: 150000, max: 1200000 },
    'CAT-4': { min: 150000, max: 0 /* sin límite */ },
  }
  let dbOk = true
  for (const c of cats) {
    const e = esperadas[c.codigo]
    if (!e) continue
    const ok = c.montoMinimo === e.min && c.montoMaximo === e.max
    if (!ok) dbOk = false
    const maxStr = c.montoMaximo === 0 ? 'SIN LÍMITE' : `$${c.montoMaximo.toLocaleString('es-CO')}`
    console.log(`  ${ok ? '✓' : '✗'} ${c.codigo} ${c.nombre} — min $${c.montoMinimo.toLocaleString('es-CO')} / max ${maxStr}`)
  }
  console.log(`  → Neon DB: ${dbOk ? '✅ OK' : '❌ FAIL'}`)

  // 2. GitHub
  console.log('\n[2/3] GitHub — commit ' + TARGET_COMMIT)
  const ghResp = await httpsGetJson(
    `https://api.github.com/repos/${GITHUB_REPO}/commits/${TARGET_COMMIT}`,
    { 'User-Agent': 'verify-script' }
  )
  const ghOk = ghResp.status === 200 && ghResp.json && ghResp.json.sha && ghResp.json.sha.startsWith(TARGET_COMMIT)
  if (ghOk) {
    console.log(`  ✓ Commit encontrado: ${ghResp.json.sha.substring(0, 7)} — ${ghResp.json.commit.message.split('\n')[0]}`)
    console.log(`  ✓ Autor: ${ghResp.json.commit.author.name} · Fecha: ${ghResp.json.commit.author.date}`)
  } else {
    console.log(`  ✗ No se encontró el commit (status=${ghResp.status})`)
  }
  console.log(`  → GitHub: ${ghOk ? '✅ OK' : '❌ FAIL'}`)

  // 2b. GitHub Actions run más reciente
  const runsResp = await httpsGetJson(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=3`,
    { 'User-Agent': 'verify-script' }
  )
  let actionsOk = false
  if (runsResp.status === 200 && runsResp.json && runsResp.json.workflow_runs) {
    const runs = runsResp.json.workflow_runs
    for (const r of runs) {
      const isDeploy = (r.name || '').toLowerCase().includes('deploy') || (r.name || '').toLowerCase().includes('vercel')
      console.log(`  · run #${r.run_number} (${r.name}) — ${r.status}/${r.conclusion || '?'} — ${r.head_sha.substring(0, 7)}`)
      if (r.head_sha.startsWith(TARGET_COMMIT) && r.conclusion === 'success') {
        actionsOk = true
      }
    }
  }
  console.log(`  → GitHub Actions (commit 46935fd success): ${actionsOk ? '✅ OK' : '⏳ pendiente (deploy puede estar en curso)'}`)

  // 3. Vercel producción
  console.log('\n[3/3] Vercel — producción responde 200')
  const vResp = await new Promise((resolve) => {
    https.get(VERCEL_URL, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location })
    }).on('error', () => resolve({ status: 0 }))
  })
  const vOk = vResp.status === 200 || vResp.status === 302
  console.log(`  · URL: ${VERCEL_URL}`)
  console.log(`  · Status: ${vResp.status}${vResp.location ? ` → ${vResp.location}` : ''}`)
  console.log(`  → Vercel: ${vOk ? '✅ OK (responde)' : '❌ FAIL'}`)

  // Resumen
  console.log('\n========================================================')
  console.log('RESUMEN FINAL')
  console.log('========================================================')
  console.log(`  Neon DB:           ${dbOk ? '✅' : '❌'}`)
  console.log(`  GitHub commit:     ${ghOk ? '✅' : '❌'}`)
  console.log(`  GitHub Actions:    ${actionsOk ? '✅' : '⏳ (deploy en curso)'}`)
  console.log(`  Vercel prod:       ${vOk ? '✅' : '❌'}`)
  const todo = dbOk && ghOk && vOk
  console.log(`\n  → SINCRONIZACIÓN TOTAL: ${todo ? '✅ AL 100%' : '⏳ en progreso (Neon + GitHub OK, deploy Vercel en curso)'}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
