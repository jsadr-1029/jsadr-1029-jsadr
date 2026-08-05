// =====================================================
// CHECK VERCEL-GITHUB INTEGRATION STATUS
// 1. Decrypt Vercel token from Neon PlataformaSync
// 2. Test token against Vercel API
// 3. Get GitHub token from git remote
// 4. List GitHub webhooks on repo
// 5. Check Vercel project's gitSource (linked GitHub repo)
// 6. Report integration status
// =====================================================

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// IMPORTANT: require PrismaClient FIRST (it loads .env), THEN override DATABASE_URL
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

// Load .env for API_ENCRYPTION_KEY (but DO NOT override DATABASE_URL — we set Neon above)
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    if (m[1] === 'DATABASE_URL') continue; // keep Neon
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

// --- Decryption (mirrors src/lib/security.ts) ---
const ALGORITHM = 'aes-256-cbc';
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}
function decryptSensitive(encryptedText) {
  const key = getEncryptionKey();
  if (!key) return encryptedText; // no key, return as-is
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText;
  }
}

// --- Get GitHub token from git remote URL ---
function getGithubToken() {
  try {
    const url = execSync('git config --get remote.origin.url').toString().trim();
    const m = url.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/);
    if (m) {
      return {
        user: m[1],
        token: m[2],
        repo: `${m[3]}/${m[4]}`,
      };
    }
  } catch (e) {
    console.error('No se pudo leer el git remote:', e.message);
  }
  return null;
}

async function vercelGet(path, token) {
  const r = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = r.status;
  let body;
  try { body = await r.json(); } catch { body = await r.text(); }
  return { status, body };
}

async function githubGet(path, token) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jsadr-1029',
    },
  });
  const status = r.status;
  let body;
  try { body = await r.json(); } catch { body = await r.text(); }
  return { status, body };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' VERCEL ↔ GITHUB INTEGRATION CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Read Vercel token from Neon PlataformaSync
  console.log('─── 1) PlataformaSync.VERCEL (Neon) ───');
  const ps = await prisma.plataformaSync.findFirst({ where: { plataforma: 'VERCEL' } });
  if (!ps) {
    console.log('❌ No existe PlataformaSync.VERCEL');
    process.exit(1);
  }
  console.log(`   ultimoEstado: ${ps.ultimoEstado}`);
  console.log(`   ultimoError: ${ps.ultimoError || '(none)'}`);
  console.log(`   proyectoRef: ${ps.proyectoRef}`);
  console.log(`   tokenCifrado length: ${ps.tokenCifrado?.length || 0} chars`);
  console.log(`   tokenCifrado prefix: ${ps.tokenCifrado?.slice(0, 20) || '-'}...`);

  // Decrypt
  const vercelTokenRaw = ps.tokenCifrado || '';
  const vercelToken = decryptSensitive(vercelTokenRaw);
  const looksEncrypted = vercelTokenRaw.includes(':') && /^[0-9a-f]+$/.test(vercelTokenRaw.split(':')[0]);
  const looksPlain = vercelToken === vercelTokenRaw; // if no key OR not encrypted format
  console.log(`   ¿formato cifrado (iv:enc)?: ${looksEncrypted ? 'SÍ' : 'NO'}`);
  console.log(`   ¿sin key de encriptación?: ${!getEncryptionKey() ? 'SÍ (API_ENCRYPTION_KEY vacío)' : 'no'}`);
  console.log(`   token decrypted prefix: ${vercelToken.slice(0, 20)}...`);
  console.log(`   token decrypted length: ${vercelToken.length} chars`);

  // Parse configJson
  let config = {};
  try { config = JSON.parse(ps.configJson || '{}'); } catch {}
  console.log(`   projectId: ${config.projectId || '-'}`);
  console.log(`   teamId: ${config.teamId || '-'}`);
  console.log(`   autoDeployOnPush: ${config.autoDeployOnPush}`);
  console.log(`   gitIntegration: ${config.gitIntegration || '-'}`);

  // 2. Test Vercel token
  console.log('\n─── 2) Test Vercel token against /v2/user ───');
  const userRes = await vercelGet('/v2/user', vercelToken);
  console.log(`   HTTP ${userRes.status}`);
  if (userRes.status === 200) {
    const u = userRes.body.user || userRes.body;
    console.log(`   ✅ Token VÁLIDO — conectado como ${u.email || u.username}`);
  } else {
    console.log(`   ❌ Token inválido: ${JSON.stringify(userRes.body).slice(0, 200)}`);
  }

  // 3. GitHub token from git remote
  console.log('\n─── 3) GitHub token (from git remote) ───');
  const gh = getGithubToken();
  if (!gh) {
    console.log('   ❌ No se pudo extraer GitHub token del git remote');
  } else {
    console.log(`   user: ${gh.user}`);
    console.log(`   repo: ${gh.repo}`);
    console.log(`   token length: ${gh.token.length} chars`);
    console.log(`   token prefix: ${gh.token.slice(0, 12)}...`);
  }

  // 4. Test GitHub token + list webhooks
  if (gh) {
    console.log('\n─── 4) Test GitHub token + list repo webhooks ───');
    const ghUser = await githubGet('/user', gh.token);
    console.log(`   GET /user → HTTP ${ghUser.status}`);
    if (ghUser.status === 200) {
      console.log(`   ✅ Token VÁLIDO — ${ghUser.body.login} (id=${ghUser.body.id})`);
    } else {
      console.log(`   ❌ ${JSON.stringify(ghUser.body).slice(0, 200)}`);
    }

    const hooks = await githubGet(`/repos/${gh.repo}/hooks`, gh.token);
    console.log(`\n   GET /repos/${gh.repo}/hooks → HTTP ${hooks.status}`);
    if (hooks.status === 200) {
      const list = hooks.body || [];
      console.log(`   Webhooks configurados: ${list.length}`);
      for (const h of list) {
        console.log(`   • id=${h.id} | url=${h.config?.url} | events=${(h.events || []).join(',')} | active=${h.active}`);
      }
      // Check if any webhook points to Vercel
      const vercelHooks = list.filter(h => (h.config?.url || '').includes('vercel.com') || (h.config?.url || '').includes('now.sh'));
      console.log(`   ¿Hay webhook a Vercel?: ${vercelHooks.length > 0 ? 'SÍ' : 'NO'}`);
    } else {
      console.log(`   ❌ ${JSON.stringify(hooks.body).slice(0, 200)}`);
    }
  }

  // 5. Check Vercel project gitSource
  console.log('\n─── 5) Vercel project gitSource (linked repo) ───');
  const projectId = config.projectId || ps.proyectoRef;
  const teamId = config.teamId;
  if (userRes.status === 200 && projectId) {
    const proj = await vercelGet(`/v9/projects/${projectId}?teamId=${teamId}`, vercelToken);
    console.log(`   GET /v9/projects/${projectId} → HTTP ${proj.status}`);
    if (proj.status === 200) {
      const p = proj.body;
      console.log(`   name: ${p.name}`);
      console.log(`   framework: ${p.framework}`);
      console.log(`   targets: ${Object.keys(p.targets || {}).join(', ')}`);
      if (p.targets?.production) {
        console.log(`   production url: ${p.targets.production.url}`);
        console.log(`   production readyState: ${p.targets.production.readyState}`);
      }
      // gitSource
      const gs = p.link;
      if (gs) {
        console.log(`   link.type: ${gs.type}`);
        console.log(`   link.org: ${gs.org}`);
        console.log(`   link.repo: ${gs.repo}`);
        console.log(`   link.repoId: ${gs.repoId}`);
        console.log(`   link.deployHooks: ${gs.deployHooks?.length || 0}`);
        if (gs.deployHooks?.length) {
          for (const h of gs.deployHooks) {
            console.log(`     • id=${h.id} | name=${h.name} | ref=${h.ref}`);
          }
        }
      } else {
        console.log('   ⚠️  No hay git link configurado (NO se desplegará automáticamente al hacer push)');
      }
      // Latest deployment
      if (p.latestDeployments?.[0]) {
        const d = p.latestDeployments[0];
        console.log(`\n   Último deployment:`);
        console.log(`     uid: ${d.uid}`);
        console.log(`     state: ${d.readyState}`);
        console.log(`     url: ${d.url}`);
        console.log(`     createdAt: ${new Date(d.createdAt).toISOString()}`);
        console.log(`     sha: ${d.meta?.githubCommitSha?.slice(0, 7) || '-'}`);
        console.log(`     commitMsg: ${d.meta?.githubCommitMessage?.slice(0, 80) || '-'}`);
        console.log(`     triggeredBy: ${d.meta?.githubDeploymentEnabled ? 'github' : (d.meta?.githubCommitSha ? 'github' : 'manual/cli')}`);
      }
    } else {
      console.log(`   ❌ ${JSON.stringify(proj.body).slice(0, 400)}`);
    }
  } else {
    console.log('   ⏭  Omitido (token inválido o projectId ausente)');
  }

  // 6. Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Vercel token válido:        ${userRes.status === 200 ? '✅ SÍ' : '❌ NO'}`);
  if (gh) {
    const hooks = await githubGet(`/repos/${gh.repo}/hooks`, gh.token);
    const list = hooks.status === 200 ? hooks.body : [];
    const hasVercelHook = list.some(h => (h.config?.url || '').includes('vercel.com') || (h.config?.url || '').includes('now.sh'));
    console.log(`GitHub webhooks a Vercel:   ${hasVercelHook ? '✅ SÍ' : '❌ NO (Vercel-GitHub app no está conectada)'}`);
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
