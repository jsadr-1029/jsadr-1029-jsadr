// Step 3: Update env vars in NEW project + Move domain + Delete OLD project
const TOKEN = process.env.VERCEL_TOKEN_NEW;
const https = require('https');
const fs = require('fs');

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
  const OLD_PROJECT_ID = 'prj_XdWSMphgSM0IwVKrngCAyGDFvmVr';
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
  
  console.log('═'.repeat(60));
  console.log(' CONSOLIDACIÓN VERCEL');
  console.log('═'.repeat(60));
  
  // =====================================================
  // STEP 1: Get current env vars from NEW project to find IDs
  // =====================================================
  console.log('\n1️⃣  Obteniendo env vars actuales del proyecto NUEVO...');
  const envRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env?decrypt=true`);
  const envs = envRes.body.envs || [];
  console.log(`✅ ${envs.length} variables encontradas`);
  
  // Find NEXT_PUBLIC_APP_URL and ALLOWED_ORIGINS IDs
  const appUrlEnv = envs.find(e => e.key === 'NEXT_PUBLIC_APP_URL');
  const allowedOriginsEnv = envs.find(e => e.key === 'ALLOWED_ORIGINS');
  
  // =====================================================
  // STEP 2: Update NEXT_PUBLIC_APP_URL
  // =====================================================
  console.log('\n2️⃣  Actualizando NEXT_PUBLIC_APP_URL...');
  if (appUrlEnv) {
    const newVal = 'https://jsadr.com.co';
    const updateRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env/${appUrlEnv.id}`, 'PATCH', {
      value: newVal,
      type: 'plain',
      target: ['production', 'preview', 'development']
    });
    if (updateRes.status === 200) {
      console.log(`✅ NEXT_PUBLIC_APP_URL actualizada a: ${newVal}`);
    } else {
      console.log(`❌ Error: HTTP ${updateRes.status}`);
      console.log(JSON.stringify(updateRes.body, null, 2).substring(0, 500));
    }
  } else {
    console.log('⚠️  NEXT_PUBLIC_APP_URL no existe, creando...');
    const createRes = await apiCall(`/v10/projects/${NEW_PROJECT_ID}/env`, 'POST', {
      key: 'NEXT_PUBLIC_APP_URL',
      value: 'https://jsadr.com.co',
      type: 'plain',
      target: ['production', 'preview', 'development']
    });
    console.log(`✅ Creada: HTTP ${createRes.status}`);
  }
  
  // =====================================================
  // STEP 3: Update ALLOWED_ORIGINS
  // =====================================================
  console.log('\n3️⃣  Actualizando ALLOWED_ORIGINS...');
  const newAllowedOrigins = 'https://jsadr.com.co,https://www.jsadr.com.co,https://jsadr-1029-jsadr.vercel.app,https://jsadr-1029-jsadr-jsadr.vercel.app,https://jsadr-1029-jsadr-jsa-4143-jsadr.vercel.app';
  if (allowedOriginsEnv) {
    const updateRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env/${allowedOriginsEnv.id}`, 'PATCH', {
      value: newAllowedOrigins,
      type: 'plain',
      target: ['production', 'preview', 'development']
    });
    if (updateRes.status === 200) {
      console.log(`✅ ALLOWED_ORIGINS actualizada`);
    } else {
      console.log(`❌ Error: HTTP ${updateRes.status}`);
      console.log(JSON.stringify(updateRes.body, null, 2).substring(0, 500));
    }
  } else {
    console.log('⚠️  ALLOWED_ORIGINS no existe, creando...');
    const createRes = await apiCall(`/v10/projects/${NEW_PROJECT_ID}/env`, 'POST', {
      key: 'ALLOWED_ORIGINS',
      value: newAllowedOrigins,
      type: 'plain',
      target: ['production', 'preview', 'development']
    });
    console.log(`✅ Creada: HTTP ${createRes.status}`);
  }
  
  // =====================================================
  // STEP 4: Remove domain from OLD project
  // =====================================================
  console.log('\n4️⃣  Removiendo dominios del proyecto VIEJO...');
  
  // Get old project domains
  const oldDomainsRes = await apiCall(`/v9/projects/${OLD_PROJECT_ID}/domains`);
  if (oldDomainsRes.status === 200) {
    const oldDomains = Array.isArray(oldDomainsRes.body) ? oldDomainsRes.body : (oldDomainsRes.body.domains || []);
    console.log(`   Dominios en VIEJO: ${oldDomains.length}`);
    
    for (const d of oldDomains) {
      console.log(`   Removiendo: ${d.name}...`);
      const removeRes = await apiCall(`/v9/projects/${OLD_PROJECT_ID}/domains/${d.name}`, 'DELETE');
      console.log(`   ${removeRes.status === 200 ? '✅' : '⚠️'} ${d.name}: HTTP ${removeRes.status}`);
    }
  } else {
    console.log(`❌ Error obteniendo dominios: HTTP ${oldDomainsRes.status}`);
  }
  
  // =====================================================
  // STEP 5: Add domain to NEW project
  // =====================================================
  console.log('\n5️⃣  Agregando dominios al proyecto NUEVO...');
  
  // Add jsadr.com.co
  console.log('   Agregando jsadr.com.co...');
  let addRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`, 'POST', {
    name: 'jsadr.com.co'
  });
  console.log(`   ${addRes.status === 200 ? '✅' : '⚠️'} jsadr.com.co: HTTP ${addRes.status}`);
  if (addRes.status !== 200 && addRes.body?.error) {
    console.log(`     Mensaje: ${addRes.body.error.message || JSON.stringify(addRes.body.error)}`);
  }
  
  // Add www.jsadr.com.co
  console.log('   Agregando www.jsadr.com.co...');
  addRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`, 'POST', {
    name: 'www.jsadr.com.co'
  });
  console.log(`   ${addRes.status === 200 ? '✅' : '⚠️'} www.jsadr.com.co: HTTP ${addRes.status}`);
  if (addRes.status !== 200 && addRes.body?.error) {
    console.log(`     Mensaje: ${addRes.body.error.message || JSON.stringify(addRes.body.error)}`);
  }
  
  // =====================================================
  // STEP 6: Verify domains in NEW project
  // =====================================================
  console.log('\n6️⃣  Verificando dominios en proyecto NUEVO...');
  const newDomainsRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`);
  if (newDomainsRes.status === 200) {
    const newDomains = Array.isArray(newDomainsRes.body) ? newDomainsRes.body : (newDomainsRes.body.domains || []);
    console.log(`   Dominios en NUEVO: ${newDomains.length}`);
    for (const d of newDomains) {
      console.log(`   - ${d.name} (verified: ${d.verified || 'unknown'})`);
    }
  }
  
  console.log('\n═'.repeat(60));
  console.log(' ✅ CONSOLIDACIÓN PARCIAL COMPLETADA');
  console.log('   (Dominios movidos, env vars actualizadas)');
  console.log('═'.repeat(60));
})();
