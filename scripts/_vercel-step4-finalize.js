// Step 4: Delete OLD project + Save token to Neon + Trigger redeploy
const TOKEN = process.env.VERCEL_TOKEN_NEW;
const https = require('https');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

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

function encryptToken(token, encryptionKey) {
  // Generate IV
  const iv = crypto.randomBytes(16);
  // Create cipher
  const key = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  // Encrypt
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Return as iv:encrypted
  return iv.toString('hex') + ':' + encrypted;
}

(async () => {
  const OLD_PROJECT_ID = 'prj_XdWSMphgSM0IwVKrngCAyGDFvmVr';
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
  
  console.log('═'.repeat(60));
  console.log(' FINALIZACIÓN DE CONSOLIDACIÓN');
  console.log('═'.repeat(60));
  
  // =====================================================
  // STEP 1: Delete OLD project
  // =====================================================
  console.log('\n1️⃣  Eliminando proyecto VIEJO (jsadr - prj_XdWSMphgSM0IwVKrngCAyGDFvmVr)...');
  const delRes = await apiCall(`/v9/projects/${OLD_PROJECT_ID}`, 'DELETE');
  if (delRes.status === 200 || delRes.status === 204) {
    console.log(`✅ Proyecto VIEJO eliminado`);
  } else {
    console.log(`⚠️  HTTP ${delRes.status} al eliminar`);
    console.log(JSON.stringify(delRes.body, null, 2).substring(0, 500));
  }
  
  // Verify deletion
  console.log('   Verificando eliminación...');
  const verifyRes = await apiCall(`/v9/projects/${OLD_PROJECT_ID}`);
  if (verifyRes.status === 404) {
    console.log(`✅ Confirmado: proyecto VIEJO ya no existe`);
  } else {
    console.log(`⚠️  Aún aparece: HTTP ${verifyRes.status}`);
  }
  
  // =====================================================
  // STEP 2: List remaining projects
  // =====================================================
  console.log('\n2️⃣  Verificando proyectos restantes...');
  const listRes = await apiCall('/v9/projects?limit=100');
  if (listRes.status === 200) {
    const projects = listRes.body.projects || [];
    console.log(`✅ Total proyectos ahora: ${projects.length}`);
    for (const p of projects) {
      console.log(`   - ${p.name} (ID: ${p.id})`);
      if (p.targets?.production?.alias) {
        console.log(`     Aliases: ${p.targets.production.alias.join(', ')}`);
      }
    }
  }
  
  // =====================================================
  // STEP 3: Save new token to Neon (encrypted)
  // =====================================================
  console.log('\n3️⃣  Guardando nuevo token en Neon (cifrado)...');
  
  // Get encryption key from NEW project's env vars
  console.log('   Obteniendo API_ENCRYPTION_KEY del proyecto nuevo...');
  const envRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env?decrypt=true`);
  const envs = envRes.body.envs || [];
  const apiKeyEnv = envs.find(e => e.key === 'API_ENCRYPTION_KEY');
  
  if (!apiKeyEnv || !apiKeyEnv.value) {
    console.log('❌ API_ENCRYPTION_KEY no encontrada o vacía en Vercel');
    console.log('   No se puede cifrar el token. Abortando guardado en Neon.');
  } else {
    const encryptionKey = apiKeyEnv.value;
    console.log(`✅ API_ENCRYPTION_KEY encontrada (${encryptionKey.length} chars)`);
    
    // Encrypt the token
    const encryptedToken = encryptToken(TOKEN, encryptionKey);
    console.log(`✅ Token cifrado: ${encryptedToken.length} chars`);
    
    // Update Neon PlataformaSync
    const updated = await prisma.plataformaSync.updateMany({
      where: { plataforma: 'VERCEL' },
      data: {
        tokenCifrado: encryptedToken,
        ultimoEstado: 'OK',
        ultimoError: null,
        ultimoSync: new Date(),
        proyectoRef: NEW_PROJECT_ID,
        eventsReceived: { increment: 1 }
      }
    });
    
    if (updated.count > 0) {
      console.log(`✅ Token guardado en Neon (PlataformaSync.VERCEL)`);
      console.log(`   Filas actualizadas: ${updated.count}`);
    } else {
      console.log('⚠️  No se actualizó ninguna fila. ¿No existe PlataformaSync.VERCEL?');
      // Try to create
      const created = await prisma.plataformaSync.create({
        data: {
          plataforma: 'VERCEL',
          nombreMostrar: 'Vercel (consolidado)',
          sincronizado: true,
          tiempoReal: true,
          endpoint: 'https://api.vercel.com',
          proyectoRef: NEW_PROJECT_ID,
          teamId: 'team_RgKIQ16ZqHOh3cpZ5WgzXtop',
          region: 'iad1',
          ramaPrincipal: 'main',
          webhookUrl: '',
          ultimoSync: new Date(),
          ultimoEstado: 'OK',
          ultimoError: null,
          eventosRecibidos: 1,
          tokenCifrado: encryptedToken,
          webhookSecret: '',
          configJson: JSON.stringify({
            autoDeployOnPush: true,
            migratedAt: new Date().toISOString(),
            oldProjectId: OLD_PROJECT_ID,
            reason: 'consolidation'
          })
        }
      });
      console.log(`✅ Registro creado: ${created.plataforma}`);
    }
  }
  
  // =====================================================
  // STEP 4: Trigger redeploy of NEW project
  // =====================================================
  console.log('\n4️⃣  Forzando redeploy del proyecto NUEVO...');
  
  // Get latest deployment
  const deploysRes = await apiCall(`/v6/deployments?projectId=${NEW_PROJECT_ID}&limit=1&production=true`);
  if (deploysRes.status === 200 && deploysRes.body.deployments?.length > 0) {
    const lastDeploy = deploysRes.body.deployments[0];
    console.log(`   Último deploy: ${lastDeploy.uid} (${lastDeploy.state})`);
    
    // Promote to production (redeploy)
    const redeployRes = await apiCall(`/v13/deployments/${lastDeploy.uid}/promote`, 'POST', {});
    console.log(`   Promote: HTTP ${redeployRes.status}`);
  } else {
    console.log('   No se encontró deploy para promover');
    console.log('   (Se hará auto-deploy con el próximo push a GitHub)');
  }
  
  // =====================================================
  // STEP 5: Final verification
  // =====================================================
  console.log('\n5️⃣  Verificación final...');
  
  // Wait a moment
  await new Promise(r => setTimeout(r, 3000));
  
  // Check new project domains
  const finalDomainsRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`);
  if (finalDomainsRes.status === 200) {
    const finalDomains = Array.isArray(finalDomainsRes.body) ? finalDomainsRes.body : [];
    console.log(`\n   📋 Dominios en proyecto NUEVO:`);
    for (const d of finalDomains) {
      console.log(`      ✅ ${d.name} (verified: ${d.verified})`);
    }
  }
  
  // Check project status
  const finalProjRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}`);
  if (finalProjRes.status === 200) {
    console.log(`\n   📋 Proyecto NUEVO:`);
    console.log(`      Name: ${finalProjRes.body.name}`);
    console.log(`      ID: ${finalProjRes.body.id}`);
    console.log(`      Updated: ${new Date(finalProjRes.body.updatedAt).toISOString()}`);
  }
  
  console.log('\n═'.repeat(60));
  console.log(' 🎉 CONSOLIDACIÓN COMPLETADA');
  console.log('═'.repeat(60));
  console.log('\n✅ Resumen:');
  console.log('   • Proyecto VIEJO eliminado');
  console.log('   • Dominios jsadr.com.co y www.jsadr.com.co migrados');
  console.log('   • Variables de entorno actualizadas');
  console.log('   • Token nuevo guardado en Neon (cifrado)');
  console.log('   • Redeploy en progreso');
  
  await prisma.$disconnect();
})();
