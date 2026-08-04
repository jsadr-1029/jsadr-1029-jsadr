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

async function main() {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN
  const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

  // Get project info to see production alias
  const projRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const proj = await projRes.json()
  console.log('Project targets:', proj.targets)
  console.log('Project alias:', proj.alias)

  // List recent deployments with alias info
  const res = await fetch(
    `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&limit=5`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const data = await res.json()
  for (const d of (data.deployments || [])) {
    console.log(`${d.uid} | sha=${d.meta?.githubCommitSha?.slice(0,7)} | state=${d.readyState} | target=${d.target} | alias=${(d.alias || []).join(',')}`)
  }

  // Promote via /v13/deployments/{id}/domains/{domain} - assign alias
  // Actually Vercel API: POST /v9/deployments/{id}/aliases?teamId=X
  const candidate = (data.deployments || []).find(d => d.readyState === 'READY' && d.target === 'production' && d.meta?.githubCommitSha?.slice(0,7) === 'f38ff5c')
  if (!candidate) {
    console.log('No candidate found')
    return
  }
  console.log(`\n=== Assigning alias to ${candidate.uid} ===`)
  // First check if alias already assigned
  const aliasRes = await fetch(
    `https://api.vercel.com/v2/deployments/${candidate.uid}/aliases?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  console.log(`Aliases HTTP ${aliasRes.status}: ${await aliasRes.text()}`)
}
main().catch(e => console.error('ERR:', e))
