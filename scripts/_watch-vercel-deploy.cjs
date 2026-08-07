// Monitorea el workflow de deploy a Vercel hasta que termine (success o failure).
// Usa el token de GitHub embebido en el remote URL.

const { execSync } = require('child_process')
const url = execSync('git config --get remote.origin.url').toString().trim()
const m = url.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/)
const TOKEN = m[2]
const REPO = `${m[3]}/${m[4]}`

async function gh(method, path, body) {
  const data = body ? JSON.stringify(body) : null
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jsadr-1029',
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data,
  })
  let respBody
  try { respBody = await r.json() } catch { respBody = await r.text() }
  return { status: r.status, body: respBody }
}

async function main() {
  console.log('=== MONITOREO DEPLOY VERCEL ===')
  console.log(`Repo: ${REPO}`)
  console.log(`Tiempo inicio: ${new Date().toISOString()}\n`)

  // Buscar el workflow deploy-vercel.yml
  const wf = await gh('GET', `/repos/${REPO}/actions/workflows?per_page=30`)
  if (wf.status !== 200) {
    console.log(`✗ No se pudo obtener workflows: HTTP ${wf.status}`)
    return
  }
  const deployWf = (wf.body.workflows || []).find(w => w.name === 'Deploy to Vercel' || w.path.includes('deploy-vercel'))
  if (!deployWf) {
    console.log('✗ No se encontró el workflow "Deploy to Vercel"')
    return
  }
  console.log(`Workflow: ${deployWf.name} (id ${deployWf.id})`)

  // Poll cada 15s por hasta 8 min
  const startTime = Date.now()
  const maxWaitMs = 8 * 60 * 1000

  while (Date.now() - startTime < maxWaitMs) {
    const runs = await gh('GET', `/repos/${REPO}/actions/workflows/${deployWf.id}/runs?per_page=1`)
    if (runs.status !== 200) {
      console.log(`✗ No se pudo obtener runs: HTTP ${runs.status}`)
      return
    }
    const run = (runs.body.workflow_runs || [])[0]
    if (!run) {
      console.log('(sin runs aún)')
      await new Promise(r => setTimeout(r, 15000))
      continue
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[${elapsed}s] run #${run.run_number} | status=${run.status} | conclusion=${run.conclusion || '(en progreso)'} | commit=${run.head_sha.slice(0, 8)}`)
    
    if (run.status === 'completed') {
      console.log(`\n=== RESULTADO FINAL ===`)
      console.log(`conclusion: ${run.conclusion}`)
      console.log(`html_url: ${run.html_url}`)
      if (run.conclusion === 'success') {
        console.log('\n✓ Deploy exitoso — Vercel ya tiene el nuevo código.')
        console.log('  Las credenciales Brevo ahora se descifran vía BACKUP_KEY_SEED.')
        console.log('  Probar flujo OTP del portal...')
      } else {
        console.log('\n✗ Deploy fallido — revisar logs en GitHub Actions.')
      }
      return
    }
    await new Promise(r => setTimeout(r, 15000))
  }
  console.log('\nTimeout esperando deploy (8 min). Verifica manualmente en GitHub Actions.')
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })
