// Agrega variables adicionales necesarias para producción
const VERCEL_TOKEN = 'process.env.VERCEL_TOKEN || ""';
const PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
const TEAM_ID = 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';

const extraVars = [
  {
    key: 'ALLOWED_ORIGINS',
    value: 'https://jsadr-1029-jsadr.vercel.app,https://jsadr-1029-jsadr-jsadr.vercel.app,https://jsadr-1029-jsadr-git-main-jsadr.vercel.app,https://preview-75739c83-65ec-4f0d-ae31-02fd3582dc37.space-z.ai',
    type: 'plain',
    target: ['production', 'preview', 'development']
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    value: 'https://jsadr-1029-jsadr.vercel.app',
    type: 'plain',
    target: ['production', 'preview', 'development']
  },
  {
    key: 'TZ',
    value: 'America/Bogota',
    type: 'plain',
    target: ['production', 'preview', 'development']
  }
];

(async () => {
  for (const v of extraVars) {
    const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(v)
    });
    const json = await res.json();
    if (res.ok) console.log(`✓ ${v.key}`);
    else console.error(`✗ ${v.key}: ${json.error?.message || JSON.stringify(json)}`);
  }
})();
