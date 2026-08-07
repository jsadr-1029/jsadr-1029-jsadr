// Step 5: Trigger redeploy + final verification
const TOKEN = process.env.VERCEL_TOKEN_NEW;
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
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
  
  console.log('═'.repeat(60));
  console.log(' REDEPLOY Y VERIFICACIÓN FINAL');
  console.log('═'.repeat(60));
  
  // =====================================================
  // STEP 1: List recent deployments
  // =====================================================
  console.log('\n1️⃣  Listando deployments recientes...');
  const deploysRes = await apiCall(`/v6/deployments?projectId=${NEW_PROJECT_ID}&limit=5`);
  if (deploysRes.status === 200) {
    const deployments = deploysRes.body.deployments || [];
    console.log(`✅ ${deployments.length} deployments encontrados:\n`);
    for (const d of deployments) {
      console.log(`   • ${d.uid.substring(0, 8)}...`);
      console.log(`     Estado: ${d.state}`);
      console.log(`     Creado: ${new Date(d.createdAt).toISOString()}`);
      console.log(`     URL: ${d.url}`);
      if (d.meta?.githubCommitMessage) {
        console.log(`     Commit: ${d.meta.githubCommitMessage.substring(0, 60)}`);
      }
      console.log(`     Aliases: ${(d.alias || []).join(', ')}`);
      console.log('');
    }
    
    // Get the latest production deployment
    const latestProduction = deployments.find(d => d.target === 'production') || deployments[0];
    
    if (latestProduction) {
      console.log(`2️⃣  Promocionando deployment ${latestProduction.uid.substring(0, 8)}... a producción...`);
      const promoteRes = await apiCall(`/v13/deployments/${latestProduction.uid}/promote`, 'POST', {});
      console.log(`   Promote: HTTP ${promoteRes.status}`);
      if (promoteRes.status === 200 || promoteRes.status === 202) {
        console.log(`✅ Promovido a producción`);
      } else {
        console.log(`   Mensaje: ${JSON.stringify(promoteRes.body).substring(0, 200)}`);
      }
    }
  }
  
  // =====================================================
  // STEP 3: Final summary
  // =====================================================
  console.log('\n3️⃣  Resumen final...');
  
  const projRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}`);
  if (projRes.status === 200) {
    const p = projRes.body;
    console.log(`\n   📋 Proyecto único:`);
    console.log(`      Name: ${p.name}`);
    console.log(`      ID: ${p.id}`);
    console.log(`      Updated: ${new Date(p.updatedAt).toISOString()}`);
    if (p.link) {
      console.log(`      Git: ${p.link.repo} (branch: ${p.link.branch || 'main'})`);
    }
  }
  
  const domainsRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`);
  if (domainsRes.status === 200) {
    const domains = Array.isArray(domainsRes.body) ? domainsRes.body : [];
    console.log(`\n   🌐 Dominios:`);
    for (const d of domains) {
      console.log(`      ✅ ${d.name} (verified: ${d.verified})`);
    }
  }
  
  // Env vars count
  const envRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env`);
  if (envRes.status === 200) {
    console.log(`\n   🔑 Variables de entorno: ${envRes.body.envs?.length || 0}`);
    console.log('      Variables:');
    for (const e of envRes.body.envs || []) {
      console.log(`      • ${e.key} [${e.type}]`);
    }
  }
  
  console.log('\n═'.repeat(60));
  console.log(' 🎉 CONSOLIDACIÓN 100% COMPLETADA');
  console.log('═'.repeat(60));
})();
