const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const DPL_ID = process.argv[2];

async function get(path) {
  const r = await fetch(`https://api.vercel.com${path}`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  return { status: r.status, body: await r.text() };
}

(async () => {
  if (!DPL_ID) { console.error('uso: node script.js <deployment-id>'); process.exit(1); }
  
  // /v2/deployments/{id}/events — eventos de build
  console.log(`▶ Eventos de build para ${DPL_ID}:\n`);
  const r = await get(`/v2/deployments/${DPL_ID}/events?builds=1&limit=200`);
  console.log(`HTTP ${r.status}`);
  if (r.status === 200) {
    try {
      const events = JSON.parse(r.body);
      if (Array.isArray(events)) {
        // Mostrar solo errores y warnings
        const errors = events.filter(e => 
          e.type === 'stderr' || e.type === 'error' || e.type === 'warning' ||
          (e.text && /error|fail|cannot|undefined/i.test(e.text))
        );
        console.log(`Total eventos: ${events.length} | errores/warnings: ${errors.length}\n`);
        errors.slice(-30).forEach(e => {
          console.log(`[${e.type || '-'}] ${new Date(e.created).toISOString().slice(11,19)} ${e.text?.slice(0, 250)}`);
        });
      }
    } catch (e) {
      console.log('parse error:', e.message);
      console.log('body:', r.body.slice(0, 500));
    }
  } else {
    console.log('body:', r.body.slice(0, 500));
  }
})();
