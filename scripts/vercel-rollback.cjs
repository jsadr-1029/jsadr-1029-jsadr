// =====================================================
// vercel-rollback.cjs — Rollback deploy de Vercel vía CLI
// -----------------------------------------------------
// Uso:
//   node scripts/vercel-rollback.cjs                 # rollback al penúltimo deploy READY
//   node scripts/vercel-rollback.cjs <deploymentId>  # rollback a un deployment específico
//
// Lee VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID de .env
// =====================================================

require('dotenv').config({ path: '.env' })

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID
const VERCEL_API = 'https://api.vercel.com'

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error('❌ VERCEL_TOKEN o VERCEL_PROJECT_ID no configurados en .env')
  process.exit(1)
}

async function listDeploys(limit = 10) {
  const url = `${VERCEL_API}/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=${limit}&target=production${VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status} listando deploys`)
  const data = await res.json()
  return data.deployments || []
}

async function promoteDeployment(deploymentId) {
  const url = `${VERCEL_API}/v13/deployments/${deploymentId}/promote?projectId=${VERCEL_PROJECT_ID}${VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} promoting ${deploymentId}: ${txt.slice(0, 200)}`)
  }
  return res.json().catch(() => ({}))
}

async function main() {
  const targetId = process.argv[2]
  console.log('=== Vercel Rollback ===')
  console.log(`Project: ${VERCEL_PROJECT_ID}`)
  console.log(`Team: ${VERCEL_TEAM_ID || '(none)'}\n`)

  console.log('Listando últimos deploys...')
  const deploys = await listDeploys(10)

  if (deploys.length === 0) {
    console.error('❌ No se encontraron deploys.')
    process.exit(1)
  }

  console.log('\nDeploys recientes:')
  deploys.forEach((d, i) => {
    console.log(`  [${i}] ${d.uid.slice(0, 16)} | ${d.readyState} | ${new Date(d.createdAt).toISOString()} | ${(d.meta?.githubCommitMessage || '').slice(0, 50)}`)
  })

  let target = null
  if (targetId) {
    target = deploys.find((d) => d.uid === targetId || d.uid.startsWith(targetId))
    if (!target) {
      console.error(`\n❌ Deployment ${targetId} no encontrado.`)
      process.exit(1)
    }
  } else {
    const ready = deploys.filter((d) => d.readyState === 'READY')
    if (ready.length < 2) {
      console.error('\n❌ No hay deployment anterior. Necesitas al menos 2 deploys READY.')
      process.exit(1)
    }
    target = ready[1] // Penúltimo READY
  }

  console.log(`\nTarget: ${target.uid}`)
  console.log(`  URL: ${target.url}`)
  console.log(`  Commit: ${target.meta?.githubCommitMessage?.slice(0, 60) || 'N/A'}`)
  console.log(`  Creado: ${new Date(target.createdAt).toISOString()}`)

  console.log('\nEjecutando promote (rollback)...')
  try {
    const result = await promoteDeployment(target.uid)
    console.log('\n✅ Rollback exitoso!')
    console.log(`   Production URL: https://${target.url}`)
    process.exit(0)
  } catch (e) {
    console.error('\n❌ Error:', e.message)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
