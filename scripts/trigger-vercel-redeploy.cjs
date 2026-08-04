// Trigger a Vercel redeploy of the production branch to clear warm instances
// and pick up the new env vars (BREVO_SMTP_KEY, VERCEL_TOKEN) and the email.ts
// cache-hash fix.

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
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

async function main() {
  console.log('=== Triggering Vercel redeploy ===')
  // 1. List recent deployments for the project (use projects/{id}/deployments endpoint)
  const listUrl = `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&limit=5`
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!listRes.ok) {
    console.error(`List HTTP ${listRes.status}: ${await listRes.text()}`)
    process.exit(1)
  }
  const listData = await listRes.json()
  const lastDeploy = listData.deployments?.[0]
  if (!lastDeploy) {
    console.log('No previous deployment found, will create fresh')
  } else {
    console.log(`Last deploy: ${lastDeploy.uid} (sha: ${lastDeploy.meta?.githubCommitSha?.slice(0, 7)}, state: ${lastDeploy.readyState})`)
  }

  // 2. Create a new deployment with the same git ref (HEAD of main) to redeploy
  const createUrl = `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}`
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'jsadr-1029-jsadr',
      target: 'production',
      gitSource: {
        type: 'github',
        org: 'jsadr-1029',
        repo: 'jsadr-1029-jsadr',
        ref: 'main',
      },
    }),
  })
  if (!createRes.ok) {
    console.error(`Create HTTP ${createRes.status}: ${await createRes.text()}`)
    process.exit(1)
  }
  const deploy = await createRes.json()
  console.log(`\n✅ New deployment triggered:`)
  console.log(`   ID: ${deploy.id}`)
  console.log(`   URL: https://${deploy.url}`)
  console.log(`   State: ${deploy.readyState}`)
  console.log(`   Inspect: https://vercel.com/jsadr-1029/jsadr-1029-jsadr/${deploy.id}`)
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
