// =====================================================
// SINCRONIZACION FINAL — JSADR
// Intenta ejecutar todos los pasos pendientes usando
// los tokens disponibles. Si falta algun token, lo reporta.
// =====================================================
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NEON_API_KEY = process.env.NEON_API_KEY;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'jsadr-1029';
const GITHUB_REPO = process.env.GITHUB_REPO || 'jsadr-1029-jsadr';
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID || 'rapid-darkness-56995142';

console.log('=== ESTADO DE TOKENS ===');
console.log(`VERCEL_TOKEN: ${VERCEL_TOKEN ? '✅ presente (' + VERCEL_TOKEN.length + ' chars)' : '❌ FALTA'}`);
console.log(`GITHUB_TOKEN: ${GITHUB_TOKEN ? '✅ presente (' + GITHUB_TOKEN.length + ' chars)' : '❌ FALTA'}`);
console.log(`NEON_API_KEY: ${NEON_API_KEY ? '✅ presente (' + NEON_API_KEY.length + ' chars)' : '❌ FALTA'}`);
console.log();

const results = { vercel: { ok: false, msg: '' }, github: { ok: false, msg: '' }, neon: { ok: false, msg: '' } };

// === VERCEL ===
async function syncVercel() {
  if (!VERCEL_TOKEN) {
    results.vercel.msg = 'VERCEL_TOKEN faltante. Generar nuevo en vercel.com → Account Settings → Tokens.';
    return;
  }
  try {
    console.log('--- Vercel: agregar dominio custom ---');
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'jsadr.com.co' }),
      }
    );
    const json = await res.json();
    if (res.ok) {
      console.log('✅ Dominio agregado:', json.name);
      results.vercel.ok = true;
      results.vercel.msg = 'Dominio jsadr.com.co agregado al proyecto Vercel.';
    } else if (json.error?.code === 'domain_taken' || json.error?.message?.includes('already')) {
      console.log('ℹ️  Dominio ya estaba agregado:', json.error?.message || 'exists');
      results.vercel.ok = true;
      results.vercel.msg = 'Dominio jsadr.com.co ya existe en el proyecto Vercel.';
    } else {
      console.log(`❌ Error agregando dominio: HTTP ${res.status}`, json);
      results.vercel.msg = `Error Vercel: ${json.error?.message || res.status}`;
    }

    // Listar dominios actuales
    const listRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    const listJson = await listRes.json();
    console.log('\n--- Dominios actuales en Vercel ---');
    for (const d of listJson.domains || []) {
      console.log(`  ${d.name.padEnd(30)} | verified: ${d.verified} | config: ${JSON.stringify(d.config || {})}`);
    }
  } catch (e) {
    results.vercel.msg = 'Error red: ' + e.message;
    console.log('❌', e.message);
  }
}

// === GITHUB ===
async function syncGithub() {
  if (!GITHUB_TOKEN) {
    results.github.msg = 'GITHUB_TOKEN faltante. Generar PAT en github.com/settings/tokens con scopes repo, workflow, admin:repo_hook.';
    return;
  }
  try {
    console.log('\n--- GitHub: verificar acceso al repo ---');
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );
    const json = await res.json();
    if (res.ok) {
      console.log(`✅ Repo accesible: ${json.full_name} (private: ${json.private})`);
      results.github.ok = true;
      results.github.msg = `Repo ${json.full_name} accesible.`;
      
      // Crear/actualizar webhook hacia el nuevo dominio
      const webhookUrl = 'https://jsadr.com.co/api/seguridad/plataformas-sync/webhook';
      const whSecret = process.env.GITHUB_WEBHOOK_SECRET;
      console.log(`\n--- GitHub: crear webhook hacia ${webhookUrl} ---`);
      // List existing webhooks
      const whListRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
      );
      const whList = await whListRes.json();
      const existing = whList.find(h => h.config?.url === webhookUrl);
      if (existing) {
        console.log(`ℹ️  Webhook ya existe (id=${existing.id}), actualizando...`);
        const updRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks/${existing.id}`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
            body: JSON.stringify({
              config: { url: webhookUrl, content_type: 'json', secret: whSecret, insecure_ssl: '0' },
              events: ['push', 'pull_request', 'deployment', 'deployment_status', 'release'],
              active: true,
            })
          }
        );
        console.log(`Update webhook: HTTP ${updRes.status}`);
      } else {
        const createRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
            body: JSON.stringify({
              config: { url: webhookUrl, content_type: 'json', secret: whSecret, insecure_ssl: '0' },
              events: ['push', 'pull_request', 'deployment', 'deployment_status', 'release'],
              active: true,
            })
          }
        );
        const createJson = await createRes.json();
        if (createRes.ok) {
          console.log(`✅ Webhook creado (id=${createJson.id})`);
        } else {
          console.log(`❌ Error creando webhook: HTTP ${createRes.status}`, createJson);
        }
      }
    } else {
      console.log(`❌ Error acceso repo: HTTP ${res.status}`, json);
      results.github.msg = `GitHub API ${res.status}: ${json.message}`;
    }
  } catch (e) {
    results.github.msg = 'Error red: ' + e.message;
    console.log('❌', e.message);
  }
}

// === NEON ===
async function syncNeon() {
  if (!NEON_API_KEY) {
    results.neon.msg = 'NEON_API_KEY faltante. Generar en console.neon.tech → Account → API Keys.';
    return;
  }
  try {
    console.log('\n--- Neon: verificar proyecto ---');
    const res = await fetch(
      `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}`,
      { headers: { Authorization: `Bearer ${NEON_API_KEY}` } }
    );
    const json = await res.json();
    if (res.ok) {
      console.log(`✅ Proyecto accesible: ${json.project?.name} (id: ${json.project?.id})`);
      console.log(`   Region: ${json.project?.regionId}`);
      console.log(`   Branch default: ${json.project?.defaultBranchId}`);
      results.neon.ok = true;
      results.neon.msg = `Proyecto Neon ${json.project?.name} accesible.`;
    } else {
      console.log(`❌ Error acceso Neon: HTTP ${res.status}`, json);
      results.neon.msg = `Neon API ${res.status}: ${json.message || json.error?.message}`;
    }
  } catch (e) {
    results.neon.msg = 'Error red: ' + e.message;
    console.log('❌', e.message);
  }
}

(async () => {
  await syncVercel();
  await syncGithub();
  await syncNeon();
  
  console.log('\n=== RESUMEN FINAL ===');
  console.log(`Vercel:  ${results.vercel.ok ? '✅' : '⚠️'} ${results.vercel.msg}`);
  console.log(`GitHub:  ${results.github.ok ? '✅' : '⚠️'} ${results.github.msg}`);
  console.log(`Neon:    ${results.neon.ok ? '✅' : '⚠️'} ${results.neon.msg}`);
})();
