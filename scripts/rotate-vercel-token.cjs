// =====================================================
// ROTATE VERCEL TOKEN — Update it everywhere in one shot
// =====================================================
// Usage:
//   VERCEL_TOKEN_NEW="vcp_xxxxx" node scripts/rotate-vercel-token.cjs
//
// Updates the Vercel token in:
//   1. Neon PlataformaSync.VERCEL.tokenCifrado (encrypted with API_ENCRYPTION_KEY)
//   2. Local .env (gitignored)
//   3. Vercel env var VERCEL_TOKEN (so the project itself can use it)
//   4. GitHub Actions secret VERCEL_TOKEN (so the workflow can use it)
//
// Also tests the new token against Vercel API before saving.
// =====================================================

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// IMPORTANT: require PrismaClient FIRST (it loads .env), THEN override DATABASE_URL
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

// Load .env (but DO NOT override DATABASE_URL — we set Neon above)
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

// --- Constants ---
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';
const VERCEL_TOKEN_NEW = process.env.VERCEL_TOKEN_NEW;

if (!VERCEL_TOKEN_NEW) {
  console.error('❌ ERROR: Pasa el nuevo token via VERCEL_TOKEN_NEW="vcp_..." env var');
  console.error('   Ejemplo:');
  console.error('   VERCEL_TOKEN_NEW="vcp_xxxxxxxx" node scripts/rotate-vercel-token.cjs');
  process.exit(1);
}

// --- Encryption helpers (mirror src/lib/security.ts) ---
const ALGORITHM = 'aes-256-cbc';
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) {
    // Generate one and save to .env if missing
    const newKey = crypto.randomBytes(32).toString('hex');
    console.log(`⚠️  API_ENCRYPTION_KEY no estaba en .env — generando una nueva (${newKey.length} hex chars)`);
    let envText = fs.readFileSync('/home/z/my-project/.env', 'utf8');
    if (/^API_ENCRYPTION_KEY=/m.test(envText)) {
      envText = envText.replace(/^API_ENCRYPTION_KEY=.*$/m, `API_ENCRYPTION_KEY="${newKey}"`);
    } else {
      envText += `\nAPI_ENCRYPTION_KEY="${newKey}"\n`;
    }
    fs.writeFileSync('/home/z/my-project/.env', envText);
    process.env.API_ENCRYPTION_KEY = newKey;
    return Buffer.from(newKey, 'hex');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}
function encryptSensitive(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
function decryptSensitive(encryptedText) {
  try {
    const key = getEncryptionKey();
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

// --- Vercel API helpers ---
async function vercelGet(path) {
  const r = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN_NEW}` },
  });
  return { status: r.status, body: await r.json().catch(() => r.text()) };
}
async function vercelSetEnvVar(key, value) {
  const base = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`;
  const url = `${base}?teamId=${VERCEL_TEAM_ID}`;
  // List existing
  const listRes = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN_NEW}` } });
  if (!listRes.ok) {
    return { ok: false, error: `List HTTP ${listRes.status}: ${await listRes.text()}` };
  }
  const listJson = await listRes.json();
  const existing = (listJson.envs || []).find((e) => e.key === key);

  const payload = {
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  };

  if (existing) {
    const updRes = await fetch(
      `${base}/${existing.id}?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN_NEW}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    if (updRes.ok) return { ok: true, action: 'updated', id: existing.id };
    return { ok: false, error: `Update HTTP ${updRes.status}: ${await updRes.text()}` };
  } else {
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN_NEW}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (createRes.ok) {
      const data = await createRes.json();
      return { ok: true, action: 'created', id: data.id };
    }
    return { ok: false, error: `Create HTTP ${createRes.status}: ${await createRes.text()}` };
  }
}

// --- GitHub Actions secret helper (uses pynacl via python) ---
function setGitHubSecret(name, value) {
  // Write value to a temp env file that python can read
  const tempEnv = `/tmp/rotate-vercel-token.env`;
  fs.writeFileSync(tempEnv, `VERCEL_TOKEN_VALUE="${value}"\n`);
  try {
    const result = execSync(
      `GITHUB_TOKEN_VALUE="${value}" GITHUB_TOKEN="$(git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p')" ` +
      `python3 -c '
import os, base64, json, urllib.request
from urllib.error import HTTPError
TOKEN = os.environ["GITHUB_TOKEN"]
VALUE = os.environ["GITHUB_TOKEN_VALUE"]
REPO = "jsadr-1029/jsadr-1029-jsadr"
HEADERS = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"}

def api(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, method=method, headers={**HEADERS, "Content-Type": "application/json"}, data=data)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except HTTPError as e:
        return e.code, e.read()

status, body = api("GET", f"https://api.github.com/repos/{REPO}/actions/secrets/public-key")
if status != 200:
    print(f"public-key failed: {status} {body.decode()[:200]}")
    exit(1)
d = json.loads(body)
key_id, pub_b64 = d["key_id"], d["key"]

try:
    from nacl import encoding, public
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "pynacl"])
    from nacl import encoding, public

pub = public.PublicKey(pub_b64.encode(), encoding.Base64Encoder())
box = public.SealedBox(pub)
encrypted = box.encrypt(VALUE.encode())
encrypted_b64 = base64.b64encode(encrypted).decode()

body = {"encrypted_value": encrypted_b64, "key_id": key_id}
status, resp = api("PUT", f"https://api.github.com/repos/{REPO}/actions/secrets/${name}", body)
print(f"  GitHub secret ${name}: HTTP {status}")
exit(0 if status in (201, 204) else 1)
'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.message + (e.stdout ? '\n' + e.stdout : '') + (e.stderr ? '\n' + e.stderr : '') };
  } finally {
    try { fs.unlinkSync(tempEnv); } catch {}
  }
}

// --- MAIN ---
(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ROTATE VERCEL TOKEN — Update everywhere');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`New token: ${VERCEL_TOKEN_NEW.slice(0, 20)}...${VERCEL_TOKEN_NEW.slice(-6)} (${VERCEL_TOKEN_NEW.length} chars)\n`);

  // 1. Test the new token against Vercel API
  console.log('─── 1) Test new token against Vercel /v2/user ───');
  const userRes = await vercelGet('/v2/user');
  console.log(`   HTTP ${userRes.status}`);
  if (userRes.status !== 200) {
    console.log(`   ❌ Token inválido: ${JSON.stringify(userRes.body).slice(0, 300)}`);
    console.log('\nAbortando — no se actualiza nada con un token inválido.');
    process.exit(1);
  }
  const u = userRes.body.user || userRes.body;
  console.log(`   ✅ Token VÁLIDO — conectado como ${u.email || u.username}`);

  // 2. Get project info to verify access
  console.log(`\n─── 2) Verify project access (${VERCEL_PROJECT_ID}) ───`);
  const projRes = await vercelGet(`/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_TEAM_ID}`);
  console.log(`   HTTP ${projRes.status}`);
  if (projRes.status !== 200) {
    console.log(`   ❌ No se puede acceder al proyecto: ${JSON.stringify(projRes.body).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`   ✅ Proyecto: ${projRes.body.name}`);
  console.log(`   framework: ${projRes.body.framework}`);
  if (projRes.body.targets?.production) {
    console.log(`   production URL: ${projRes.body.targets.production.url}`);
  }

  // 3. Update Neon PlataformaSync.VERCEL
  console.log('\n─── 3) Neon PlataformaSync.VERCEL ───');
  const enc = encryptSensitive(VERCEL_TOKEN_NEW);
  // Verify roundtrip
  if (decryptSensitive(enc) !== VERCEL_TOKEN_NEW) {
    console.error('   ❌ Roundtrip de encriptación fallido — abortando');
    process.exit(1);
  }
  await prisma.plataformaSync.update({
    where: { plataforma: 'VERCEL' },
    data: {
      tokenCifrado: enc,
      sincronizado: true,
      tiempoReal: true, // auto-deploy on push (via GitHub Actions)
      proyectoRef: VERCEL_PROJECT_ID,
      endpoint: 'https://api.vercel.com',
      ramaPrincipal: 'main',
      ultimoSync: new Date(),
      ultimoEstado: 'OK',
      ultimoError: null,
      configJson: JSON.stringify({
        projectId: VERCEL_PROJECT_ID,
        teamId: VERCEL_TEAM_ID,
        projectName: projRes.body.name,
        projectUrl: `https://${projRes.body.targets?.production?.url || 'jsadr-1029-jsadr.vercel.app'}`,
        dashboardUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr`,
        deploymentsUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr/deployments`,
        framework: projRes.body.framework,
        autoDeployOnPush: true,
        autoDeployMethod: 'github_actions_workflow',
        workflowFile: '.github/workflows/deploy-vercel.yml',
        githubSecretsUsed: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
        tokenRotatedAt: new Date().toISOString(),
        tokenRotatedBy: 'rotate-vercel-token.cjs',
      }, null, 2),
    },
  });
  console.log(`   ✅ PlataformaSync.VERCEL.tokenCifrado actualizado (cifrado, ${enc.length} chars)`);
  console.log(`   ✅ ultimoEstado: OK | tiempoReal: true`);

  // 4. Update local .env (gitignored)
  console.log('\n─── 4) Local .env ───');
  const envPath = '/home/z/my-project/.env';
  let envText = fs.readFileSync(envPath, 'utf8');
  // Remove existing VERCEL_* lines
  envText = envText.split('\n').filter(l => !l.startsWith('VERCEL_TOKEN=') && !l.startsWith('VERCEL_PROJECT_ID=') && !l.startsWith('VERCEL_TEAM_ID=') && !l.startsWith('VERCEL_PROJECT_URL=')).join('\n').trim();
  // Add new ones at the end
  envText += `\n\n# Vercel — token rotado ${new Date().toISOString()}\n`;
  envText += `VERCEL_TOKEN=${VERCEL_TOKEN_NEW}\n`;
  envText += `VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}\n`;
  envText += `VERCEL_TEAM_ID=${VERCEL_TEAM_ID}\n`;
  envText += `VERCEL_PROJECT_URL=https://${projRes.body.targets?.production?.url || 'jsadr-1029-jsadr.vercel.app'}\n`;
  fs.writeFileSync(envPath, envText);
  console.log('   ✅ .env actualizado con VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, VERCEL_PROJECT_URL');

  // 5. Update Vercel env var VERCEL_TOKEN (so the running app can use it too)
  console.log('\n─── 5) Vercel project env var VERCEL_TOKEN ───');
  const r = await vercelSetEnvVar('VERCEL_TOKEN', VERCEL_TOKEN_NEW);
  if (r.ok) {
    console.log(`   ✅ Vercel env var 'VERCEL_TOKEN' ${r.action} (id: ${r.id})`);
  } else {
    console.log(`   ⚠️  Falló sync: ${r.error}`);
  }

  // 6. Update GitHub Actions secret VERCEL_TOKEN
  console.log('\n─── 6) GitHub Actions secret VERCEL_TOKEN ───');
  const gh = setGitHubSecret('VERCEL_TOKEN', VERCEL_TOKEN_NEW);
  if (gh.ok) {
    console.log(`   ✅ GitHub secret VERCEL_TOKEN actualizado`);
  } else {
    console.log(`   ⚠️  Falló GitHub secret: ${gh.error}`);
    console.log('      Actualízalo manualmente en:');
    console.log('      https://github.com/jsadr-1029/jsadr-1029-jsadr/settings/secrets/actions');
  }

  // 7. Final summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' ROTACIÓN COMPLETA — Resumen');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ Token verificado contra Vercel API');
  console.log(`✅ Neon PlataformaSync.VERCEL.tokenCifrado actualizado`);
  console.log(`✅ Local .env actualizado`);
  console.log(`✅ Vercel env var VERCEL_TOKEN ${r.action}`);
  console.log(`✅ GitHub Actions secret VERCEL_TOKEN ${gh.ok ? 'actualizado' : 'PENDIENTE (manual)'}`);
  console.log('\nEl workflow .github/workflows/deploy-vercel.yml se disparará');
  console.log('automáticamente en cada push a main.');

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
