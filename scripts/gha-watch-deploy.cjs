#!/usr/bin/env node
/**
 * Monitorea el último workflow run de "Deploy to Vercel" en GitHub Actions.
 * Sin auth (lectura pública del repo) — polling cada 15s hasta completion.
 */
const https = require('node:https');

const OWNER = 'jsadr-1029';
const REPO  = 'jsadr-1029-jsadr';
const WF_NAME = 'Deploy to Vercel';
const POLL_MS = 15_000;
const MAX_MS  = 10 * 60_000;

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/${path}`,
      method: 'GET',
      headers: {
        'User-Agent': 'qa-watch-script',
        'Accept': 'application/vnd.github+json',
      },
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function getLatestRun() {
  const data = await fetchJSON('actions/runs?per_page=5');
  const runs = data.workflow_runs || [];
  // Buscar el más reciente del WF "Deploy to Vercel"
  const wfRuns = runs.filter(r => r.name === WF_NAME);
  return wfRuns[0] || null;
}

async function getJobs(runId) {
  const data = await fetchJSON(`actions/runs/${runId}/jobs`);
  return data.jobs || [];
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

async function main() {
  console.log(`Monitoreando último run de "${WF_NAME}" en ${OWNER}/${REPO}...`);
  console.log(`(sin auth — solo lectura pública)\n`);

  const t0 = Date.now();
  let lastRunId = null;
  let lastStatus = null;

  while (Date.now() - t0 < MAX_MS) {
    try {
      const run = await getLatestRun();
      if (!run) {
        console.log(`[${new Date().toISOString()}] No se encontró run del WF aún...`);
      } else {
        if (run.id !== lastRunId) {
          console.log(`\n═══ Run #${run.run_number} (id=${run.id}) ═══`);
          console.log(`  Estado:     ${run.status} / ${run.conclusion || '(en progreso)'}`);
          console.log(`  Event:      ${run.event}`);
          console.log(`  Branch:     ${run.head_branch}`);
          console.log(`  SHA:        ${run.head_sha?.slice(0, 7)}`);
          console.log(`  Commit:     ${(run.head_commit?.message || '').split('\n')[0]}`);
          console.log(`  Created:    ${fmtTime(run.created_at)}`);
          console.log(`  Updated:    ${fmtTime(run.updated_at)}`);
          console.log(`  HTML URL:   ${run.html_url}`);
          lastRunId = run.id;
          lastStatus = run.status;
        } else if (run.status !== lastStatus) {
          console.log(`[${new Date().toISOString()}] Estado cambió: ${lastStatus} → ${run.status} / ${run.conclusion || ''}`);
          lastStatus = run.status;
        }

        // Si el run terminó, mostrar jobs y salir
        if (run.status === 'completed') {
          console.log(`\n  → Run completado. Conclusion: ${run.conclusion}`);
          console.log('\n  Jobs:');
          const jobs = await getJobs(run.id);
          for (const j of jobs) {
            console.log(`    • ${j.name}: ${j.status}/${j.conclusion}`);
            for (const s of j.steps || []) {
              const icon = s.conclusion === 'success' ? '✅'
                         : s.conclusion === 'failure' ? '❌'
                         : s.conclusion === 'skipped' ? '⏭ '
                         : '⏳';
              console.log(`        ${icon} ${s.name} (${s.conclusion || s.status})`);
            }
          }
          console.log(`\n🔗 Ver en GitHub: ${run.html_url}`);
          process.exit(run.conclusion === 'success' ? 0 : 1);
        }
      }
    } catch (e) {
      console.log(`[${new Date().toISOString()}] Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  console.log('\n⏱ Timeout alcanzado sin completion.');
  process.exit(2);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
