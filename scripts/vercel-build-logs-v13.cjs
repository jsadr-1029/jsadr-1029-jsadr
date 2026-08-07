/**
 * Obtiene los logs de build de un deploy específico usando v13 API.
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
  const r = await fetchJSON(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=1`);
  if (r.status !== 200 || !r.data.deployments?.length) {
    console.error('No se pudo obtener el deploy:', r.status, r.data);
    process.exit(1);
  }
  const deploy = r.data.deployments[0];
  console.log(`Deploy: ${deploy.uid}  estado=${deploy.readyState}  sha=${deploy.meta?.githubCommitSha?.slice(0,8)}`);
  console.log(`URL: https://${deploy.url}\n`);

  // Probar v13
  const r2 = await fetchJSON(`https://api.vercel.com/v13/deployments/${deploy.uid}/events?limit=500`);
  if (r2.status !== 200) {
    console.error('v13 falló:', r2.status, r2.data);
    // Probar sin types
    const r3 = await fetchJSON(`https://api.vercel.com/v13/deployments/${deploy.uid}/events`);
    if (r3.status === 200) {
      console.log('Eventos obtenidos (sin limit):');
      const events = r3.data || [];
      console.log(`Total: ${events.length}\n`);
      events.slice(-60).forEach(ev => {
        const text = (ev.text || '').slice(0, 250);
        console.log(`[${ev.created}] ${ev.type}: ${text}`);
      });
    }
    return;
  }

  const events = r2.data || [];
  console.log(`Total eventos: ${events.length}\n`);

  // Filtrar los que contengan 'error', 'fail', 'exception'
  const errors = events.filter(ev => {
    const text = (ev.text || '').toLowerCase();
    return text.includes('error') || text.includes('fail') || text.includes('exception') ||
           ev.type === 'error' || ev.type === 'stderr';
  });
  console.log(`--- Eventos con error/fail (${errors.length}) ---`);
  errors.slice(-30).forEach(ev => {
    const text = (ev.text || '').slice(0, 400);
    console.log(`[${ev.created}] ${ev.type}: ${text}`);
  });

  console.log('\n--- Últimos 30 eventos ---');
  events.slice(-30).forEach(ev => {
    const text = (ev.text || '').slice(0, 250);
    console.log(`[${ev.created}] ${ev.type}: ${text}`);
  });
}

main().catch(e => { console.error(e); process.exit(2); });
