// Dispara un nuevo deploy de producción en Vercel usando el último commit de main
const VERCEL_TOKEN = 'process.env.VERCEL_TOKEN || ""';
const PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
const TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';
const SHA = '7fe6512c4dc6ec6011f935b2622b3caa15aac4a0';
const REF = 'main';
const REPO = 'jsadr-1029-jsadr';

(async () => {
  console.log('Disparando nuevo deploy de producción con envVars actualizadas...');
  const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&forceNew=1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'jsadr-1029-jsadr',
      project: PROJECT_ID,
      target: 'production',
      gitSource: {
        type: 'github',
        org: 'jsadr-1029',
        repo: REPO,
        ref: REF,
        sha: SHA
      }
    })
  });
  const json = await res.json();
  if (res.ok) {
    console.log('✓ Deploy disparado:');
    console.log('  ID:', json.id || json.uid);
    console.log('  URL:', json.url);
    console.log('  State:', json.readyState);
    console.log('  Inspector:', json.inspectorUrl);
  } else {
    console.error('✗ Error:', json.error?.message || JSON.stringify(json));
  }
})();
