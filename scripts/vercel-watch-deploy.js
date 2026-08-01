// Monitorea el estado de un deploy hasta que esté READY o falle
const VERCEL_TOKEN = 'process.env.VERCEL_TOKEN || ""';
const TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';
const DEPLOY_ID = process.argv[2];

if (!DEPLOY_ID) {
  console.error('Usage: node vercel-watch-deploy.js <deployId>');
  process.exit(1);
}

(async () => {
  let lastStatus = '';
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`https://api.vercel.com/v13/deployments/${DEPLOY_ID}?teamId=${TEAM_ID}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    });
    const json = await res.json();
    const state = json.readyState;
    const substate = json.readySubstate || '';
    const status = `${state} ${substate}`.trim();

    if (status !== lastStatus) {
      const ts = new Date().toISOString().slice(11, 19);
      console.log(`[${ts}] ${status}`);
      lastStatus = status;
    }

    if (state === 'READY') {
      console.log('\n✓ Deploy READY!');
      console.log('URL:', json.url);
      console.log('Alias:', (json.alias || []).join(', '));
      process.exit(0);
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      console.error('\n✗ Deploy failed:', state);
      console.error('Error:', json.errorMessage);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.error('Timeout esperando deploy');
  process.exit(1);
})();
