// Get full ALLOWED_ORIGINS value to inspect exact format
const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}/env`;
const listUrl = TEAM_ID ? `${base}?teamId=${TEAM_ID}` : base;

const listRes = await fetch(listUrl, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const listData = await listRes.json();

const target = (listData.envs || []).find((e) => e.key === 'ALLOWED_ORIGINS');
if (!target) {
  console.log('ALLOWED_ORIGINS not found');
  process.exit(1);
}

const detailRes = await fetch(`${base}/${target.id}${TEAM_ID ? '?teamId=' + TEAM_ID : ''}`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const detail = await detailRes.json();

console.log('Full ALLOWED_ORIGINS value:');
console.log(JSON.stringify(detail.value, null, 2));
console.log('\nLength:', detail.value.length);
console.log('\nSplit by comma:');
for (const part of detail.value.split(',')) {
  console.log(`  - "${part.trim()}"`);
}

// Also fetch all other envs for completeness
console.log('\n=== Full env dump (decrypted) ===');
for (const env of listData.envs || []) {
  if (env.key === 'ALLOWED_ORIGINS') continue;
  const r = await fetch(`${base}/${env.id}${TEAM_ID ? '?teamId=' + TEAM_ID : ''}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d = await r.json();
  const v = d.value || '';
  let display;
  if (v.length > 80) {
    display = v.slice(0, 40) + '...' + v.slice(-20) + ` [${v.length} chars]`;
  } else {
    display = v;
  }
  console.log(`${env.key.padEnd(28)} = ${display}`);
}
