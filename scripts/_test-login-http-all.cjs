// Pruebas HTTP de login contra la app en localhost:3000
const http = require('http');

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('=== PRUEBAS LOGIN USUARIOS SISTEMA (/api/auth/login) ===\n');

  const usuarios = [
    { username: 'Adm-Jsadr', password: 'Js951029*' },
    { username: 'gestor-jsadr', password: 'Js951029*' },
    { username: 'consultor-jsadr', password: 'Js951029*' },
    { username: 'abogado-jsadr', password: 'Js951029*' },
    { username: 'P_jsadr', password: '731649' },
    { username: 'JD_jsadr', password: '731649' },
    { username: 'Jd_jsadr', password: '731649' },
  ];

  for (const u of usuarios) {
    const r = await post('/api/auth/login', { ...u, step: 1 });
    const ok = r.status === 200 && r.body && (r.body.success || r.body.requiresMFA || r.body.tempToken);
    console.log(`  ${u.username.padEnd(20)} | pw=${u.password.padEnd(12)} | HTTP ${r.status} ${ok ? 'OK' : 'FAIL'} | ${r.body && (r.body.error || r.body.message || (r.body.requiresMFA ? 'requiresMFA' : r.body.success ? 'success' : JSON.stringify(r.body).substring(0,80)))}`);
  }

  console.log('\n=== PRUEBAS LOGIN PORTAL JURÍDICO (/api/juridico/portal/auth) ===\n');
  const juridicos = [
    { cedula: '1234567890', clave: 'Js951029*' },  // abogado-jsadr
    { cedula: 'JD_jsadr', clave: '731649' },        // JD_jsadr
    { cedula: 'Jd_jsadr', clave: '731649' },        // Jd_jsadr
  ];
  for (const u of juridicos) {
    const r = await post('/api/juridico/portal/auth', u);
    const ok = r.status === 200 && r.body && r.body.success;
    console.log(`  cedula=${u.cedula.padEnd(15)} | clave=${u.clave.padEnd(12)} | HTTP ${r.status} ${ok ? 'OK' : 'FAIL'} | ${r.body && (r.body.error || (r.body.success ? 'success' : JSON.stringify(r.body).substring(0,80)))}`);
  }

  console.log('\n=== PRUEBAS LOGIN CLIENTES PORTAL (/api/portal/login) — PIN ===\n');
  const clientes = [
    { cedula: '123456789', pin: '1234' },
    { cedula: '1214731649', pin: '1234' },
    { cedula: '1214726347', pin: '1234' },
    { cedula: '9000000002', pin: '1234' },
    { cedula: '9000000004', pin: '1234' },
    { cedula: '9000000005', pin: '1234' },
    { cedula: '8888888888', pin: '1234' },
    { cedula: '888888888', pin: '1234' },
  ];
  for (const c of clientes) {
    const r = await post('/api/portal/login', c);
    const ok = r.status === 200 && r.body && r.body.success;
    console.log(`  cedula=${c.cedula.padEnd(12)} | pin=${c.pin} | HTTP ${r.status} ${ok ? 'OK' : 'FAIL'} | ${r.body && (r.body.error || (r.body.success ? 'success' : JSON.stringify(r.body).substring(0,80)))}`);
  }

  console.log('\n=== BÚSQUEDA: ruta de login con clave alfanumérica ===\n');
  // Buscar ruta adicional para clientes con clave
  const r = await post('/api/portal/auth', { cedula: '123456789', clave: '1234' });
  console.log(`  /api/portal/auth | HTTP ${r.status} | ${JSON.stringify(r.body).substring(0,150)}`);
})();
