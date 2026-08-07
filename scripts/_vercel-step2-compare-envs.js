// Step 2: Get env vars from BOTH projects
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
  const OLD_PROJECT_ID = 'prj_XdWSMphgSM0IwVKrngCAyGDFvmVr';  // jsadr (viejo)
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj'; // jsadr-1029-jsadr (nuevo)
  
  console.log('═'.repeat(60));
  console.log(' ENV VARS COMPARISON');
  console.log('═'.repeat(60));
  
  // Get env vars from OLD project
  console.log('\n1️⃣  Obteniendo env vars del proyecto VIEJO (jsadr)...');
  const oldRes = await apiCall(`/v9/projects/${OLD_PROJECT_ID}/env?decrypt=true`);
  if (oldRes.status !== 200) {
    console.log(`❌ Error: HTTP ${oldRes.status}`);
    console.log(JSON.stringify(oldRes.body, null, 2).substring(0, 500));
    process.exit(1);
  }
  const oldEnvs = oldRes.body.envs || [];
  console.log(`✅ ${oldEnvs.length} variables en proyecto VIEJO`);
  
  // Get env vars from NEW project
  console.log('\n2️⃣  Obteniendo env vars del proyecto NUEVO (jsadr-1029-jsadr)...');
  const newRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env?decrypt=true`);
  if (newRes.status !== 200) {
    console.log(`❌ Error: HTTP ${newRes.status}`);
    console.log(JSON.stringify(newRes.body, null, 2).substring(0, 500));
    process.exit(1);
  }
  const newEnvs = newRes.body.envs || [];
  console.log(`✅ ${newEnvs.length} variables en proyecto NUEVO`);
  
  // Compare
  console.log('\n3️⃣  Comparando variables...');
  const newKeys = new Set(newEnvs.map(e => e.key));
  const oldKeys = new Set(oldEnvs.map(e => e.key));
  
  const onlyInOld = oldEnvs.filter(e => !newKeys.has(e.key));
  const onlyInNew = newEnvs.filter(e => !oldKeys.has(e.key));
  const inBoth = oldEnvs.filter(e => newKeys.has(e.key));
  
  console.log(`\n📊 Resumen:`);
  console.log(`   - Variables solo en VIEJO (a migrar): ${onlyInOld.length}`);
  console.log(`   - Variables solo en NUEVO: ${onlyInNew.length}`);
  console.log(`   - Variables en ambos: ${inBoth.length}`);
  
  console.log('\n\n📋 VARIABLES SOLO EN VIEJO (a migrar a nuevo):');
  console.log('─'.repeat(60));
  for (const e of onlyInOld) {
    const valPreview = e.value ? (e.value.length > 50 ? e.value.substring(0, 50) + '...' : e.value) : '(empty)';
    console.log(`   • ${e.key}`);
    console.log(`     Value: ${valPreview}`);
    console.log(`     Type: ${e.type} | Target: ${JSON.stringify(e.target)}`);
  }
  
  console.log('\n\n📋 VARIABLES SOLO EN NUEVO (no tocar):');
  console.log('─'.repeat(60));
  for (const e of onlyInNew) {
    const valPreview = e.value ? (e.value.length > 50 ? e.value.substring(0, 50) + '...' : e.value) : '(empty)';
    console.log(`   • ${e.key}`);
    console.log(`     Value: ${valPreview}`);
  }
  
  console.log('\n\n📋 VARIABLES EN AMBOS (revisar conflictos):');
  console.log('─'.repeat(60));
  for (const e of inBoth) {
    const newVal = newEnvs.find(n => n.key === e.key)?.value || '';
    const oldVal = e.value || '';
    const same = newVal === oldVal;
    console.log(`   • ${e.key} ${same ? '✓' : '⚠️ DIFERENTES'}`);
    if (!same) {
      console.log(`     OLD: ${oldVal.substring(0, 60)}`);
      console.log(`     NEW: ${newVal.substring(0, 60)}`);
    }
  }
  
  // Save data for next step
  const fs = require('fs');
  fs.writeFileSync('/tmp/vercel-migration.json', JSON.stringify({
    oldProjectId: OLD_PROJECT_ID,
    newProjectId: NEW_PROJECT_ID,
    onlyInOld: onlyInOld,
    inBoth: inBoth.map(e => ({
      key: e.key,
      oldValue: e.value,
      newValue: newEnvs.find(n => n.key === e.key)?.value
    }))
  }, null, 2));
  
  console.log('\n💾 Datos guardados en /tmp/vercel-migration.json');
})();
