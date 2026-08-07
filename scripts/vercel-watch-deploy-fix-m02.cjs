/**
 * Monitorea el deploy de Vercel hasta que termine (READY o ERROR).
 * Imprime estado cada 10s. Termina con código 0 si READY, 1 si ERROR.
 */
const https = require('https');

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}`, ...headers } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: body }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 1. Obtener el deploy más reciente del proyecto
  const deploymentsURL = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=3&sort=createdAt&order=desc`;
  console.log('Buscando deploy más reciente...');
  let attempts = 0;
  let latestDeploy = null;

  // Esperar a que aparezca un nuevo deploy (el push fue justo ahora)
  while (attempts < 6) {
    const r = await fetchJSON(deploymentsURL);
    if (r.status === 200 && Array.isArray(r.data.deployments) && r.data.deployments.length > 0) {
      latestDeploy = r.data.deployments[0];
      console.log(`Deploy encontrado: ${latestDeploy.uid}  estado=${latestDeploy.readyState}  createdAt=${latestDeploy.createdAt}  meta=${JSON.stringify(latestDeploy.meta?.githubCommitMessage || '').slice(0, 80)}`);
      break;
    }
    console.log(`  attempt ${attempts+1}: status=${r.status}, reintentando en 5s...`);
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
  }

  if (!latestDeploy) {
    console.error('No se encontró ningún deploy. Abortando.');
    process.exit(1);
  }

  const deployId = latestDeploy.uid;
  console.log(`\nMonitoreando deploy ${deployId}...`);

  // 2. Polling del estado cada 10s
  let state = latestDeploy.readyState;
  const startTime = Date.now();
  while (state === 'BUILDING' || state === 'INITIALIZING' || state === 'QUEUED') {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[${elapsed}s] estado=${state}`);
    await new Promise(r => setTimeout(r, 10000));
    const r2 = await fetchJSON(`https://api.vercel.com/v13/deployments/${deployId}`);
    if (r2.status === 200) {
      state = r2.data.readyState;
    } else {
      console.log(`  (no se pudo obtener estado: HTTP ${r2.status})`);
    }
  }

  const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n=== DEPLOY FINALIZADO en ${totalElapsed}s ===`);
  console.log(`Estado final: ${state}`);

  if (state === 'READY') {
    console.log(`✅ Deploy exitoso. URL: https://${latestDeploy.url}`);
    process.exit(0);
  } else {
    console.log(`❌ Deploy falló o estado inesperado: ${state}`);
    // Intentar obtener logs de build
    const r3 = await fetchJSON(`https://api.vercel.com/v13/deployments/${deployId}/events?limit=20`);
    if (r3.status === 200 && Array.isArray(r3.data)) {
      console.log('\n--- Últimos eventos de build ---');
      r3.data.slice(-20).forEach(ev => {
        console.log(`  [${ev.created}] ${ev.type}: ${(ev.text || '').slice(0, 150)}`);
      });
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
