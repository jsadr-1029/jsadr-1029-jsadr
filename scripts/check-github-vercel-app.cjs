// Check GitHub App installations on the repo (Vercel uses GitHub App ID 19529)
// Also check for any deliveries/events related to push
const { execSync } = require('child_process');

const url = execSync('git config --get remote.origin.url').toString().trim();
const m = url.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/);
const TOKEN = m[2];
const REPO = `${m[3]}/${m[4]}`;

async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jsadr-1029',
    },
  });
  const status = r.status;
  let body;
  try { body = await r.json(); } catch { body = await r.text(); }
  return { status, body };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' GITHUB APP INSTALLATIONS & VERCEL INTEGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. List GitHub App installations on the user's account
  console.log('─── 1) GitHub App installations (/user/installations) ───');
  const inst = await gh('/user/installations?per_page=100');
  console.log(`   HTTP ${inst.status}`);
  if (inst.status === 200) {
    const list = inst.body.installations || [];
    console.log(`   Instalaciones: ${list.length}`);
    for (const i of list) {
      console.log(`   • id=${i.id} | app=${i.app_slug} (app_id=${i.app_id}) | target=${i.target_type}/${i.account?.login}`);
      if (i.app_slug?.toLowerCase().includes('vercel') || i.app_slug?.toLowerCase().includes('now')) {
        console.log(`     ⭐ VERCEL APP INSTALADA`);
      }
    }
    const vercelInstalls = list.filter(i => i.app_slug?.toLowerCase().includes('vercel') || i.app_slug?.toLowerCase().includes('now'));
    console.log(`   → Vercel installations: ${vercelInstalls.length}`);
    if (vercelInstalls.length > 0) {
      for (const v of vercelInstalls) {
        console.log(`     - app_id=${v.app_id} | installation_id=${v.id}`);
        // List repos accessible by this Vercel installation
        const repos = await gh(`/user/installations/${v.id}/repositories?per_page=100`);
        console.log(`       repos accessibles: HTTP ${repos.status}`);
        if (repos.status === 200) {
          const rs = repos.body.repositories || [];
          const ourRepo = rs.find(r => r.full_name === REPO);
          console.log(`       total: ${rs.length} | ¿${REPO} accesible?: ${ourRepo ? 'SÍ' : 'NO'}`);
        }
      }
    }
  } else {
    console.log(`   ❌ ${JSON.stringify(inst.body).slice(0, 300)}`);
  }

  // 2. Check repo's installed apps via /repos/{owner}/{repo}/installation
  console.log(`\n─── 2) App installation on repo ${REPO} ───`);
  const repoInst = await gh(`/repos/${REPO}/installation`);
  console.log(`   HTTP ${repoInst.status}`);
  if (repoInst.status === 200) {
    const i = repoInst.body;
    console.log(`   ✅ App instalada en el repo:`);
    console.log(`     app: ${i.app_slug} (app_id=${i.app_id})`);
    console.log(`     installation_id: ${i.id}`);
    console.log(`     target: ${i.target_type}/${i.account?.login}`);
    if (i.app_slug?.toLowerCase().includes('vercel')) {
      console.log(`   ⭐ ¡Vercel GitHub App está instalada en este repo!`);
    }
  } else {
    console.log(`   ${repoInst.status === 404 ? 'ℹ️  Ninguna GitHub App instalada en este repo' : '❌ ' + JSON.stringify(repoInst.body).slice(0, 200)}`);
  }

  // 3. Check recent push events on repo
  console.log(`\n─── 3) Recent events on ${REPO} ───`);
  const events = await gh(`/repos/${REPO}/events?per_page=10`);
  console.log(`   HTTP ${events.status}`);
  if (events.status === 200) {
    const list = events.body || [];
    console.log(`   Eventos recientes: ${list.length}`);
    for (const e of list.slice(0, 10)) {
      console.log(`   • ${e.type} | ${e.created_at} | actor=${e.actor?.login}`);
    }
  } else {
    console.log(`   ❌ ${JSON.stringify(events.body).slice(0, 200)}`);
  }

  // 4. Check GitHub secrets configured on repo
  console.log(`\n─── 4) GitHub Actions secrets on repo ───`);
  const secrets = await gh(`/repos/${REPO}/actions/secrets`);
  console.log(`   HTTP ${secrets.status}`);
  if (secrets.status === 200) {
    const list = secrets.body.secrets || [];
    console.log(`   Secrets: ${list.length}`);
    for (const s of list) {
      console.log(`   • ${s.name} | updated=${s.updated_at}`);
    }
  } else {
    console.log(`   ${secrets.status === 404 ? 'ℹ️  GitHub Actions no habilitado o sin acceso' : '❌ ' + JSON.stringify(secrets.body).slice(0, 200)}`);
  }
})().catch(e => { console.error('ERR:', e); process.exit(1); });
