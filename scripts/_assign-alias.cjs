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
  const ALIAS = 'jsadr-1029-jsadr.vercel.app'

  // Get the latest deployment (whatever it is)
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&limit=5`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const data = await res.json()
  const latest = data.deployments?.[0]
  if (!latest) {
    console.log('No deployments found')
    return
  }
  console.log(`Latest deploy: ${latest.uid} state=${latest.readyState} sha=${latest.meta?.githubCommitSha?.slice(0,7)}`)
  if (latest.readyState !== 'READY') {
    console.log('Latest not READY, aborting')
    return
  }

  // Assign alias
  console.log(`\n=== Assigning alias ${ALIAS} to ${latest.uid} ===`)
  const aliasRes = await fetch(
    `https://api.vercel.com/v2/deployments/${latest.uid}/aliases?teamId=${VERCEL_TEAM_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alias: ALIAS }),
    }
  )
  console.log(`HTTP ${aliasRes.status}: ${await aliasRes.text()}`)
}
main().catch(e => console.error('ERR:', e))
