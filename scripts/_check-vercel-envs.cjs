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

  const res = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
  )
  const data = await res.json()
  for (const e of (data.envs || [])) {
    // Don't show full value, just first/last chars and length
    let valuePreview = ''
    if (e.value && typeof e.value === 'string') {
      valuePreview = e.value.length > 30
        ? `${e.value.slice(0, 12)}...${e.value.slice(-6)} (${e.value.length} chars)`
        : e.value
    } else if (e.type === 'encrypted') {
      valuePreview = '[encrypted in Vercel]'
    }
    console.log(`${e.key.padEnd(28)} | target=${(e.target||[]).join(',')} | type=${e.type} | value=${valuePreview}`)
  }
}
main().catch(e => console.error('ERR:', e))
