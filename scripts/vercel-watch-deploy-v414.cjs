// scripts/vercel-watch-deploy-v414.cjs
// Monitorea el deploy más reciente en Vercel hasta que esté READY.
require('dotenv').config({ path: '.env' });
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
if (!VERCEL_TOKEN) {
  console.error('ERROR: VERCEL_TOKEN no definido en .env');
  process.exit(1);
}

const PROJECT_ID = 'prj_YOUR_PROJECT_ID'; // Lo obtenemos de la API

async function getProjectId() {
  // Buscar el project ID en el .vercel/project.json si existe
  const fs = require('fs');
  try {
    const pj = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
    return pj.projectId;
  } catch {
    return null;
  }
}

async function main() {
  const projectId = await getProjectId();
  if (!projectId) {
    console.log('No se encontró .vercel/project.json — listando proyectos...');
    const res = await fetch('https://api.vercel.com/v9/projects', {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    const data = await res.json();
    if (data.projects && data.projects.length > 0) {
      const p = data.projects[0];
      console.log(`Usando proyecto: ${p.name} (${p.id})`);
      await watchDeploys(p.id);
    } else {
      console.error('No se encontraron proyectos.');
      process.exit(1);
    }
  } else {
    await watchDeploys(projectId);
  }
}

async function watchDeploys(projectId) {
  console.log(`\nMonitorizando deploys del proyecto ${projectId}...`);
  const startTime = Date.now();
  const MAX_WAIT_MS = 8 * 60 * 1000; // 8 min máximo
  let lastStatus = '';

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
      );
      const data = await res.json();
      const deploy = data.deployments?.[0];

      if (!deploy) {
        console.log('  No hay deploys aún, esperando...');
        await sleep(5000);
        continue;
      }

      const status = deploy.readyState;
      const createdAt = new Date(deploy.createdAt);
      const ageSec = Math.floor((Date.now() - createdAt.getTime()) / 1000);

      // Solo monitorear si el deploy fue creado después del push (ultimos 5 min)
      if (ageSec > 300 && status === 'READY') {
        console.log(`  Último deploy READY pero es antiguo (${ageSec}s ago), esperando nuevo...`);
        await sleep(5000);
        continue;
      }

      if (status !== lastStatus) {
        console.log(`  [${new Date().toISOString()}] Deploy ${deploy.uid.slice(0, 12)} → ${status} (commit: ${deploy.meta?.githubCommitMessage?.slice(0, 60) || 'N/A'})`);
        lastStatus = status;
      }

      if (status === 'READY') {
        console.log(`\n✅ DEPLOY READY en ${Math.floor((Date.now() - startTime) / 1000)}s`);
        console.log(`   URL: ${deploy.url}`);
        console.log(`   ID: ${deploy.uid}`);
        process.exit(0);
      }
      if (status === 'ERROR') {
        console.log(`\n❌ DEPLOY ERROR`);
        process.exit(1);
      }
    } catch (e) {
      console.error('Error consultando Vercel:', e.message);
    }
    await sleep(5000);
  }
  console.log('\n⏰ Timeout esperando deploy');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main();
