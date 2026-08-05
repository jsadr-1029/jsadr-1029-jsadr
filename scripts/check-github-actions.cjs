// Check if GitHub Actions is enabled on the repo, and enable if not.
const { execSync } = require('child_process');

const url = execSync('git config --get remote.origin.url').toString().trim();
const m = url.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/);
const TOKEN = m[2];
const REPO = `${m[3]}/${m[4]}`;

async function gh(method, path, body) {
  const data = body ? JSON.stringify(body) : null;
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jsadr-1029',
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data,
  });
  const status = r.status;
  let respBody;
  try { respBody = await r.json(); } catch { respBody = await r.text(); }
  return { status, body: respBody };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' GitHub Actions status check & enable');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check Actions permissions for the repo
  console.log('─── 1) Actions permissions ───');
  const perm = await gh('GET', `/repos/${REPO}/actions/permissions`);
  console.log(`   HTTP ${perm.status}`);
  if (perm.status === 200) {
    console.log(`   enabled: ${perm.body.enabled}`);
    console.log(`   allowed_actions: ${perm.body.allowed_actions}`);
    if (!perm.body.enabled) {
      console.log('   ⚠️  Actions deshabilitado — habilitando...');
      const en = await gh('PUT', `/repos/${REPO}/actions/permissions`, {
        enabled: true,
        allowed_actions: 'all',
      });
      console.log(`   Enable HTTP ${en.status}`);
    } else {
      console.log('   ✅ Actions habilitado');
    }
  } else {
    console.log(`   ❌ ${JSON.stringify(perm.body).slice(0, 300)}`);
  }

  // 2. List workflows (will be empty until we push the workflow file)
  console.log('\n─── 2) Existing workflows ───');
  const wf = await gh('GET', `/repos/${REPO}/actions/workflows?per_page=30`);
  console.log(`   HTTP ${wf.status}`);
  if (wf.status === 200) {
    const list = wf.body.workflows || [];
    console.log(`   Workflows: ${list.length}`);
    for (const w of list) {
      console.log(`   • id=${w.id} | name="${w.name}" | state=${w.state} | path=${w.path}`);
    }
  } else {
    console.log(`   ❌ ${JSON.stringify(wf.body).slice(0, 200)}`);
  }

  // 3. List recent workflow runs
  console.log('\n─── 3) Recent workflow runs ───');
  const runs = await gh('GET', `/repos/${REPO}/actions/runs?per_page=5`);
  console.log(`   HTTP ${runs.status}`);
  if (runs.status === 200) {
    const list = runs.body.workflow_runs || [];
    console.log(`   Runs: ${list.length}`);
    for (const r of list) {
      console.log(`   • id=${r.id} | name="${r.name}" | conclusion=${r.conclusion} | created=${r.created_at}`);
    }
  } else {
    console.log(`   ❌ ${JSON.stringify(runs.body).slice(0, 200)}`);
  }
})().catch(e => { console.error('ERR:', e); process.exit(1); });
