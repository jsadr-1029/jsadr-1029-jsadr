// Wait for Vercel deploy to be READY, then test /api/auth/recuperar-clave
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

async function waitReady() {
  const start = Date.now()
  while (Date.now() - start < 300000) { // 5 min max
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID}&limit=1`,
      { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` } }
    )
    const data = await res.json()
    const d = data.deployments?.[0]
    if (d) {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      console.log(`[${elapsed}s] ${d.uid} state=${d.readyState}`)
      if (d.readyState === 'READY') return d
      if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') {
        console.error(`Deploy ${d.readyState}`)
        process.exit(1)
      }
    }
    await new Promise(r => setTimeout(r, 10000))
  }
  console.error('Timeout waiting for READY')
  process.exit(1)
}

async function testRecuperarClave() {
  console.log('\n=== Test /api/auth/recuperar-clave en Vercel production ===')
  const res = await fetch('https://jsadr-1029-jsadr.vercel.app/api/auth/recuperar-clave', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://jsadr-1029-jsadr.vercel.app',
      Referer: 'https://jsadr-1029-jsadr.vercel.app/',
      'User-Agent': 'Mozilla/5.0 (test)',
    },
    body: JSON.stringify({ identificador: 'adm-jsadr' }),
  })
  console.log(`HTTP ${res.status}`)
  const text = await res.text()
  console.log(`Body: ${text.slice(0, 400)}`)
  if (res.ok) {
    try {
      const j = JSON.parse(text)
      if (j.success) {
        console.log('\n✅ RECUPERACIÓN DE CLAVE FUNCIONA — correo enviado correctamente')
      }
    } catch {}
  }
}

async function main() {
  console.log('=== Esperando a que Vercel esté READY ===')
  await waitReady()
  console.log('\n✅ Vercel READY')
  // Extra wait for DNS / alias propagation
  console.log('Esperando 15s extra para propagación de alias...')
  await new Promise(r => setTimeout(r, 15000))
  await testRecuperarClave()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
