// scripts/watch-vercel-johan-cleanup.cjs
// Espera al deploy de Vercel para commit ef63bd0 (limpieza solicitudes Johan).
// Lee VERCEL_TOKEN y VERCEL_PROJECT_ID del .env (o archivos .env.*).

const fs = require('fs')

function loadEnv(path) {
  if (!fs.existsSync(path)) return
  const content = fs.readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) {
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
}

loadEnv('/home/z/my-project/.env')
loadEnv('/home/z/my-project/.env.local')
loadEnv('/home/z/my-project/.env.production')
// Algunos creds están en scripts/save-vercel-creds.js
try {
  const creds = require('./save-vercel-creds.js')
  if (creds.VERCEL_TOKEN) process.env.VERCEL_TOKEN = creds.VERCEL_TOKEN
  if (creds.VERCEL_PROJECT_ID) process.env.VERCEL_PROJECT_ID = creds.VERCEL_PROJECT_ID
} catch {}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const PROJECT_ID = process.env.VERCEL_PROJECT_ID
const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'
const COMMIT_SHA = process.argv[2] || 'ef63bd0'

if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error('Faltan VERCEL_TOKEN o VERCEL_PROJECT_ID en variables de entorno.')
  console.error('  VERCEL_TOKEN=' + (VERCEL_TOKEN ? 'SET' : 'MISSING'))
  console.error('  VERCEL_PROJECT_ID=' + (PROJECT_ID ? 'SET' : 'MISSING'))
  process.exit(1)
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function main() {
  console.log(`Esperando deploy para commit ${COMMIT_SHA}...`)
  let deployFound = null
  const startTime = Date.now()

  for (let i = 0; i < 18; i++) {
    const json = await fetchJson(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=8&target=production`,
    )
    const deploys = json.deployments || []
    console.log(`Intento ${i + 1}: ${deploys.length} deploys listados`)
    for (const d of deploys) {
      const sha = (d.meta?.githubCommitSha || '').slice(0, 7)
      console.log(`  - ${d.uid} | ${sha} | ${d.readyState} | ${d.createdAt}`)
      if (sha.startsWith(COMMIT_SHA.slice(0, 7))) {
        deployFound = d
        break
      }
    }
    if (deployFound) break
    await new Promise((r) => setTimeout(r, 10000))
  }

  if (!deployFound) {
    console.error(`\nNo se encontró deploy para commit ${COMMIT_SHA}.`)
    console.error('Mostrando los 3 deploys más recientes como referencia:')
    try {
      const json = await fetchJson(
        `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=3`,
      )
      for (const d of json.deployments || []) {
        console.error(`  - ${d.uid} | ${d.meta?.githubCommitSha?.slice(0, 7) || '?'} | ${d.readyState} | ${d.url}`)
      }
    } catch (e) {
      console.error('No se pudo listar deploys recientes:', e.message)
    }
    process.exit(1)
  }

  console.log(`\nDeploy encontrado: ${deployFound.uid}`)
  console.log('Monitoreando estado...')

  let lastStatus = ''
  for (let i = 0; i < 60; i++) {
    const d = await fetchJson(
      `https://api.vercel.com/v13/deployments/${deployFound.uid}?teamId=${TEAM_ID}`,
    )
    const state = d.readyState
    const substate = d.readySubstate || ''
    const status = `${state} ${substate}`.trim()
    if (status !== lastStatus) {
      const ts = new Date().toISOString().slice(11, 19)
      console.log(`[${ts}] ${status}`)
      lastStatus = status
    }
    if (state === 'READY') {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`\nDeploy READY en ${elapsed}s!`)
      console.log(`URL: https://${d.url}`)
      console.log(`Alias: ${(d.alias || []).join(', ')}`)
      process.exit(0)
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      console.error(`\nDeploy ${state}.`)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }

  console.error('\nTimeout esperando deploy.')
  process.exit(1)
}

main().catch((e) => {
  console.error('ERR:', e.message)
  process.exit(1)
})
