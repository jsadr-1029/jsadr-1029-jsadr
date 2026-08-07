// =====================================================
// ACTUALIZAR PlataformaSync con webhook URLs del nuevo dominio
// Marcar todos como PENDIENTE ya que los tokens cifrados están huérfanos
// (la API_ENCRYPTION_KEY original se perdió)
// =====================================================
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jsadr.com.co';
  const webhookBase = `${APP_URL}/api/seguridad/plataformas-sync/webhook`;

  console.log('=== Actualizando PlataformaSync ===');
  console.log(`Webhook base: ${webhookBase}\n`);

  // GitHub
  const github = await prisma.plataformaSync.findUnique({ where: { plataforma: 'GITHUB' } });
  if (github) {
    const updated = await prisma.plataformaSync.update({
      where: { id: github.id },
      data: {
        webhookUrl: webhookBase,
        ramaPrincipal: 'main',
        ultimoSync: new Date(),
        ultimoEstado: 'PENDIENTE',
        ultimoError: 'TokenCifrado huérfano (API_ENCRYPTION_KEY regenerada). Re-ingresar token desde panel.',
      },
    });
    console.log(`✅ GITHUB actualizado. webhookUrl: ${updated.webhookUrl}`);
    console.log(`   proyectoRef: ${updated.proyectoRef}`);
  }

  // Vercel
  const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } });
  if (vercel) {
    const updated = await prisma.plataformaSync.update({
      where: { id: vercel.id },
      data: {
        webhookUrl: webhookBase,
        region: 'iad1',
        ultimoSync: new Date(),
        ultimoEstado: 'PENDIENTE',
        ultimoError: 'TokenCifrado huérfano (API_ENCRYPTION_KEY regenerada). Re-ingresar token desde panel.',
      },
    });
    console.log(`✅ VERCEL actualizado. webhookUrl: ${updated.webhookUrl}`);
    console.log(`   proyectoRef: ${updated.proyectoRef}`);
  }

  // Neon
  const neon = await prisma.plataformaSync.findUnique({ where: { plataforma: 'NEON' } });
  if (neon) {
    const updated = await prisma.plataformaSync.update({
      where: { id: neon.id },
      data: {
        webhookUrl: webhookBase,
        region: 'aws-us-east-2',
        ultimoSync: new Date(),
        ultimoEstado: 'PENDIENTE',
        ultimoError: 'TokenCifrado huérfano (API_ENCRYPTION_KEY regenerada). Re-ingresar token desde panel.',
      },
    });
    console.log(`✅ NEON actualizado. webhookUrl: ${updated.webhookUrl}`);
    console.log(`   proyectoRef: ${updated.proyectoRef}`);
  }

  // Resumen final
  const all = await prisma.plataformaSync.findMany();
  console.log('\n=== ESTADO FINAL PlataformaSync ===');
  for (const p of all) {
    console.log(`  ${p.plataforma.padEnd(10)} | sinc=${p.sincronizado ? 'SÍ' : 'NO'} | tiempoReal=${p.tiempoReal ? 'SÍ' : 'NO'} | estado=${p.ultimoEstado} | token=${p.tokenCifrado ? 'CIFRADO-HUÉRFANO' : 'NO'}`);
  }

  await prisma.$disconnect();
})().catch(e => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
