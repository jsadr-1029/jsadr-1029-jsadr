const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

async function get(path) {
  const r = await fetch(`https://api.vercel.com${path}`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

(async () => {
  // /v6/deployments/{id} — detalle del deployment (versión correcta)
  console.log('▶ Deployments recientes (v6):');
  const deps = await get(`/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5`);
  console.log(`   HTTP ${deps.status}`);
  if (deps.status === 200 && deps.body.deployments) {
    for (const d of deps.body.deployments.slice(0, 3)) {
      console.log(`\n   deploy ${d.uid}: state=${d.readyState} | ${d.url} | ${new Date(d.createdAt).toISOString()}`);
      console.log(`     meta: ${JSON.stringify(d.meta || {}).slice(0, 250)}`);
      // Obtener logs de build si el estado es ERROR
      if (d.readyState === 'ERROR') {
        const builds = await get(`/v13/deployments/${d.uid}/builds`);
        if (builds.status === 200 && builds.body) {
          console.log(`     builds: ${JSON.stringify(builds.body).slice(0, 500)}`);
        }
      }
    }
  } else {
    console.log('   body:', JSON.stringify(deps.body).slice(0, 500));
  }
})();
