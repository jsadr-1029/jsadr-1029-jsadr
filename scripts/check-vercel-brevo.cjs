// Check Vercel BREVO_SMTP_KEY env var value
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
const getToken = (key) => {
  const m = envContent.match(new RegExp('^' + key + '=(.+)$', 'm'));
  return m ? m[1].replace(/^"|"$/g, '').trim() : null;
};

const TOKEN = getToken('VERCEL_TOKEN');
const PROJECT_ID = getToken('VERCEL_PROJECT_ID');
const TEAM_ID = getToken('VERCEL_TEAM_ID');

console.log('TOKEN:', TOKEN ? TOKEN.slice(0, 20) + '...' : 'NULL');
console.log('PROJECT_ID:', PROJECT_ID);
console.log('TEAM_ID:', TEAM_ID);

(async () => {
  try {
    const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}/env`;
    const listUrl = TEAM_ID ? `${base}?teamId=${TEAM_ID}` : base;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
    console.log('List HTTP:', listRes.status);
    const listData = await listRes.json();
    console.log('Total envs:', (listData.envs || []).length);
    
    for (const env of listData.envs || []) {
      if (env.key !== 'BREVO_SMTP_KEY' && env.key !== 'API_ENCRYPTION_KEY') continue;
      const r = await fetch(`${base}/${env.id}${TEAM_ID ? '?teamId=' + TEAM_ID : ''}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const d = await r.json();
      const v = d.value || '';
      console.log(`${env.key} = ${v.length > 80 ? v.slice(0, 40) + '...' + v.slice(-20) + ' [' + v.length + ' chars]' : v}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
