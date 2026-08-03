// Crea todas las env vars del proyecto en Vercel (production + preview + development)
// Lee los valores desde .env local
const fs = require('fs');
const path = require('path');

const VERCEL_TOKEN = 'process.env.VERCEL_TOKEN || ""';
const PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
const TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';

// Leer .env
const envPath = '/home/z/my-project/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

// Parsear pares key=value (manejo comillas)
const vars = [];
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
  // Quitar comillas
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  vars.push({ key, value });
}

console.log(`Encontradas ${vars.length} variables en .env`);

// Variables que NO se deben subir a Vercel
const SKIP_KEYS = new Set([
  'GITHUB_TOKEN',           // local-only
  'SQLITE_URL_LEGACY',      // local-only
  'NODE_ENV',               // Vercel lo setea automáticamente
  'NEXT_PUBLIC_APP_URL',    // se setea por dominio
]);

// Variables marcadas como NEXT_PUBLIC_ van al cliente (todas las envs)
const PUBLIC_PREFIX = 'NEXT_PUBLIC_';

async function createEnvVar(key, value) {
  const isPublic = key.startsWith(PUBLIC_PREFIX);
  const body = {
    key,
    value,
    type: isPublic ? 'plain' : 'encrypted',
    target: ['production', 'preview', 'development']
  };

  const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  if (res.ok) {
    console.log(`  ✓ ${key} (${body.type})`);
    return true;
  } else {
    console.error(`  ✗ ${key}: ${json.error?.message || JSON.stringify(json)}`);
    return false;
  }
}

(async () => {
  let ok = 0, fail = 0;
  for (const { key, value } of vars) {
    if (SKIP_KEYS.has(key)) {
      console.log(`  ⊘ ${key} (skipped)`);
      continue;
    }
    const success = await createEnvVar(key, value);
    if (success) ok++; else fail++;
  }
  console.log(`\nResumen: ${ok} OK, ${fail} fallidos`);
})();
