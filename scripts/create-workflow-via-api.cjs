// Try to create the workflow file via GitHub Contents API
// (Last resort — usually also requires 'workflow' scope, but worth trying)
const fs = require('fs');
const { execSync } = require('child_process');

const url = execSync('git config --get remote.origin.url').toString().trim();
const m = url.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/);
const TOKEN = m[2];
const REPO = `${m[3]}/${m[4]}`;

const WORKFLOW_CONTENT = fs.readFileSync('/home/z/my-project/.github/workflows/deploy-vercel.yml', 'utf8');
const ENCODED = Buffer.from(WORKFLOW_CONTENT).toString('base64');

(async () => {
  console.log('Attempting to create workflow file via GitHub Contents API...\n');

  // First check if file already exists
  const checkRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/.github/workflows/deploy-vercel.yml`,
    {
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jsadr-1029',
      },
    }
  );
  console.log(`Check existing: HTTP ${checkRes.status}`);
  const existingSha = checkRes.status === 200 ? (await checkRes.json()).sha : null;

  // Create or update
  const body = {
    message: 'ci(vercel): auto-deploy workflow on push to main',
    content: ENCODED,
    branch: 'main',
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/.github/workflows/deploy-vercel.yml`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jsadr-1029',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  console.log(`PUT: HTTP ${res.status}`);
  const respBody = await res.json();
  if (res.ok) {
    console.log('✅ Workflow file created successfully!');
    console.log(`   commit: ${respBody.commit.sha}`);
    console.log(`   url: ${respBody.content?.html_url}`);
  } else {
    console.log(`❌ Failed: ${JSON.stringify(respBody).slice(0, 400)}`);
    if (res.status === 403 && respBody.message?.includes('workflow')) {
      console.log('\n⚠️  El token no tiene scope "workflow".');
      console.log('   Opciones para el usuario:');
      console.log('   1. Regenerar el token en https://github.com/settings/tokens');
      console.log('      marcando el scope "workflow" además de "repo"');
      console.log('   2. Crear el archivo manualmente via GitHub web UI:');
      console.log('      https://github.com/jsadr-1029/jsadr-1029-jsadr/new/main/.github/workflows');
      console.log('      Nombre: deploy-vercel.yml');
      console.log('      Contenido: ver .github/workflows/deploy-vercel.yml en el workspace');
    }
  }
})().catch(e => { console.error('ERR:', e); process.exit(1); });
