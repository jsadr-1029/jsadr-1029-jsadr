// Verificación de sincronización Neon - accede directamente a la BD Neon con Prisma
const { PrismaClient } = require('@prisma/client');
// Forzar lectura sin comillas
const dotenv = require('dotenv');
dotenv.config();
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');
}
const prisma = new PrismaClient();

(async () => {
  console.log('🔍 Conectando a Neon (DATABASE_URL del .env)...\n');
  try {
    // 1. Listar tablas existentes
    const tablas = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name;
    `);
    console.log(`📋 Tablas en Neon: ${tablas.length}`);
    tablas.forEach(t => console.log(`   - ${t.table_name}`));

    console.log('\n📊 Conteos por tabla:');
    const tablasEsperadas = [
      'User', 'Cliente', 'Prestamo', 'Pago', 'ConexionApi',
      'PlataformaSync', 'AuditLog', 'Notificacion', 'PlantillaBot',
      'Bitacora', 'ConfiguracionGlobal', 'Categoria', 'Campana',
      'PlanFinanciero', 'SolicitudNueva', 'Snapshot', 'Caja', 'CuentaBancaria',
      'Automatizacion', 'Credencial', 'SolicitudWeb'
    ];
    let total = 0;
    const rows = [];
    for (const modelo of tablasEsperadas) {
      try {
        const count = await prisma[modelo].count();
        rows.push({ modelo, count });
        total += count;
      } catch (e) {
        rows.push({ modelo, count: `ERR: ${e.message.slice(0, 80)}` });
      }
    }
    rows.forEach(r => console.log(`   ${r.modelo.padEnd(25)} = ${r.count}`));
    console.log(`\n   TOTAL registros: ${total}`);

    // 2. Usuarios detallados
    console.log('\n👥 Usuarios en Neon:');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, name: true, createdAt: true }
    });
    if (users.length === 0) {
      console.log('   ⚠️  NO HAY USUARIOS EN NEON');
    } else {
      users.forEach(u => {
        console.log(`   - [${u.role}] ${u.email}  (${u.name || '-'})  createdAt=${u.createdAt.toISOString().slice(0,10)}`);
      });
    }

    // 3. Clientes
    console.log('\n👥 Clientes en Neon:');
    const clientes = await prisma.cliente.findMany({
      select: { id: true, nombre: true, email: true, telefono: true, createdAt: true }
    });
    if (clientes.length === 0) {
      console.log('   ⚠️  NO HAY CLIENTES EN NEON');
    } else {
      clientes.slice(0, 30).forEach(c => {
        console.log(`   - ${c.nombre}  email=${c.email || '-'}  tel=${c.telefono || '-'}`);
      });
      if (clientes.length > 30) console.log(`   ... y ${clientes.length - 30} más`);
    }

    // 4. PlataformaSync
    console.log('\n📊 PlataformaSync en Neon:');
    const ps = await prisma.plataformaSync.findMany();
    if (ps.length === 0) {
      console.log('   ⚠️  NO HAY REGISTROS EN PlataformaSync');
    } else {
      ps.forEach(p => {
        console.log(`   - ${p.plataforma.padEnd(10)} sincronizado=${p.sincronizado}  ultimoEstado=${p.ultimoEstado || '-'}  ultimoSync=${p.ultimoSync ? p.ultimoSync.toISOString() : '-'}`);
      });
    }

    // 5. Últimos AuditLogs
    console.log('\n📜 Últimos 10 AuditLogs:');
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { accion: true, createdAt: true, exito: true }
    });
    if (logs.length === 0) {
      console.log('   (sin audit logs)');
    } else {
      logs.forEach(l => {
        console.log(`   - ${l.createdAt.toISOString().slice(0,19)}  ${l.accion}  exito=${l.exito}`);
      });
    }

    await prisma.$disconnect();
    console.log('\n✅ Verificación Neon completada.');
  } catch (e) {
    console.error('❌ Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
