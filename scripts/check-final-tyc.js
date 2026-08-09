// Verificar el estado del préstamo de Carolina tras aceptación T&C
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.prestamo.findFirst({
    where: { codigo: 'CA-CC-1214726347-20260809-04' },
    select: {
      codigo: true, estado: true, tycToken: true, tycAceptado: true,
      tycFechaAceptacion: true, tycEnviado: true, fechaAprobacion: true,
      fechaDesembolso: true,
    },
  });
  console.log('=== Estado final del préstamo CA-CC-1214726347-20260809-04 ===');
  console.log(JSON.stringify(p, null, 2));

  // OTPs usados
  const otpsUsados = await prisma.otpRegistro.findMany({
    where: { clienteCedula: '1214726347', usado: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      tipo: true, metodo: true, destinatario: true, usado: true, fechaVerificacion: true,
    },
  });
  console.log('\n=== OTPs usados ===');
  otpsUsados.forEach(o => console.log(JSON.stringify(o)));
}
main().catch(console.error).finally(() => prisma.$disconnect());
