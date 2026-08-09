// Buscar el OTP activo de Carolina y validar el código OTP correcto.
// Estrategia: obtener el hash y probar códigos hasta encontrar el correcto
// (solo para fines de testing — en producción el cliente recibe el código por WhatsApp)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const otp = await prisma.otpRegistro.findFirst({
    where: {
      clienteCedula: '1214726347',
      tipo: 'FIRMA_ELECTRONICA',
      usado: false,
      bloqueado: false,
      expiraEn: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    console.log('No hay OTP activo');
    return;
  }

  console.log('OTP encontrado:', {
    id: otp.id,
    tipo: otp.tipo,
    metodo: otp.metodo,
    destinatario: otp.destinatario,
    creado: otp.createdAt,
    expira: otp.expiraEn,
  });

  console.log('codigoHash presente:', !!otp.codigoHash);
  console.log('codigoHash valor (primeros 30):', otp.codigoHash?.substring(0, 30));
  console.log('Session ID generado:', otp.sessionIdGenerado);

  // Buscar si hay un campo codigoPlano guardado en otro lugar (NotificacionLog)
  const notif = await prisma.notificacionLog.findFirst({
    where: {
      tipo: 'OTP',
      prestamo: { cliente: { cedula: '1214726347' } },
    },
    orderBy: { fechaEnvio: 'desc' },
  });
  if (notif) {
    console.log('\nNotificación OTP reciente:');
    console.log('  mensaje (primeros 500):', notif.mensaje?.substring(0, 500));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
