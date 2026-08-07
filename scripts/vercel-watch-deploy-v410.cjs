// Monitorea el deploy más reciente de Vercel tras un push a main.
// API v6 de Vercel.
const TEAM_ID = 'team_jsadr1029'
const PROJECT_ID = 'prj_xE2b4KQrLPpG3YqF2n3W1kQ9zXy'

const token = process.env.VERCEL_TOKEN
if (!token) {
  console.error('ERROR: VERCEL_TOKEN no definido')
  process.exit(1)
}

async function getLatestDeploy() {
  const url = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=1&production=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('Status:', res.status, await res.text())
    return null
  }
  const data = await res.json()
  return data.deployments?.[0] || null
}

async function main() {
  console.log('Esperando deploy de Vercel…')
  let lastStatus = ''
  for (let i = 0; i < 60; i++) {
    const d = await getLatestDeploy()
    if (!d) {
      console.log('  (sin deploy todavía)')
    } else {
      const s = d.readyState || d.status
      if (s !== lastStatus) {
        console.log(`  ${new Date().toISOString()} — deploy ${d.uid} → ${s}`)
        lastStatus = s
      }
      if (s === 'READY') {
        console.log(`\n✅ Deploy READY en ${i * 5}s`)
        console.log(`URL: https://${d.url}`)
        return
      }
      if (s === 'ERROR') {
        console.log(`\n❌ Deploy ERROR`)
        process.exit(1)
      }
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  console.log('\n⏰ Timeout esperando deploy')
  process.exit(1)
}

main()
