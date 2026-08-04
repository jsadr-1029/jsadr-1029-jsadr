// Verifica token de Vercel, obtiene user/team, project info, deployments
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error('ERROR: Faltan VERCEL_TOKEN o VERCEL_PROJECT_ID en env');
  process.exit(1);
}

async function vercelGet(path) {
  const url = `https://api.vercel.com${path}`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const status = r.status;
  let body;
  try { body = await r.json(); } catch { body = await r.text(); }
  return { status, body };
}

(async () => {
  console.log('=== VERIFICACIÓN TOKEN VERCEL ===\n');

  // 1. /v2/user — info del usuario autenticado
  console.log('▶ 1) GET /v2/user');
  const user = await vercelGet('/v2/user');
  console.log(`   HTTP ${user.status}`);
  if (user.status === 200) {
    const u = user.body.user || user.body;
    console.log(`   uid: ${u.uid}`);
    console.log(`   email: ${u.email}`);
    console.log(`   name: ${u.name || '-'}`);
    console.log(`   username: ${u.username || '-'}`);
    console.log(`   platformVersion: ${u.platformVersion || '-'}`);
  } else {
    console.log('   BODY:', JSON.stringify(user.body).slice(0, 300));
  }

  // 2. /v2/teams — lista de teams del usuario
  console.log('\n▶ 2) GET /v2/teams');
  const teams = await vercelGet('/v2/teams?limit=100');
  console.log(`   HTTP ${teams.status}`);
  if (teams.status === 200) {
    const list = teams.body.teams || [];
    console.log(`   Teams encontrados: ${list.length}`);
    list.forEach(t => {
      console.log(`   • id=${t.id} | slug=${t.slug} | name=${t.name}`);
    });
  } else {
    console.log('   BODY:', JSON.stringify(teams.body).slice(0, 300));
  }

  // 3. /v9/projects/{projectId} — info del proyecto
  console.log(`\n▶ 3) GET /v9/projects/${VERCEL_PROJECT_ID}`);
  const proj = await vercelGet(`/v9/projects/${VERCEL_PROJECT_ID}`);
  console.log(`   HTTP ${proj.status}`);
  if (proj.status === 200) {
    const p = proj.body;
    console.log(`   id: ${p.id}`);
    console.log(`   name: ${p.name}`);
    console.log(`   accountId: ${p.accountId}`);
    console.log(`   framework: ${p.framework}`);
    console.log(`   nodeVersion: ${p.nodeVersion}`);
    console.log(`   targets: ${JSON.stringify(Object.keys(p.targets || {}))}`);
    if (p.targets) {
      for (const [env, t] of Object.entries(p.targets)) {
        console.log(`     ${env}: url=${t.url} | readyState=${t.readyState} | createdAt=${t.createdAt}`);
      }
    }
    console.log(`   latestDeployments: ${p.latestDeployments?.length || 0}`);
    if (p.latestDeployments?.[0]) {
      const d = p.latestDeployments[0];
      console.log(`     último deploy:`);
      console.log(`       uid: ${d.uid}`);
      console.log(`       url: ${d.url}`);
      console.log(`       state: ${d.readyState}`);
      console.log(`       created: ${d.createdAt}`);
      console.log(`       meta: ${JSON.stringify(d.meta || {}).slice(0, 200)}`);
    }
  } else {
    console.log('   BODY:', JSON.stringify(proj.body).slice(0, 500));
  }

  // 4. /v13/deployments — listar deployments recientes
  console.log(`\n▶ 4) GET /v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`);
  const deps = await vercelGet(`/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`);
  console.log(`   HTTP ${deps.status}`);
  if (deps.status === 200) {
    const ds = deps.body.deployments || [];
    console.log(`   Deployments: ${ds.length}`);
    ds.forEach((d, i) => {
      console.log(`   ${i + 1}. uid=${d.uid} | state=${d.readyState} | ${d.url} | ${new Date(d.createdAt).toISOString()}`);
    });
  } else {
    console.log('   BODY:', JSON.stringify(deps.body).slice(0, 300));
  }

  // 5. /v9/projects/{id}/domains — dominios
  console.log(`\n▶ 5) GET /v9/projects/${VERCEL_PROJECT_ID}/domains`);
  const doms = await vercelGet(`/v9/projects/${VERCEL_PROJECT_ID}/domains`);
  console.log(`   HTTP ${doms.status}`);
  if (doms.status === 200) {
    const dl = doms.body || [];
    console.log(`   Dominios: ${Array.isArray(dl) ? dl.length : 'N/A'}`);
    if (Array.isArray(dl)) {
      dl.forEach(d => {
        console.log(`   • ${d.name} | verified=${d.verified} | primary=${d.primary}`);
      });
    }
  } else {
    console.log('   BODY:', JSON.stringify(doms.body).slice(0, 300));
  }

  // 6. /v9/projects/{id}/env — variables de entorno
  console.log(`\n▶ 6) GET /v9/projects/${VERCEL_PROJECT_ID}/env`);
  const envs = await vercelGet(`/v9/projects/${VERCEL_PROJECT_ID}/env`);
  console.log(`   HTTP ${envs.status}`);
  if (envs.status === 200) {
    const el = envs.body.envs || [];
    console.log(`   Variables: ${el.length}`);
    el.forEach(e => {
      const val = e.value ? `[SET ${e.value.length} chars]` : '[empty]';
      console.log(`   • ${e.key}=${val} | target=${JSON.stringify(e.target)} | type=${e.type}`);
    });
  } else {
    console.log('   BODY:', JSON.stringify(envs.body).slice(0, 300));
  }

  console.log('\n=== FIN ===');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
