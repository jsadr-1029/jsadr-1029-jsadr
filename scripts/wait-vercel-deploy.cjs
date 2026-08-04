#!/usr/bin/env node
// Espera al último deploy de Vercel tras un push a main y reporta estado.
// Lee VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_PROJECT_URL del .env.

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

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop'
const PROJECT_ID = process.env.VERCEL_PROJECT_ID

if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error('Faltan VERCEL_TOKEN o VERCEL_PROJECT_ID en .env')
  process.exit(1)
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function main() {
  console.log('Esperando a que aparezca el nuevo deploy (commit 50dc500)...')
  let deployFound = null
  const startTime = Date.now()

  // Poll cada 10s hasta 60s para encontrar el nuevo deploy
  for (let i = 0; i < 6; i++) {
    const json = await fetchJson(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=5&target=production`,
    )
    const deploys = json.deployments || []
    console.log(`Intento ${i + 1}: ${deploys.length} deploys listados`)
    for (const d of deploys) {
      console.log(`  - ${d.uid} | ${d.meta?.githubCommitSha?.slice(0, 7) || '?'} | ${d.readyState} | ${d.createdAt}`)
      if (d.meta?.githubCommitSha?.startsWith('50dc500')) {
        deployFound = d
        break
      }
    }
    if (deployFound) break
    await new Promise((r) => setTimeout(r, 10000))
  }

  if (!deployFound) {
    console.error('\n❌ No se encontró deploy para commit 50dc500.')
    console.error('   Probablemente Vercel aún no detectó el push. Reintenta en 1 min.')
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
      console.log(`\n✅ Deploy READY en ${elapsed}s!`)
      console.log(`URL: https://${d.url}`)
      console.log(`Alias: ${(d.alias || []).join(', ')}`)
      process.exit(0)
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      console.error(`\n❌ Deploy ${state}.`)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }

  console.error('\n⏱ Timeout esperando deploy.')
  process.exit(1)
}

main().catch((e) => {
  console.error('ERR:', e.message)
  process.exit(1)
})
