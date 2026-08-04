const { PrismaClient } = require('@prisma/client');
const path = require('path');
process.env.DATABASE_URL = 'file:' + path.resolve('/home/z/my-project/db/custom.db');
const prisma = new PrismaClient();

(async () => {
  console.log('=== VERIFICACIÓN FINAL DE DATOS RESTAURADOS ===\n');

  // Documentos de préstamos
  const docs = await prisma.documentoGestor.findMany({ include: { prestamo: true, cliente: true } });
  console.log(`📄 DOCUMENTOS (${docs.length}):`);
  docs.forEach(d => console.log(`   • ${d.tipo} | "${d.titulo}" | ${d.archivoNombre} (${d.archivoTamano} bytes) | préstamo=${d.prestamo?.codigo || 'N/A'} | cliente=${d.cliente?.nombre || 'N/A'}`));

  // Solicitudes web
  const sols = await prisma.solicitudWeb.findMany({ include: { cliente: true } });
  console.log(`\n📬 SOLICITUDES WEB (${sols.length}):`);
  sols.forEach(s => console.log(`   • ${s.codigo} | ${s.clienteNombre} (${s.clienteCedula}) | $${s.valorSolicitado} | ${s.numeroCuotas} cuotas | estado=${s.estado} | ${s.createdAt.toISOString()}`));

  // Conversaciones con mensajes
  const chats = await prisma.conversacionChat.findMany({ include: { cliente: true, mensajes: true } });
  console.log(`\n💬 CONVERSACIONES (${chats.length}):`);
  chats.forEach(c => console.log(`   • ${c.codigo} | cliente=${c.cliente?.nombre || c.clienteId} | asunto="${c.asunto}" | ${c.mensajes.length} mensajes | estado=${c.estado}`));

  // Bitácoras
  const bit = await prisma.bitacoraPrestamo.groupBy({ by: ['prestamoCodigo'], _count: true, orderBy: { _count: { prestamoCodigo: 'desc' } } });
  console.log(`\n📋 BITÁCORA DE PRÉSTAMOS (agrupado por código, ${bit.length} préstamos distintos):`);
  bit.slice(0, 10).forEach(b => console.log(`   • ${b.prestamoCodigo}: ${b._count} eventos`));

  // Firmas
  const firmas = await prisma.firmaElectronica.groupBy({ by: ['estadoFirma'], _count: true });
  console.log(`\n✍️  FIRMAS ELECTRÓNICAS:`);
  firmas.forEach(f => console.log(`   • ${f.estadoFirma}: ${f._count} firmas`));

  // Snapshots
  const snaps = await prisma.snapshotProyecto.findMany();
  console.log(`\n📸 SNAPSHOTS (${snaps.length}):`);
  snaps.forEach(s => console.log(`   • ${s.nombre} | ${s.uuid.slice(0,8)} | ${s.archivosTotal} archivos | ${s.estado}`));

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
