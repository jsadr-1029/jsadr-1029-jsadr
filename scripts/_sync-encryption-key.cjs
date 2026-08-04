// Re-sync API_ENCRYPTION_KEY to Vercel to ensure it matches local .env
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
  const API_ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY

  console.log('Local API_ENCRYPTION_KEY:')
  console.log(`  Length: ${API_ENCRYPTION_KEY.length} chars`)
  console.log(`  First 12: ${API_ENCRYPTION_KEY.slice(0, 12)}`)
  console.log(`  Last 12: ${API_ENCRYPTION_KEY.slice(-12)}`)

  // Get existing env var
  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const listJson = await listRes.json()
  const existing = (listJson.envs || []).find(e => e.key === 'API_ENCRYPTION_KEY')
  if (!existing) {
    console.log('API_ENCRYPTION_KEY NOT found in Vercel — creating it')
    const createRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'API_ENCRYPTION_KEY',
          value: API_ENCRYPTION_KEY,
          type: 'encrypted',
          target: ['production', 'preview', 'development'],
        }),
      }
    )
    console.log(`Create HTTP ${createRes.status}: ${await createRes.text()}`)
    return
  }
  console.log(`\nExisting API_ENCRYPTION_KEY in Vercel:`)
  console.log(`  id: ${existing.id}`)
  console.log(`  type: ${existing.type}`)
  console.log(`  target: ${existing.target?.join(',')}`)
  console.log(`  updatedAt: ${existing.updatedAt}`)

  // Update it (force the value to match local)
  console.log('\nUpdating API_ENCRYPTION_KEY in Vercel to match local .env...')
  const updRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}?teamId=${VERCEL_TEAM_ID}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: API_ENCRYPTION_KEY,
        type: 'encrypted',
        target: ['production', 'preview', 'development'],
      }),
    }
  )
  console.log(`Update HTTP ${updRes.status}`)
  if (!updRes.ok) {
    console.log(await updRes.text())
    return
  }
  const updated = await updRes.json()
  console.log(`✅ Updated. New updatedAt: ${updated.updatedAt}`)
}
main().catch(e => console.error('ERR:', e))
