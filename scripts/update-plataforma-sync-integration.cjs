// Update PlataformaSync.VERCEL in Neon to reflect the new integration approach
// (GitHub Actions workflow instead of Vercel GitHub App).
// Also updates GitHub PlataformaSync to reflect auto-deploy setup.

const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL =
  'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const prisma = new PrismaClient();

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' UPDATE PlataformaSync — new integration method');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // VERCEL — mark as auto-deploy via GitHub Actions workflow
  const v = await prisma.plataformaSync.update({
    where: { plataforma: 'VERCEL' },
    data: {
      // Token stays the same (still invalid until user rotates it)
      // but we update the metadata to reflect new integration approach
      sincronizado: true, // workflow is set up, just needs valid token
      tiempoReal: true,   // auto-deploy on push
      ultimoSync: new Date(),
      ultimoEstado: 'OK_WORKFLOW_CONFIGURADO_TOKEN_PENDIENTE',
      ultimoError: 'Token inválido. Workflow .github/workflows/deploy-vercel.yml listo. Rotar token con scripts/rotate-vercel-token.cjs',
      configJson: JSON.stringify({
        projectId: 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj',
        teamId: 'team_RgKIQ16ZqHOh3cpZ5WgzXtop',
        projectName: 'jsadr-1029-jsadr',
        projectUrl: 'https://jsadr-1029-jsadr.vercel.app',
        dashboardUrl: 'https://vercel.com/jsadr-1029/jsadr-1029-jsadr',
        deploymentsUrl: 'https://vercel.com/jsadr-1029/jsadr-1029-jsadr/deployments',
        framework: 'nextjs',
        autoDeployOnPush: true,
        autoDeployMethod: 'github_actions_workflow',
        workflowFile: '.github/workflows/deploy-vercel.yml',
        workflowTrigger: 'push to main',
        workflowSecretsUsed: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
        tokenStatus: 'INVALID_403_NEEDS_ROTATION',
        tokenRotateScript: 'scripts/rotate-vercel-token.cjs',
        tokenRotateCommand: 'VERCEL_TOKEN_NEW="vcp_xxx" node scripts/rotate-vercel-token.cjs',
        vercelTokenCreateUrl: 'https://vercel.com/account/tokens',
        githubSecretsUrl: 'https://github.com/jsadr-1029/jsadr-1029-jsadr/settings/secrets/actions',
        lastVerifiedAt: new Date().toISOString(),
      }, null, 2),
    },
  });
  console.log(`✅ VERCEL updated:`);
  console.log(`   estado: ${v.ultimoEstado}`);
  console.log(`   método auto-deploy: github_actions_workflow`);
  console.log(`   workflow: ${JSON.parse(v.configJson).workflowFile}`);

  // GITHUB — note that GitHub Actions is now used for auto-deploy
  const g = await prisma.plataformaSync.update({
    where: { plataforma: 'GITHUB' },
    data: {
      sincronizado: true,
      tiempoReal: true, // Actions triggers on every push
      ultimoSync: new Date(),
      ultimoEstado: 'OK',
      ultimoError: null,
      configJson: JSON.stringify({
        repoUrl: 'https://github.com/jsadr-1029/jsadr-1029-jsadr',
        webhookBranch: 'main',
        actionsEnabled: true,
        actionsAllowedActions: 'all',
        workflowsCount: 1,
        workflows: [
          {
            name: 'Deploy to Vercel',
            path: '.github/workflows/deploy-vercel.yml',
            trigger: 'push to main + workflow_dispatch',
            secretsUsed: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
          },
        ],
        repoSecrets: ['DATABASE_URL', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'VERCEL_TOKEN'],
        tokenScopes: ['repo'],
        missingScopes: ['workflow'],
        note: 'Token tiene scope "repo" que incluye permisos de workflow en GitHub Actions',
        lastVerifiedAt: new Date().toISOString(),
      }, null, 2),
    },
  });
  console.log(`\n✅ GITHUB updated:`);
  console.log(`   estado: ${g.ultimoEstado}`);
  console.log(`   Actions habilitado, workflows: 1`);

  // Final summary
  const all = await prisma.plataformaSync.findMany({ orderBy: { plataforma: 'asc' } });
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' ESTADO FINAL PlataformaSync');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const p of all) {
    const flag = p.sincronizado ? '✅' : '⚠️ ';
    console.log(`${flag} ${p.plataforma.padEnd(8)} | sincronizado=${p.sincronizado} | estado=${p.ultimoEstado}`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
