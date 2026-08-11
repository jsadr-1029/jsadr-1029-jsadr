// Verificar notificaciones y préstamo de Carolina
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Notificaciones
  const notifs = await prisma.notificacionLog.findMany({
    where: { prestamo: { cliente: { cedula: '1214726347' } } },
    orderBy: { fechaEnvio: 'desc' },
    take: 10,
    select: {
      id: true, tipo: true, mensaje: true, fechaEnvio: true, estado: true,
      prestamo: { select: { codigo: true } },
    },
  });
  console.log('=== Notificaciones Carolina ===');
  notifs.forEach(n => console.log(`- [${n.fechaEnvio?.toISOString()}] ${n.tipo}: ${n.mensaje?.substring(0, 100)} (estado=${n.estado}) prestamo=${n.prestamo?.codigo}`));

  // Préstamos pendientes de aceptación
  const prestamos = await prisma.prestamo.findMany({
    where: { cliente: { cedula: '1214726347' }, estado: 'PENDIENTE_ACEPTACION' },
    select: {
      id: true, codigo: true, estado: true, tycToken: true, tycAceptado: true,
      fechaAprobacion: true, tycEnviado: true,
    },
  });
  console.log('\n=== Préstamos PENDIENTE_ACEPTACION de Carolina ===');
  prestamos.forEach(p => console.log(`- ${p.codigo}: estado=${p.estado} tycToken=${p.tycToken} tycAceptado=${p.tycAceptado} tycEnviado=${p.tycEnviado} fechaAprob=${p.fechaAprobacion}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
