/**
 * watch-deploy.cjs — monitorea el deploy de Vercel para el último commit push.
 * Verifica cada 20s:
 *  - Estado del check-run "Build & Deploy to Vercel (production)" en GitHub
 *  - Estado del commit status "Vercel" en GitHub
 *  - Header x-vercel-id de jsadr.com.co para confirmar deployment en producción
 */
const { execSync } = require('child_process');
const fs = require('fs');

const GH_TOKEN = fs.readFileSync('/tmp/ghtoken.txt', 'utf8').trim();
const OWNER = 'jsadr-1029';
const REPO = 'jsadr-1029-jsadr';
const HEAD = execSync('git -C /home/z/my-project rev-parse HEAD', { encoding: 'utf8' }).trim();

console.log(`Monitoreando deploy de commit ${HEAD.substring(0,7)}...\n`);

const startedAt = Date.now();
const MAX_WAIT_MS = 8 * 60 * 1000; // 8 minutos máximo

async function ghFetch(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`GH ${path} HTTP ${r.status}`);
  return r.json();
}

async function checkOnce() {
  const result = { ts: new Date().toISOString() };
  // 1. GitHub Actions check-runs
  try {
    const cr = await ghFetch(`/repos/${OWNER}/${REPO}/commits/${HEAD}/check-runs`);
    result.checkRuns = cr.check_runs || [];
  } catch (e) { result.checkRunsErr = e.message; }
  // 2. Combined status
  try {
    const st = await ghFetch(`/repos/${OWNER}/${REPO}/commits/${HEAD}/status`);
    result.combinedState = st.state;
    result.statuses = st.statuses || [];
  } catch (e) { result.combinedErr = e.message; }
  // 3. curl jsadr.com.co
  try {
    const r = await fetch('https://jsadr.com.co', { method: 'HEAD' });
    result.prodStatus = r.status;
    result.vercelId = r.headers.get('x-vercel-id');
    result.vercelCache = r.headers.get('x-vercel-cache');
    result.age = r.headers.get('age');
    result.date = r.headers.get('date');
  } catch (e) { result.prodErr = e.message; }
  return result;
}

function summarize(r) {
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const lines = [];
  lines.push(`[${elapsed}s] ${r.ts}`);
  for (const cr of r.checkRuns || []) {
    lines.push(`  GH-Action "${cr.name}": ${cr.status}/${cr.conclusion||'-'} (started=${cr.started_at})`);
  }
  if (r.combinedState) {
    lines.push(`  Combined commit status: ${r.combinedState}`);
    for (const s of r.statuses || []) {
      lines.push(`    "${s.context}": ${s.state} — ${s.description||''}`);
    }
  }
  if (r.prodStatus) {
    lines.push(`  jsadr.com.co: HTTP ${r.prodStatus} x-vercel-id=${r.vercelId} cache=${r.vercelCache} age=${r.age}`);
  }
  return lines.join('\n');
}

(async () => {
  let deployConcluded = false;
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    try {
      const r = await checkOnce();
      console.log(summarize(r));
      // Condición de éxito: GH-Action conclusion=success Y combined status=success
      const actionDone = (r.checkRuns||[]).some(cr => cr.status === 'completed');
      const actionSuccess = (r.checkRuns||[]).some(cr => cr.conclusion === 'success');
      const actionFail = (r.checkRuns||[]).some(cr => cr.conclusion && cr.conclusion !== 'success');
      const combinedSuccess = r.combinedState === 'success';
      const combinedPending = r.combinedState === 'pending';

      if (actionSuccess && combinedSuccess) {
        console.log('\n✅ DEPLOY COMPLETADO CON ÉXITO');
        deployConcluded = true;
        break;
      }
      if (actionFail) {
        console.log('\n❌ DEPLOY FALLIDO — ver logs en GitHub Actions');
        deployConcluded = true;
        break;
      }
    } catch (e) {
      console.log(`Error al verificar: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 20000));
  }
  if (!deployConcluded) {
    console.log('\n⏱ Timeout — el deploy sigue en progreso, revisa más tarde');
  }
})();
