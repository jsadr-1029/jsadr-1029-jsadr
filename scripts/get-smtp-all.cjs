const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public' } }
});

(async () => {
  try {
    // Buscar en ConexionAPI
    const all = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } });
    console.log('ConexionAPI (todas):');
    for (const c of all) {
      console.log('---');
      console.log('  id:', c.id);
      console.log('  activa:', c.activa);
      console.log('  url:', c.url);
      console.log('  usuario:', c.usuario);
      console.log('  password (raw, len=' + (c.password||'').length + '):', c.password);
      console.log('  apiKey (raw, len=' + (c.apiKey||'').length + '):', c.apiKey);
      console.log('  configExtra:', c.configuracionExtra);
    }
    // Buscar en CorreoInstitucional
    const ci = await prisma.correoInstitucional.findFirst();
    if (ci) {
      console.log('\nCorreoInstitucional:');
      console.log('  id:', ci.id);
      console.log('  email:', ci.email);
      console.log('  nombre:', ci.nombre);
      console.log('  password (raw, len=' + (ci.password||'').length + '):', ci.password);
      console.log('  smtpHost:', ci.smtpHost);
      console.log('  smtpUser:', ci.smtpUser);
      console.log('  smtpPassword (raw, len=' + (ci.smtpPassword||'').length + '):', ci.smtpPassword);
      console.log('  apiKey (raw, len=' + (ci.apiKey||'').length + '):', ci.apiKey);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
