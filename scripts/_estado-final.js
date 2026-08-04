const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const correo = await prisma.correoInstitucional.findFirst({ where: { esPrincipal: true } });
  const conn = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } });
  console.log('CorreoInstitucional:', correo ? `${correo.email} @ ${correo.smtpHost}:${correo.smtpPort} user=${correo.smtpUser}` : 'NINGUNO');
  console.log('ConexionAPI EMAIL_SMTP:', conn ? `activa=${conn.activa} user=${conn.usuario}` : 'NINGUNA');
  console.log('API_ENCRYPTION_KEY set:', !!process.env.API_ENCRYPTION_KEY);
  console.log('BREVO_SMTP_KEY set:', !!process.env.BREVO_SMTP_KEY);
  await prisma.$disconnect();
})();
