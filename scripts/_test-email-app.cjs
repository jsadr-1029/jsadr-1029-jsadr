// Test integral: login admin, probar SMTP, enviar correo de prueba a clientes
const http = require('http');

function post(path, body, token) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers,
      timeout: 30000
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

function get(path, token) {
  return new Promise((resolve) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers,
      timeout: 30000
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
    req.end();
  });
}

(async () => {
  console.log('=== 1) LOGIN ADMIN ===');
  const login = await post('/api/auth/login', { username: 'Adm-Jsadr', password: 'Js951029*', step: 1 });
  if (!login.body.success) {
    console.log('❌ Login falla:', login.body);
    return;
  }
  const token = login.body.data.access_token;
  console.log('✅ Token admin:', token.substring(0, 40) + '...');
  console.log();

  console.log('=== 2) PROBAR CONEXIÓN SMTP (GET /api/email) ===');
  const cfg = await get('/api/email', token);
  console.log('SMTP configurado:', cfg.body.smtpConfigurado, '| msg:', cfg.body.message);
  console.log();

  console.log('=== 3) PROBAR SMTP (POST /api/email accion=probar) ===');
  const probe = await post('/api/email', { accion: 'probar' }, token);
  console.log('Resultado:', JSON.stringify(probe.body, null, 2).substring(0, 600));
  console.log();

  console.log('=== 4) ENVIAR CORREO DE PRUEBA A CLIENTES ===');
  const destinos = [
    { email: 'jsadr23@gmail.com', nombre: 'JOHAN ALVAREZ' },
    { email: 'jsadr29@gmail.com', nombre: 'prueba jsadr29' },
    { email: 'jhoan-1029@hotmail.com', nombre: 'juaquin' },
    { email: 'johan-1029@hotmail.com', nombre: 'prueba johan-1029' },
    { email: 'jsadr23@outlook.com', nombre: 'prueba jsadr23' },
  ];

  for (const d of destinos) {
    console.log(`  → Enviando a ${d.email}...`);
    const r = await post('/api/email', { accion: 'enviar-prueba', to: d.email }, token);
    const ok = r.body && r.body.success;
    const ethereal = r.body && r.body.isEthereal;
    console.log(`    ${ok ? '✅' : '❌'} HTTP ${r.status} | ${ok ? (ethereal ? 'ETHEREAL (no real)' : 'BREVO REAL') : ''} | msgId=${r.body.messageId || '-'} | err=${r.body.error || '-'}`);
  }
})();
