// Step 4b: Save token to Neon (get real API_ENCRYPTION_KEY value first)
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

function encryptToken(token, encryptionKeyHex) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(encryptionKeyHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

(async () => {
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
  
  console.log('═'.repeat(60));
  console.log(' GUARDAR TOKEN EN NEON');
  console.log('═'.repeat(60));
  
  // =====================================================
  // STEP 1: List env vars (to get IDs)
  // =====================================================
  console.log('\n1️⃣  Listando env vars para obtener IDs...');
  const listRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env`);
  const envs = listRes.body.envs || [];
  console.log(`✅ ${envs.length} variables`);
  
  // =====================================================
  // STEP 2: Get individual env var to get DECRYPTED value
  // =====================================================
  console.log('\n2️⃣  Obteniendo API_ENCRYPTION_KEY descifrada...');
  const apiKeyEnv = envs.find(e => e.key === 'API_ENCRYPTION_KEY');
  
  if (!apiKeyEnv) {
    console.log('❌ API_ENCRYPTION_KEY no existe en el proyecto');
    await prisma.$disconnect();
    process.exit(1);
  }
  
  // Fetch individually — this endpoint returns decrypted value
  const detailRes = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/env/${apiKeyEnv.id}`);
  if (detailRes.status !== 200) {
    console.log(`❌ HTTP ${detailRes.status} al obtener detalle`);
    await prisma.$disconnect();
    process.exit(1);
  }
  
  const encryptionKey = detailRes.body.value;
  console.log(`✅ API_ENCRYPTION_KEY obtenida (${encryptionKey.length} chars)`);
  
  if (encryptionKey.length !== 64) {
    console.log(`⚠️  Longitud inesperada (esperado 64 hex chars)`);
    console.log(`   Primeros 20: ${encryptionKey.substring(0, 20)}...`);
  }
  
  // =====================================================
  // STEP 3: Encrypt the new Vercel token
  // =====================================================
  console.log('\n3️⃣  Cifrando token nuevo...');
  const encryptedToken = encryptToken(TOKEN, encryptionKey);
  console.log(`✅ Token cifrado (${encryptedToken.length} chars)`);
  console.log(`   Formato: iv:encrypted (prefix: ${encryptedToken.substring(0, 20)}...)`);
  
  // =====================================================
  // STEP 4: Save to Neon PlataformaSync
  // =====================================================
  console.log('\n4️⃣  Guardando en Neon PlataformaSync...');
  
  // Check if record exists
  const existing = await prisma.plataformaSync.findFirst({
    where: { plataforma: 'VERCEL' }
  });
  
  if (existing) {
    const updated = await prisma.plataformaSync.update({
      where: { id: existing.id },
      data: {
        tokenCifrado: encryptedToken,
        ultimoEstado: 'OK',
        ultimoError: null,
        ultimoSync: new Date(),
        proyectoRef: NEW_PROJECT_ID,
        eventosRecibidos: { increment: 1 },
        configJson: JSON.stringify({
          autoDeployOnPush: true,
          migratedAt: new Date().toISOString(),
          reason: 'consolidation_complete'
        })
      }
    });
    console.log(`✅ Registro actualizado: ${updated.plataforma}`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   proyectoRef: ${updated.proyectoRef}`);
  } else {
    const created = await prisma.plataformaSync.create({
      data: {
        plataforma: 'VERCEL',
        nombreMostrar: 'Vercel (consolidado)',
        sincronizado: true,
        tiempoReal: true,
        endpoint: 'https://api.vercel.com',
        proyectoRef: NEW_PROJECT_ID,
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
          reason: 'consolidation_complete'
        })
      }
    });
    console.log(`✅ Registro creado: ${created.plataforma}`);
  }
  
  // Verify
  const verify = await prisma.plataformaSync.findFirst({
    where: { plataforma: 'VERCEL' }
  });
  console.log(`\n   Verificación:`);
  console.log(`   - tokenCifrado length: ${verify.tokenCifrado?.length || 0}`);
  console.log(`   - proyectoRef: ${verify.proyectoRef}`);
  console.log(`   - ultimoEstado: ${verify.ultimoEstado}`);
  
  // =====================================================
  // STEP 5: Test the saved token by decrypting it
  // =====================================================
  console.log('\n5️⃣  Verificando que el token se puede descifrar...');
  const [ivHex, encHex] = verify.tokenCifrado.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(encryptionKey, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  if (decrypted === TOKEN) {
    console.log('✅ Token descifrado correctamente — coincide con el original');
  } else {
    console.log('❌ Token descifrado NO coincide');
    console.log(`   Original prefix: ${TOKEN.substring(0, 10)}`);
    console.log(`   Decrypted prefix: ${decrypted.substring(0, 10)}`);
  }
  
  await prisma.$disconnect();
  
  console.log('\n═'.repeat(60));
  console.log(' ✅ TOKEN GUARDADO Y VERIFICADO EN NEON');
  console.log('═'.repeat(60));
})();
