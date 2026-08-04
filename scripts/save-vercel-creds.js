/**
 * Guarda credenciales de Vercel en:
 *   1. PlataformaSync (tokenCifrado, con datos completos en configJson)
 *   2. .env local (gitignored, para uso de scripts locales)
 * NO commitea nada al git (las credenciales son secretas).
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

// Credenciales desde variables de entorno (NO se hardcodean en el script)
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_RgKIQ16ZqHOh3cpZ5WgzXtop';
const VERCEL_PROJECT_URL = process.env.VERCEL_PROJECT_URL?.replace(/^https?:\/\//, '') || 'jsadr-1029-jsadr.vercel.app';

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error('ERROR: Faltan VERCEL_TOKEN o VERCEL_PROJECT_ID en .env');
  process.exit(1);
}

(async () => {
  console.log('=== GUARDANDO CREDENCIALES VERCEL ===\n');

  // 1. Actualizar PlataformaSync
  const updated = await prisma.plataformaSync.update({
    where: { plataforma: 'VERCEL' },
    data: {
      sincronizado: true,
      tiempoReal: true, // Vercel auto-deploy on push
      endpoint: 'https://api.vercel.com',
      proyectoRef: VERCEL_PROJECT_ID,
      region: 'iad1',
      ramaPrincipal: 'main',
      tokenCifrado: VERCEL_TOKEN, // 60 chars, formato vcp_
      webhookSecret: null,
      webhookUrl: `https://${VERCEL_PROJECT_URL}/api/seguridad/plataformas-sync/webhook`,
      ultimoSync: new Date(),
      ultimoEstado: 'OK',
      ultimoError: null,
      configJson: JSON.stringify({
        projectId: VERCEL_PROJECT_ID,
        teamId: VERCEL_TEAM_ID,
        projectName: 'jsadr-1029-jsadr',
        projectUrl: `https://${VERCEL_PROJECT_URL}`,
        dashboardUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr`,
        deploymentsUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr/deployments`,
        settingsUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr/settings`,
        envVarsUrl: `https://vercel.com/jsadr-1029/jsadr-1029-jsadr/settings/environment-variables`,
        framework: 'nextjs',
        nodeVersion: '24.x',
        buildCommand: 'prisma generate && next build',
        installCommand: 'npm install --legacy-peer-deps',
        region: 'iad1',
        maxDuration: 60,
        autoDeployOnPush: true,
        gitIntegration: 'github:jsadr-1029/jsadr-1029-jsadr',
        envVarsCount: 11,
        envVarsConfigured: [
          'NEXT_PUBLIC_APP_URL', 'ALLOWED_ORIGINS', 'BREVO_SMTP_KEY',
          'CHAT_DYN_SECRET', 'OTP_CHAT_SECRET', 'ADMIN_SESSION_SECRET',
          'PORTAL_SESSION_SECRET', 'JWT_REFRESH_SECRET', 'JWT_SECRET',
          'API_ENCRYPTION_KEY', 'DATABASE_URL'
        ],
        lastDeployState: 'ERROR',
        lastDeployCommit: 'dc2c09730ea83d31d97b081ed5472334c62a0458',
        lastDeployDate: '2026-08-04T04:16:28Z',
        lastDeployError: 'scripts/_inspect-all-tables.ts:26 prisma.notificacion does not exist (fixed by tsconfig exclude)',
        lastSuccessfulDeploy: '2026-08-03T02:01:56Z (commit 91bb935)',
        lastSuccessfulUrl: 'jsadr-1029-jsadr-10pvjd2tg-jsadr.vercel.app',
      }, null, 2),
    },
  });
  console.log('✅ PlataformaSync.VERCEL actualizado:');
  console.log(`   projectId: ${updated.proyectoRef}`);
  console.log(`   estado: ${updated.ultimoEstado}`);
  console.log(`   sincronizado: ${updated.sincronizado}`);
  console.log(`   token: [SET ${updated.tokenCifrado.length} chars]`);

  // 2. Actualizar .env local (sin commitear — .env está en .gitignore)
  const envPath = '/home/z/my-project/.env';
  let envContent = fs.readFileSync(envPath, 'utf8');
  const newVars = [
    `VERCEL_TOKEN=${VERCEL_TOKEN}`,
    `VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}`,
    `VERCEL_TEAM_ID=${VERCEL_TEAM_ID}`,
    `VERCEL_PROJECT_URL=https://${VERCEL_PROJECT_URL}`,
  ];

  // Eliminar líneas existentes de VERCEL_*
  envContent = envContent.split('\n').filter(l => !l.startsWith('VERCEL_')).join('\n').trim();
  // Añadir nuevas al final
  envContent += '\n\n# Vercel — credenciales añadidas 2026-08-04\n' + newVars.join('\n') + '\n';
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env local actualizado:');
  console.log('   VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, VERCEL_PROJECT_URL');

  // 3. Mostrar resumen
  const all = await prisma.plataformaSync.findMany({ orderBy: { plataforma: 'asc' } });
  console.log('\n=== ESTADO FINAL PlataformaSync ===');
  for (const p of all) {
    const flag = p.sincronizado ? '✅' : '⚠️ ';
    console.log(`${flag} ${p.plataforma.padEnd(8)} | sincronizado=${p.sincronizado} | estado=${p.ultimoEstado} | proyectoRef=${p.proyectoRef || '-'}`);
  }

  await prisma.$disconnect();
  console.log('\n=== CREDENCIALES GUARDADAS ===');
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
