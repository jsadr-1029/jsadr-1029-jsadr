// Verificación detallada de sincronización Neon
const fs = require('fs');
const path = require('path');

// Cargar .env manualmente para limpiar comillas
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val; // override always
  }
});

console.log('DATABASE_URL prefix:', process.env.DATABASE_URL.slice(0, 25), '...');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n🔍 Conectando a Neon (PostgreSQL)...\n');
  try {
    // 1. Listar tablas
    const tablas = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name;
    `);
    console.log(`📋 Tablas en Neon: ${tablas.length}`);

    // 2. Conteos por modelo principal
    console.log('\n📊 Conteos por tabla:');
    const modelos = [
      'Usuario', 'Cliente', 'Prestamo', 'Pago', 'ConexionAPI',
      'PlataformaSync', 'AuditLog', 'NotificacionLog', 'Bot',
      'BitacoraPrestamo', 'Configuracion', 'AccesoPortal',
      'CasoJuridico', 'CajaMenor', 'SnapshotProyecto',
      'SolicitudWeb', 'OtpRegistro', 'Campaña',
      'VariableGlobal', 'VersionSistema'
    ];
    let total = 0;
    for (const m of modelos) {
      try {
        const c = await prisma[m].count();
        total += c;
        console.log(`   ${m.padEnd(25)} = ${c}`);
      } catch (e) {
        console.log(`   ${m.padEnd(25)} = ERR: ${e.message.slice(0, 60)}`);
      }
    }
    console.log(`\n   TOTAL registros (modelos listados): ${total}`);

    // 3. Usuarios detallados
    console.log('\n👥 Usuarios en Neon:');
    const users = await prisma.usuario.findMany({
      select: { id: true, email: true, rol: true, nombre: true, username: true, cedula: true, createdAt: true, activo: true, mustChangePassword: true }
    });
    if (users.length === 0) {
      console.log('   ⚠️  NO HAY USUARIOS');
    } else {
      users.forEach(u => {
        console.log(`   - [${u.rol.padEnd(10)}] ${u.email.padEnd(40)} username=${u.username}  nombre="${u.nombre || '-'}"  cedula=${u.cedula || '-'}  activo=${u.activo}  createdAt=${u.createdAt.toISOString().slice(0,10)}`);
      });
    }

    // 4. Clientes (con email y telefono)
    console.log('\n👥 Clientes en Neon (primeros 20):');
    let clientes = [];
    try {
      clientes = await prisma.cliente.findMany({
        select: { id: true, nombre: true, email: true, telefono: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {
      console.log('   (error al leer clientes:', e.message.slice(0, 80), ')');
    }
    if (clientes.length === 0) {
      console.log('   ⚠️  NO HAY CLIENTES');
    } else {
      clientes.forEach(c => {
        console.log(`   - ${c.nombre.padEnd(30)} email=${(c.email || '-').padEnd(35)} tel=${c.telefono || '-'}`);
      });
    }
    const totalClientes = await prisma.cliente.count();
    console.log(`   TOTAL Clientes: ${totalClientes}`);

    // 5. PlataformaSync
    console.log('\n📊 PlataformaSync en Neon:');
    const ps = await prisma.plataformaSync.findMany();
    if (ps.length === 0) {
      console.log('   ⚠️  NO HAY REGISTROS EN PlataformaSync');
    } else {
      ps.forEach(p => {
        console.log(`   - ${p.plataforma.padEnd(10)} sincronizado=${p.sincronizado}  ultimoEstado=${p.ultimoEstado || '-'}  ultimoSync=${p.ultimoSync ? p.ultimoSync.toISOString() : '-'}`);
      });
    }

    // 6. Últimos AuditLogs
    console.log('\n📜 Últimos 10 AuditLogs:');
    const logs = await prisma.auditLog.findMany({
      orderBy: { fecha: 'desc' },
      take: 10,
      select: { accion: true, fecha: true, exito: true, usuarioNombre: true }
    });
    if (logs.length === 0) {
      console.log('   (sin audit logs)');
    } else {
      logs.forEach(l => {
        console.log(`   - ${l.fecha.toISOString().slice(0,19)}  ${l.accion}  exito=${l.exito}  user=${l.usuarioNombre || '-'}`);
      });
    }

    // 7. AccesoPortal (credenciales de portales)
    console.log('\n🔑 AccesoPortal (portales cliente):');
    const ap = await prisma.accesoPortal.findMany({
      select: { id: true, clienteId: true, pin: true, activo: true, createdAt: true }
    });
    if (ap.length === 0) {
      console.log('   ⚠️  NO HAY AccesoPortal');
    } else {
      ap.slice(0, 20).forEach(a => {
        console.log(`   - clienteId=${a.clienteId}  pin=***  activo=${a.activo}  createdAt=${a.createdAt.toISOString().slice(0,10)}`);
      });
      if (ap.length > 20) console.log(`   ... y ${ap.length - 20} más`);
      console.log(`   TOTAL AccesoPortal: ${ap.length}`);
    }

    await prisma.$disconnect();
    console.log('\n✅ Verificación Neon completada.');
  } catch (e) {
    console.error('❌ Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
