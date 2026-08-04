const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.envioCorreo.count();
  console.log('Envíos de correo registrados en BD:', count);
  
  const recent = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\nÚltimos 5 envíos:');
  recent.forEach(e => {
    console.log(`  ${e.createdAt.toISOString()} | ${e.destinatario} | ${e.asunto} | ${e.estado}`);
  });
  
  // Verificar tabla OtpRegistro
  const otpCount = await prisma.otpRegistro.count();
  console.log('\nOTP registrados en BD:', otpCount);
  
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
