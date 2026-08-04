const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const DPL_ID = process.argv[2];

(async () => {
  const r = await fetch(`https://api.vercel.com/v2/deployments/${DPL_ID}/events?limit=200`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const events = await r.json();
  console.log(`HTTP ${r.status} | eventos: ${events.length || 'N/A'}\n`);
  if (Array.isArray(events)) {
    events.forEach((e, i) => {
      const t = new Date(e.created).toISOString().slice(11,19);
      const txt = (e.text || e.message || JSON.stringify(e.payload || {})).slice(0, 300);
      console.log(`[${i.toString().padStart(3)}] [${e.type || '-'}] ${t} ${txt}`);
    });
  }
})();
