// Diagnóstico: obtener variables de entorno del proyecto en Vercel
import 'dotenv/config';

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!TOKEN || !PROJECT_ID) {
  console.error('Faltan VERCEL_TOKEN o VERCEL_PROJECT_ID en .env');
  process.exit(1);
}

const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}/env`;
const url = TEAM_ID ? `${base}?teamId=${TEAM_ID}` : base;

console.log('=== Consultando env vars de Vercel ===');
console.log('URL:', url.replace(TOKEN, '***'));

try {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  console.log(`\nTotal env vars en Vercel: ${data.envs?.length || 0}\n`);
  console.log('Variable               | Target         | Type    | Value (parcial)');
  console.log('-----------------------|----------------|---------|-------------------');
  for (const env of data.envs || []) {
    const val = env.value || '(encrypted)';
    const partial = val.length > 30 ? val.slice(0, 30) + '...' : val;
    const targets = (env.target || []).join(',');
    console.log(
      `${env.key.padEnd(22)} | ${targets.padEnd(14)} | ${env.type.padEnd(7)} | ${partial}`,
    );
  }

  // Check específicamente las críticas para login
  const criticals = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'API_ENCRYPTION_KEY',
    'BREVO_SMTP_KEY',
    'NEXT_PUBLIC_APP_URL',
  ];
  console.log('\n=== Análisis de variables críticas para login ===\n');
  for (const key of criticals) {
    const found = (data.envs || []).find((e) => e.key === key);
    if (!found) {
      console.log(`❌ ${key}: NO ESTÁ EN VERCEL`);
    } else {
      const val = found.value || '';
      const isUrl = val.startsWith('file:') || val.startsWith('postgres');
      console.log(
        `✅ ${key}: presente (target=${(found.target || []).join(',')}, value=${val.slice(0, 50)}${val.length > 50 ? '...' : ''})`,
      );
      if (key === 'DATABASE_URL' && val.startsWith('file:')) {
        console.log(`   ⚠️  DATABASE_URL apunta a SQLite local, NO a Neon — esto romperá login en Vercel`);
      }
    }
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
