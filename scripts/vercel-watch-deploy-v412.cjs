// scripts/vercel-watch-deploy-v412.cjs
// Monitorea el deploy más reciente en Vercel hasta que esté READY.
// Requiere VERCEL_TOKEN en .env
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env')
const envText = fs.readFileSync(envPath, 'utf8')
const tokenMatch = envText.match(/^VERCEL_TOKEN=(.+)$/m)
const token = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : ''
if (!token) {
  console.error('VERCEL_TOKEN no encontrado en .env')
  process.exit(1)
}

async function getLatestDeployment() {
  const resp = await fetch('https://api.vercel.com/v6/deployments?limit=1&projectId=prj_jsadr-1029', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) {
    console.error('Error listando deployments:', resp.status, await resp.text())
    return null
  }
  const data = await resp.json()
  return data.deployments?.[0] || null
}

async function waitForReady(maxAttempts = 60) {
  console.log(`Monitoreando deploy más reciente... (máximo ${maxAttempts} intentos)\n`)
  let lastStatus = null
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const dep = await getLatestDeployment()
      if (!dep) {
        console.log(`[${i}/${maxAttempts}] Sin deployment`)
      } else {
        const status = dep.status || dep.readyState
        if (status !== lastStatus) {
          console.log(`[${i}/${maxAttempts}] ${dep.url} → ${status}`)
          lastStatus = status
        }
        if (status === 'READY') {
          console.log(`\n✅ Deploy READY: https://${dep.url}`)
          console.log(`   ID: ${dep.uid}`)
          console.log(`   Creado: ${new Date(dep.created).toISOString()}`)
          return dep
        }
        if (status === 'ERROR' || status === 'CANCELED') {
          console.log(`\n❌ Deploy ${status}: https://${dep.url}`)
          process.exit(2)
        }
      }
    } catch (e) {
      console.error(`[${i}] Error:`, e.message)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
  console.log('\n⏱ Timeout esperando READY')
  process.exit(3)
}

waitForReady()
