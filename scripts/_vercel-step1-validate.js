// Step 1: Validate token + list projects
const TOKEN = process.env.VERCEL_TOKEN_NEW;
if (!TOKEN) {
  console.error('❌ Falta VERCEL_TOKEN_NEW env var');
  process.exit(1);
}

const https = require('https');

function apiCall(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.vercel.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('═'.repeat(60));
  console.log(' VERCEL TOKEN VALIDATION');
  console.log('═'.repeat(60));
  
  // 1. Validate token
  console.log('\n1️⃣  Validando token...');
  const user = await apiCall('/v2/user');
  if (user.status === 200) {
    console.log(`✅ Token VÁLIDO`);
    console.log(`   Usuario: ${user.body.user.username || user.body.user.email}`);
    console.log(`   UID: ${user.body.user.uid}`);
    console.log(`   Name: ${user.body.user.name || '(no name)'}`);
  } else {
    console.log(`❌ Token inválido: HTTP ${user.status}`);
    console.log(JSON.stringify(user.body, null, 2));
    process.exit(1);
  }
  
  // 2. List teams
  console.log('\n2️⃣  Listando teams...');
  const teams = await apiCall('/v2/teams');
  if (teams.status === 200) {
    console.log(`   Teams encontrados: ${teams.body.teams.length}`);
    for (const t of teams.body.teams) {
      console.log(`   - ${t.name} (id=${t.id}) slug=${t.slug}`);
    }
  }
  
  // 3. List all projects (try with team if available, otherwise personal)
  console.log('\n3️⃣  Listando proyectos...');
  let allProjects = [];
  
  // Try personal first
  const personalRes = await apiCall('/v9/projects?limit=100');
  if (personalRes.status === 200) {
    allProjects = personalRes.body.projects || [];
  }
  
  // Try with each team
  if (teams.status === 200) {
    for (const team of teams.body.teams) {
      const teamRes = await apiCall(`/v9/projects?limit=100&teamId=${team.id}`);
      if (teamRes.status === 200) {
        allProjects = allProjects.concat(teamRes.body.projects || []);
      }
    }
  }
  
  console.log(`   Total proyectos: ${allProjects.length}\n`);
  
  // Show project details
  for (const p of allProjects) {
    console.log('─'.repeat(60));
    console.log(`📋 ${p.name}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Team: ${p.teamId || '(personal)'}`);
    console.log(`   Created: ${new Date(p.createdAt).toISOString()}`);
    console.log(`   Updated: ${new Date(p.updatedAt).toISOString()}`);
    
    if (p.targets?.production?.alias) {
      console.log(`   Aliases (prod): ${p.targets.production.alias.join(', ')}`);
    }
    
    if (p.targets?.production?.meta?.githubCommitMessage) {
      console.log(`   Last commit: ${p.targets.production.meta.githubCommitMessage.substring(0, 60)}`);
    }
    
    if (p.link) {
      console.log(`   Git: ${p.link.repo} (${p.link.type}/${p.link.branch || 'main'})`);
    }
  }
  
  console.log('\n═'.repeat(60));
  console.log(' ✅ TOKEN VÁLIDO Y PROYECTOS LISTADOS');
  console.log('═'.repeat(60));
})();
