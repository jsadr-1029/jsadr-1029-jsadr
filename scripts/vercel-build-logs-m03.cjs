/**
 * Obtiene los eventos de build de un deploy específico para diagnosticar fallos.
 */
const https = require('https');

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, (res) => {
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
  // 1. Obtener deploy más reciente
  const r = await fetchJSON(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=1`);
  if (r.status !== 200 || !r.data.deployments?.length) {
    console.error('No se pudo obtener el deploy:', r.status, r.data);
    process.exit(1);
  }
  const deploy = r.data.deployments[0];
  console.log(`Deploy: ${deploy.uid}  estado=${deploy.readyState}  sha=${deploy.meta?.githubCommitSha?.slice(0,8)}`);
  console.log(`URL: https://${deploy.url}`);
  console.log('');

  // 2. Obtener eventos de build
  const r2 = await fetchJSON(`https://api.vercel.com/v6/deployments/${deploy.uid}/events?limit=500&types=stderr,stdout,command,error,warning`);
  if (r2.status !== 200) {
    console.error('No se pudo obtener eventos:', r2.status, r2.data);
    process.exit(1);
  }

  // Filtrar solo eventos con error o warning
  const events = r2.data || [];
  console.log(`Total eventos: ${events.length}\n`);

  // Mostrar últimos 50 eventos
  console.log('--- Últimos 50 eventos ---');
  events.slice(-50).forEach(ev => {
    const text = (ev.text || '').slice(0, 200);
    console.log(`[${ev.created}] ${ev.type}: ${text}`);
  });

  // Buscar errores
  console.log('\n--- Errores/Warnings ---');
  const errores = events.filter(ev => /error|warn|fail|invalid|cannot|expected/i.test(ev.type) || /error|warn|fail|invalid|cannot|expected/i.test(ev.text || ''));
  errores.slice(-30).forEach(ev => {
    console.log(`[${ev.created}] ${ev.type}: ${(ev.text || '').slice(0, 300)}`);
  });
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
