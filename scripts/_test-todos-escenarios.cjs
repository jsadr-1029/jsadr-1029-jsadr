// Pruebas integrales: OTP portal + recuperación de clave + notificación masiva
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

function post(path, body, token) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST', headers, timeout: 30000
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch (e) { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' PRUEBAS INTEGRALES DE CORREO — 3 ESCENARIOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1) LOGIN ADMIN
  console.log('─── 1) LOGIN ADMIN ───');
  const login = await post('/api/auth/login', { username: 'Adm-Jsadr', password: 'Js951029*', step: 1 });
  if (!login.body.success) { console.log('❌ Login falla:', login.body); return; }
  const token = login.body.data.access_token;
  console.log('✅ Admin logueado\n');

  // 2) ESCENARIO A: RECUPERACIÓN DE CLAVE (envía correo con password temporal)
  console.log('─── ESCENARIO A: RECUPERACIÓN DE CLAVE (/api/auth/recuperar-clave) ───');
  // Probar para cada usuario del sistema con email real
  const usuariosParaReset = [
    { identificador: 'abogado@jsadr.com.co', desc: 'abogado-jsadr (email)' },
    { identificador: 'admin@jsadr.co', desc: 'Adm-Jsadr (email)' },
    { identificador: 'gestor@empresa.com', desc: 'gestor-jsadr (email)' },
    { identificador: 'consultor@empresa.com', desc: 'consultor-jsadr (email)' },
    { identificador: '1214731649', desc: 'cliente JOHAN ALVAREZ (cédula)' },
    { identificador: '1214726347', desc: 'cliente CAROLINA ALVAREZ (cédula)' },
  ];

  for (const u of usuariosParaReset) {
    console.log(`  → ${u.desc}...`);
    const r = await post('/api/auth/recuperar-clave', { identificador: u.identificador });
    const ok = r.status === 200 && r.body && r.body.success;
    console.log(`    ${ok ? '✅' : '⚠️'} HTTP ${r.status} | ${r.body.message || r.body.error || JSON.stringify(r.body).substring(0, 100)}`);
    // 5s entre requests para no violar rate limit
    await new Promise(r => setTimeout(r, 6000));
  }
  console.log();

  // 3) ESCENARIO B: OTP DEL PORTAL (solicitar OTP para firma de préstamo)
  console.log('─── ESCENARIO B: OTP PORTAL (/api/portal/solicitar-otp) ───');
  // Buscar firmas pendientes en BD
  const firmas = await prisma.firmaElectronica.findMany({
    where: { otpValidado: false },
    include: { prestamo: { include: { cliente: true } } },
    take: 5
  });
  console.log(`  Firmas con OTP pendiente en BD: ${firmas.length}`);

  if (firmas.length === 0) {
    // Crear una firma de prueba
    console.log('  → No hay firmas pendientes. Creando firma de prueba...');
    const prestamo = await prisma.prestamo.findFirst({
      where: { estado: 'ACTIVO' },
      include: { cliente: true }
    });
    if (prestamo) {
      const nuevaFirma = await prisma.firmaElectronica.create({
        data: {
          prestamoId: prestamo.id,
          clienteId: prestamo.clienteId,
          otpCodigo: null,
          otpValidado: false,
          intentosOTP: 0,
          maxIntentos: 5,
          estadoFirma: 'PENDIENTE_OTP',
          fechaSolicitudOtp: null,
          ipSolicitud: null,
          userAgentSolicitud: null,
          fechaFirma: null,
          hashDocumento: 'test-hash-email-' + Date.now(),
          metadata: { test: true }
        }
      });
      console.log(`  → Firma creada: ${nuevaFirma.id} (cliente: ${prestamo.cliente.nombre})`);
      const r = await post('/api/portal/solicitar-otp', { firmaId: nuevaFirma.id });
      console.log(`    ${r.status === 200 ? '✅' : '❌'} HTTP ${r.status} | ${r.body.message || r.body.error || JSON.stringify(r.body).substring(0, 150)}`);
    }
  } else {
    for (const f of firmas.slice(0, 3)) {
      const r = await post('/api/portal/solicitar-otp', { firmaId: f.id });
      console.log(`    ${r.status === 200 ? '✅' : '❌'} HTTP ${r.status} | ${r.body.message || r.body.error || JSON.stringify(r.body).substring(0, 150)}`);
    }
  }
  console.log();

  // 4) ESCENARIO C: NOTIFICACIONES MASIVAS (POST /api/notificaciones)
  console.log('─── ESCENARIO C: NOTIFICACIONES MASIVAS (/api/notificaciones) ───');
  const acciones = ['recordatorios', 'mora'];
  for (const accion of acciones) {
    console.log(`  → Acción: ${accion}`);
    const r = await post('/api/notificaciones', { accion }, token);
    const ok = r.status === 200 && r.body && r.body.success;
    console.log(`    ${ok ? '✅' : '❌'} HTTP ${r.status} | enviadas=${r.body.enviadas || 0} | fallidas=${r.body.fallidas || 0} | ${r.body.error || ''}`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' PRUEBAS COMPLETADAS');
  console.log('═══════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
})();
