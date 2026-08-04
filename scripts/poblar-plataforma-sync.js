/**
 * POBLAR PlataformaSync con los datos REALES de las 3 plataformas:
 *   - GitHub: token del git remote, repo = jsadr-1029/jsadr-1029-jsadr
 *   - Neon: project_id rapid-darkness-56995142 + connection string
 *   - Vercel: pendiente user (necesita VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID)
 *
 * También cifra los tokens usando API_ENCRYPTION_KEY (si está seteada)
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const crypto = require('crypto');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

// Token de GitHub extraído del git remote en runtime (no se hardcodea)
const { execSync } = require('child_process');
const rawUrl = execSync("git config --get remote.origin.url").toString().trim();
// Formato: https://USERNAME:TOKEN@github.com/USER/REPO.git
const m = rawUrl.match(/https:\/\/([^:]+):([^@]+)@github\.com\/([^/]+)\/([^/]+)\.git/);
const GITHUB_USER = m ? m[1] : '';
const GITHUB_TOKEN = m ? m[2] : '';
const GITHUB_REPO = m ? `${m[3]}/${m[4]}` : 'jsadr-1029/jsadr-1029-jsadr';

// Neon (de scripts/sync-from-neon.js + .env.example)
const NEON_PROJECT_ID = 'rapid-darkness-56995142';
const NEON_BRANCH = 'main';
const NEON_CONN_STRING = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Vercel — pendiente de user (placeholders vacíos)
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';

// Cifrado simple (si hay API_ENCRYPTION_KEY)
const ENC_KEY = process.env.API_ENCRYPTION_KEY || '';
function cifrar(text) {
  if (!text) return null;
  if (!ENC_KEY) return text; // sin cifrado si no hay key
  const key = crypto.createHash('sha256').update(ENC_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

(async () => {
  console.log('=== POBLANDO PlataformaSync con datos reales ===\n');

  // GITHUB
  await prisma.plataformaSync.update({
    where: { plataforma: 'GITHUB' },
    data: {
      sincronizado: true,
      tiempoReal: false,
      endpoint: 'https://api.github.com',
      proyectoRef: GITHUB_REPO,
      ramaPrincipal: 'main',
      tokenCifrado: cifrar(GITHUB_TOKEN),
      ultimoSync: new Date(),
      ultimoEstado: 'OK',
      ultimoError: null,
      configJson: JSON.stringify({
        repoUrl: `https://github.com/${GITHUB_REPO}`,
        webhookBranch: 'main',
        lastCommitSha: '98ad9c43eeda1e5ea936735453267710a2ea730f',
        lastCommitDate: '2026-08-04T04:07:14Z',
        lastCommitMsg: 'security(brevo): redact SMTP key in test script — use env var',
        commitsAheadBeforePush: 23,
        commitsPushed: 23,
      }),
    },
  });
  console.log('✅ GITHUB actualizado');
  console.log(`   repo: ${GITHUB_REPO}`);
  console.log(`   rama: main`);
  console.log(`   último SHA: 98ad9c43eeda1e5ea936735453267710a2ea730f`);
  console.log(`   token: ${GITHUB_TOKEN ? '[SET ' + GITHUB_TOKEN.length + ' chars]' : 'NULL'}\n`);

  // NEON
  await prisma.plataformaSync.update({
    where: { plataforma: 'NEON' },
    data: {
      sincronizado: true,
      tiempoReal: false,
      endpoint: 'https://console.neon.tech/api/v2',
      proyectoRef: NEON_PROJECT_ID,
      region: 'aws-us-east-2',
      ramaPrincipal: NEON_BRANCH,
      tokenCifrado: cifrar(NEON_CONN_STRING),
      ultimoSync: new Date(),
      ultimoEstado: 'OK',
      ultimoError: null,
      configJson: JSON.stringify({
        projectId: NEON_PROJECT_ID,
        branch: NEON_BRANCH,
        host: 'ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech',
        database: 'neondb',
        user: 'neondb_owner',
        sslmode: 'require',
        syncDirection: 'bidirectional',
        lastSyncDirection: 'SQLite → Neon',
        lastSyncDate: new Date().toISOString(),
        tablesSynced: 32,
        totalRecordsPushed: 326,
      }),
    },
  });
  console.log('✅ NEON actualizado');
  console.log(`   projectId: ${NEON_PROJECT_ID}`);
  console.log(`   branch: ${NEON_BRANCH}`);
  console.log(`   host: ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech`);
  console.log(`   database: neondb`);
  console.log(`   sync: bidirectional (última: SQLite → Neon)\n`);

  // VERCEL
  await prisma.plataformaSync.update({
    where: { plataforma: 'VERCEL' },
    data: {
      sincronizado: false, // queda pendiente hasta que el user setee tokens
      tiempoReal: false,
      endpoint: 'https://api.vercel.com',
      proyectoRef: VERCEL_PROJECT_ID || null,
      region: 'iad1',
      ramaPrincipal: 'main',
      tokenCifrado: VERCEL_TOKEN ? cifrar(VERCEL_TOKEN) : null,
      ultimoSync: null,
      ultimoEstado: VERCEL_TOKEN ? 'OK' : 'NO_CONFIGURADO',
      ultimoError: VERCEL_TOKEN ? null : 'Falta VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID en .env o variables de Vercel',
      configJson: JSON.stringify({
        buildCommand: 'prisma generate && next build',
        installCommand: 'npm install --legacy-peer-deps',
        framework: 'nextjs',
        region: 'iad1',
        maxDuration: 60,
        projectUrl: 'https://jsadr-1029-jsadr.vercel.app',
        dashboardUrl: 'https://vercel.com/jsadr-1029/jsadr-1029-jsadr',
        requiredEnvVars: ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID', 'DATABASE_URL', 'DATABASE_URL_DIRECT'],
        deploymentTrigger: 'auto on push to main',
      }),
    },
  });
  console.log('⚠️  VERCEL actualizado (pendiente tokens del user)');
  console.log(`   framework: nextjs`);
  console.log(`   region: iad1`);
  console.log(`   build: prisma generate && next build`);
  console.log(`   url esperada: https://jsadr-1029-jsadr.vercel.app`);
  console.log(`   estado: NO_CONFIGURADO (falta VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID)\n`);

  // Mostrar estado final
  const all = await prisma.plataformaSync.findMany({ orderBy: { plataforma: 'asc' } });
  console.log('=== ESTADO FINAL PlataformaSync ===');
  for (const p of all) {
    const flag = p.sincronizado ? '✅' : '⚠️ ';
    console.log(`${flag} ${p.plataforma.padEnd(8)} | sincronizado=${p.sincronizado} | estado=${p.ultimoEstado} | proyectoRef=${p.proyectoRef || '-'}`);
  }

  await prisma.$disconnect();
  console.log('\n=== POBLADO COMPLETO ===');
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
