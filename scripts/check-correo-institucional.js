const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const correos = await prisma.correoInstitucional.findMany();
  console.log('Correos institucionales:', correos.length);
  correos.forEach(c => {
    console.log('---');
    console.log('  id:', c.id);
    console.log('  nombre:', c.nombre);
    console.log('  email:', c.email);
    console.log('  tipo:', c.tipo);
    console.log('  estado:', c.estado);
    console.log('  esPrincipal:', c.esPrincipal);
    console.log('  esRespaldo:', c.esRespaldo);
    console.log('  smtpHost:', c.smtpHost);
    console.log('  smtpPort:', c.smtpPort);
    console.log('  smtpUser:', c.smtpUser);
    console.log('  smtpPass (len):', c.smtpPass?.length || 0);
    console.log('  ssl:', c.ssl, 'tls:', c.tls, 'starttls:', c.starttls);
    console.log('  ultimoTest:', c.ultimoTest);
    console.log('  ultimoTestOk:', c.ultimoTestOk);
  });
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
