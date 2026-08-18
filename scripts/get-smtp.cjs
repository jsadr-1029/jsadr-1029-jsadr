const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public' } }
});

(async () => {
  try {
    const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
    if (!c) {
      console.log('No hay SMTP en ConexionAPI');
      const ci = await prisma.correoInstitucional.findFirst();
      console.log('CorreoInstitucional:', JSON.stringify(ci, null, 2));
    } else {
      console.log('host:', c.url);
      console.log('user:', c.usuario);
      console.log('pass len:', c.password ? c.password.length : 0);
      console.log('apiKey:', c.apiKey);
      console.log('configExtra:', c.configuracionExtra);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
