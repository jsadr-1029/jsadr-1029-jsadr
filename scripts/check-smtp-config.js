const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const conexiones = await prisma.conexionAPI.findMany({
    where: { tipo: 'EMAIL_SMTP' },
  });
  console.log('Conexiones EMAIL_SMTP encontradas:', conexiones.length);
  conexiones.forEach(c => {
    console.log('---');
    console.log('  id:', c.id);
    console.log('  nombre:', c.nombre);
    console.log('  activa:', c.activa);
    console.log('  url:', c.url);
    console.log('  usuario:', c.usuario);
    console.log('  password: [REDACTED, len=', c.password?.length || 0, ']');
    console.log('  apiKey (fromEmail):', c.apiKey);
    console.log('  configuracionExtra:', c.configuracionExtra);
    console.log('  createdAt:', c.createdAt);
    console.log('  updatedAt:', c.updatedAt);
  });
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
