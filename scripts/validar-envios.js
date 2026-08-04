const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // EnvioCorreo
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  console.log('=== EnvioCorreo ===');
  console.log('Total envíos registrados:', envios.length);
  const enviados = envios.filter(e => e.estado === 'ENVIADO');
  const fallidos = envios.filter(e => e.estado === 'FALLIDO');
  console.log('  ENVIADO:', enviados.length);
  console.log('  FALLIDO:', fallidos.length);
  
  // OtpRegistro
  const otps = await prisma.otpRegistro.findMany({
    where: { tipo: 'FIRMA_ELECTRONICA' },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  console.log('\n=== OtpRegistro ===');
  console.log('Total OTP registrados (FIRMA_ELECTRONICA):', otps.length);
  const noExpirados = otps.filter(o => o.expiraEn > new Date());
  console.log('  Vigentes (no expirados):', noExpirados.length);
  console.log('  Expirados:', otps.length - noExpirados.length);
  
  // Préstamos actualizados
  const prestamos = await prisma.prestamo.findMany({
    where: { estado: 'PENDIENTE_ACEPTACION' },
    select: { id: true, codigo: true, tycEnviado: true, metodoConfirmacion: true },
  });
  console.log('\n=== Prestamo (PENDIENTE_ACEPTACION) ===');
  const conTycEnviado = prestamos.filter(p => p.tycEnviado);
  console.log('Total pendientes:', prestamos.length);
  console.log('  con tycEnviado=true:', conTycEnviado.length);
  console.log('  con metodoConfirmacion=CORREO:', prestamos.filter(p => p.metodoConfirmacion === 'CORREO').length);
  
  // ConexionAPI
  const conn = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } });
  console.log('\n=== ConexionAPI.EMAIL_SMTP ===');
  console.log('  activa:', conn?.activa);
  console.log('  usuario:', conn?.usuario);
  console.log('  probada:', conn?.probada);
  
  // CorreoInstitucional
  const correo = await prisma.correoInstitucional.findFirst({ where: { esPrincipal: true } });
  console.log('\n=== CorreoInstitucional principal ===');
  console.log('  email:', correo?.email);
  console.log('  smtpHost:', correo?.smtpHost);
  console.log('  smtpUser:', correo?.smtpUser);
  console.log('  ultimoTestOk:', correo?.ultimoTestOk);
  
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
