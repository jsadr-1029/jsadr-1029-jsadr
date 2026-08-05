// Neon DB sync verification - uses @prisma/client directly with env override
require('dotenv').config({ path: '/home/z/my-project/.env' });

// Strip quotes from DATABASE_URL if present (some shells quote env vars)
let dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
  dbUrl = dbUrl.slice(1, -1);
  process.env.DATABASE_URL = dbUrl;
}

const { PrismaClient } = require('@prisma/client');

(async () => {
  const p = new PrismaClient();
  try {
    const [users, prestamos, conns, categorias] = await Promise.all([
      p.user.count(),
      p.prestamo.count(),
      p.conexionAPI.count(),
      p.categoriaCliente.count(),
    ]);
    console.log('Neon DB OK');
    console.log('  - usuarios        :', users);
    console.log('  - prestamos       :', prestamos);
    console.log('  - conexiones API  :', conns);
    console.log('  - categorias      :', categorias);

    const lastEmail = await p.envioCorreo.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, estado: true, destinatario: true, asunto: true }
    });
    console.log('  - último correo   :', lastEmail ? `${lastEmail.estado} → ${lastEmail.destinatario} @ ${lastEmail.createdAt.toISOString()}` : 'ninguno');

    const emailConfig = await p.conexionAPI.findUnique({ where: { id: 'EMAIL_SMTP' } });
    console.log('  - EMAIL_SMTP      :', emailConfig ? `configurada (activo=${emailConfig.activa})` : 'NO configurada');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
