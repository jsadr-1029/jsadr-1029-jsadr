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
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID}&limit=3`,
    { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` } }
  )
  const data = await res.json()
  for (const d of (data.deployments || [])) {
    console.log(`${d.uid} | sha=${d.meta?.githubCommitSha?.slice(0,7) || '-'} | state=${d.readyState} | createdAt=${d.createdAt} | alias=${d.alias?.[0] || '-'}`)
  }
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
