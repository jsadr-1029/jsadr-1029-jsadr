// Decrypt Vercel env vars one by one to inspect actual values
const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!TOKEN || !PROJECT_ID) {
  console.error('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID');
  process.exit(1);
}

const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}/env`;
const listUrl = TEAM_ID ? `${base}?teamId=${TEAM_ID}` : base;
const decryptedValues = {};

console.log('=== Descifrando env vars de Vercel ===\n');

try {
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!listRes.ok) {
    console.error(`HTTP ${listRes.status}: ${await listRes.text()}`);
    process.exit(1);
  }
  const listData = await listRes.json();

  for (const env of listData.envs || []) {
    // Fetch each env var individually — that endpoint returns the decrypted value
    const detailUrl = `${base}/${env.id}${TEAM_ID ? '?teamId=' + TEAM_ID : ''}`;
    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!detailRes.ok) {
      console.log(`❌ ${env.key}: HTTP ${detailRes.status}`);
      continue;
    }
    const detail = await detailRes.json();
    const val = detail.value || '';
    decryptedValues[env.key] = val;
    // Mask middle for security
    let display;
    if (val.length > 60) {
      display = val.slice(0, 25) + '...' + val.slice(-15) + ` (${val.length} chars)`;
    } else if (val.length > 0) {
      display = val.slice(0, 25) + (val.length > 25 ? '...' : '');
    } else {
      display = '(empty)';
    }
    console.log(`${env.key.padEnd(28)} = ${display}`);
  }

  // Critical check: DATABASE_URL must point to Neon, NOT file:...
  console.log('\n=== Análisis crítico ===\n');
  const dbUrl = decryptedValues.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    console.log('❌ CRÍTICO: DATABASE_URL en Vercel apunta a SQLite local (file:...)');
    console.log('   Vercel no puede leer SQLite local. Login fallará.');
  } else if (dbUrl.startsWith('postgres')) {
    console.log('✅ DATABASE_URL en Vercel apunta a PostgreSQL:', dbUrl.split('@')[1]?.split('/')[0] || '(parse error)');
  } else {
    console.log('⚠️  DATABASE_URL no reconocido:', dbUrl.slice(0, 40));
  }

  const jwtSecret = decryptedValues.JWT_SECRET || '';
  if (jwtSecret === 'change-this-in-production-use-env-var' || jwtSecret.length < 16) {
    console.log('❌ JWT_SECRET en Vercel es inseguro (placeholder o muy corto)');
  } else {
    console.log(`✅ JWT_SECRET en Vercel OK (${jwtSecret.length} chars)`);
  }

  const apiEnc = decryptedValues.API_ENCRYPTION_KEY || '';
  if (apiEnc.length !== 64) {
    console.log(`⚠️  API_ENCRYPTION_KEY en Vercel mide ${apiEnc.length} chars (esperado 64)`);
  } else {
    console.log(`✅ API_ENCRYPTION_KEY en Vercel OK (64 hex chars)`);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
