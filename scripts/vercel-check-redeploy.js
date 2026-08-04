const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

(async () => {
  const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=3`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const d = await r.json();
  console.log(`HTTP ${r.status}\n`);
  if (d.deployments) {
    for (const dep of d.deployments) {
      console.log(`▶ ${dep.uid}`);
      console.log(`  state: ${dep.readyState}`);
      console.log(`  url: ${dep.url}`);
      console.log(`  created: ${new Date(dep.createdAt).toISOString()}`);
      console.log(`  commit: ${dep.meta?.githubCommitMessage?.split('\n')[0] || '-'}`);
      console.log(`  sha: ${dep.meta?.githubCommitSha?.slice(0,8) || '-'}`);
      console.log('');
    }
    
    // Si el más reciente está BUILDING, esperar y re-checkear
    const latest = d.deployments[0];
    if (latest.readyState === 'BUILDING' || latest.readyState === 'INITIALIZING' || latest.readyState === 'QUEUED') {
      console.log(`\n⏳ Deploy en progreso (${latest.readyState}). Esperando 60s más...`);
      await new Promise(r => setTimeout(r, 60000));
      
      const r2 = await fetch(`https://api.vercel.com/v13/deployments/${latest.uid}`, {
        headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
      });
      const d2 = await r2.json();
      console.log(`Estado final: ${d2.readyState}`);
      console.log(`URL: ${d2.url}`);
    }
  }
})();
