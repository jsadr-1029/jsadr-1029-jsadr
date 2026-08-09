// Obtener el último OTP de Carolina para aceptación T&C
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const otps = await prisma.otpRegistro.findMany({
    where: { clienteCedula: '1214726347' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true, tipo: true, codigoPlano: true, metodo: true, destinatario: true,
      usado: true, bloqueado: true, expiraEn: true, createdAt: true,
    },
  });
  console.log('=== Últimos OTPs de Carolina ===');
  otps.forEach(o => console.log(JSON.stringify(o, null, 2)));

  // También verificación T&C
  const verifica = await prisma.verificacionTyC.findMany({
    where: { prestamo: { cliente: { cedula: '1214726347' } } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log('\n=== Verificaciones T&C ===');
  verifica.forEach(v => console.log(JSON.stringify(v, null, 2)));
}
main().catch(console.error).finally(() => prisma.$disconnect());
