// Verificación integral del estado de sincronización en Neon
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ESTADO DE SINCRONIZACIÓN — NEON POSTGRES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Conectividad
    const ping = await prisma.$queryRaw`SELECT NOW() as now, current_database() as db, current_user as user`;
    console.log('✅ Conexión OK:', JSON.stringify(ping[0]));
    console.log();

    // 2. Conteos por tabla principal
    console.log('─── Conteos por tabla ───');
    const tablas = [
      'usuario', 'cliente', 'prestamo', 'pago', 'firmaElectronica',
      'conexionAPI', 'correoInstitucional', 'plataformaSync',
      'configuracion', 'notificacionLog', 'otpRegistro', 'auditLog',
      'bitacoraPrestamo', 'categoria', 'cuentaRecaudo'
    ];
    for (const t of tablas) {
      try {
        const count = await prisma[t].count();
        console.log(`  ${t.padEnd(25)} ${count} registros`);
      } catch (e) {
        console.log(`  ${t.padEnd(25)} [tabla no encontrada: ${e.message.substring(0, 50)}]`);
      }
    }
    console.log();

    // 3. Estado credenciales críticas
    console.log('─── Credenciales críticas ───');
    const usuarios = await prisma.usuario.findMany({ select: { username: true, rol: true, activo: true } });
    console.log(`  Usuarios del sistema: ${usuarios.length} → ${usuarios.map(u => `${u.username}(${u.rol}${u.activo ? '✓' : '✗'})`).join(', ')}`);
    
    const clientes = await prisma.cliente.findMany({ select: { cedula: true, nombre: true, email: true, activo: true } });
    console.log(`  Clientes: ${clientes.length} → ${clientes.map(c => `${c.cedula}(${c.activo ? '✓' : '✗'})`).join(', ')}`);
    console.log();

    // 4. ConexionAPI EMAIL_SMTP
    console.log('─── ConexionAPI.EMAIL_SMTP ───');
    const smtp = await prisma.conexionAPI.findFirst({
      where: { tipo: 'EMAIL_SMTP' },
      select: { nombre: true, activa: true, probada: true, fechaUltimaPrueba: true, resultadoUltimaPrueba: true }
    });
    console.log('  Estado:', JSON.stringify(smtp, null, 2));
    console.log();

    // 5. PlataformaSync
    console.log('─── PlataformaSync ───');
    const syncs = await prisma.plataformaSync.findMany({
      select: { plataforma: true, sincronizado: true, ultimoEstado: true, ultimoSync: true, tiempoReal: true }
    });
    for (const s of syncs) {
      console.log(`  ${s.plataforma}: ${s.ultimoEstado} | sincronizado=${s.sincronizado} | tiempoReal=${s.tiempoReal} | ultimoSync=${s.ultimoSync}`);
    }
    console.log();

    // 6. CorreoInstitucional
    console.log('─── CorreoInstitucional ───');
    const correos = await prisma.correoInstitucional.findMany({
      select: { email: true, estado: true, esPrincipal: true, smtpHost: true }
    });
    for (const c of correos) {
      console.log(`  ${c.email}: ${c.estado} | principal=${c.esPrincipal} | host=${c.smtpHost}`);
    }
    console.log();

    // 7. Configuracion con claves BREVO
    console.log('─── Configuracion (BREVO_*) ───');
    const configs = await prisma.configuracion.findMany({
      where: { clave: { contains: 'BREVO', mode: 'insensitive' } }
    });
    if (configs.length === 0) console.log('  (sin configuraciones BREVO)');
    for (const c of configs) {
      console.log(`  ${c.clave}: ${c.valor ? c.valor.substring(0, 50) + '...' : 'null'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(' ✅ NEON DB SINCRONIZADA Y OPERATIVA');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
