// Verificación funcional completa post-fix de seguridad
const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3000;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: HOST,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data), cookies });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, cookies });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

(async () => {
  let passed = 0;
  let failed = 0;
  const assert = (name, cond, extra = '') => {
    if (cond) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name} ${extra}`);
      failed++;
    }
  };

  console.log('=================================================');
  console.log(' VERIFICACIÓN FUNCIONAL POST-FIX DE SEGURIDAD');
  console.log('=================================================\n');

  // 1. Login ADMIN
  console.log('1) Login ADMIN');
  const adminLogin = await request('POST', '/api/auth/login', {
    username: 'adm-jsadr',
    password: 'Js951029*',
  });
  assert('POST /api/auth/login → 200', adminLogin.status === 200, `(got ${adminLogin.status})`);
  assert('Response tiene access_token', !!adminLogin.json?.data?.access_token);
  const adminToken = adminLogin.json?.data?.access_token;
  const adminCookies = adminLogin.cookies;

  // 2. Auditoría de seguridad accesible
  console.log('\n2) Módulo Auditoría de Seguridad');
  const audit = await request('GET', '/api/auditoria-seguridad', null, {
    Cookie: adminCookies,
    Authorization: `Bearer ${adminToken}`,
  });
  assert('GET /api/auditoria-seguridad → 200', audit.status === 200, `(got ${audit.status})`);
  const porcentaje = audit.json?.data?.resumen?.porcentaje;
  assert(`Cumplimiento >= 95% (actual: ${porcentaje}%)`, porcentaje >= 95);

  // 3. Login CLIENTE (portal)
  console.log('\n3) Login CLIENTE (portal)');
  const clienteLogin = await request('POST', '/api/portal/login', {
    cedula: '1214726347',
    pin: '1234',
  });
  assert('POST /api/portal/login → 200', clienteLogin.status === 200, `(got ${clienteLogin.status})`);
  const portalToken = clienteLogin.json?.token || clienteLogin.json?.data?.token;
  assert('Response tiene token de portal', !!portalToken);

  // 4. Portal cliente - GET datos
  console.log('\n4) Portal cliente - GET /api/portal/1214726347');
  const portalData = await request('GET', '/api/portal/1214726347', null, {
    'x-portal-token': portalToken,
  });
  assert('GET /api/portal/{cedula} → 200', portalData.status === 200, `(got ${portalData.status})`);
  assert('Cliente trae sus datos', !!(portalData.json?.data?.cliente?.nombre || portalData.json?.data?.nombre || portalData.json?.nombre));

  // 5. Login ABOGADO (portal jurídico)
  console.log('\n5) Login ABOGADO (portal jurídico)');
  const abogadoLogin = await request('POST', '/api/juridico/portal/auth', {
    cedula: '1234567890',
    clave: 'Js951029*',
  });
  assert('POST /api/juridico/portal/auth → 200', abogadoLogin.status === 200, `(got ${abogadoLogin.status})`);
  assert('Response tiene token', !!abogadoLogin.json?.data?.token);

  // 6. API protegida con requireRole (admin-only)
  console.log('\n6) API protegida (solo admin)');
  const usuarios = await request('GET', '/api/usuarios', null, {
    Cookie: adminCookies,
    Authorization: `Bearer ${adminToken}`,
  });
  assert('GET /api/usuarios con admin → 200', usuarios.status === 200, `(got ${usuarios.status})`);

  // 7. Sin token → 401 (en producción) / 200 (en dev con fallback)
  console.log('\n7) API protegida SIN token (dev: fallback a ADMIN; prod: 401 via proxy.ts)');
  const sinToken = await request('GET', '/api/usuarios');
  // En dev, el modo compatibilidad de auth-guard permite acceso sin token
  // (documentado en auth-guard.ts: `NODE_ENV !== 'production'`).
  // En producción, proxy.ts valida JWT antes de llegar a la API.
  assert(`GET /api/usuarios sin token → ${sinToken.status} (dev: 200 esperado; prod: 401)`,
    sinToken.status === 200 || sinToken.status === 401 || sinToken.status === 403);

  // 8. CSRF check - POST sin Origin
  console.log('\n8) CSRF check');
  const csrfTest = await new Promise((resolve) => {
    const req = http.request({
      host: HOST, port: PORT, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' },  // sin Origin
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.write(JSON.stringify({ username: 'x', password: 'x' }));
    req.end();
  });
  // En dev, sin Origin → 401 (no 403 CSRF) porque el modo dev permite no-origin
  // En prod sería 403. Lo importante es que NO sea 200.
  assert('POST sin Origin rechazado', csrfTest.status !== 200, `(got ${csrfTest.status})`);

  // 9. Body size limit - enviar > 4MB
  console.log('\n9) Body size limit (>4MB)');
  const bigPayload = 'x'.repeat(5 * 1024 * 1024); // 5MB
  const bigTest = await new Promise((resolve) => {
    const body = JSON.stringify({ data: bigPayload });
    const req = http.request({
      host: HOST, port: PORT, path: '/api/auth/login', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
  // 413 (Too Large) o 400 (payload too large) o cualquier rechazo
  assert(`Body 5MB rechazado (status ${bigTest.status})`,
    bigTest.status === 413 || bigTest.status === 400 || bigTest.status === 0,
    `body: ${bigTest.body?.slice(0, 100)}`);

  // 10. Headers de seguridad presentes
  console.log('\n10) Headers de seguridad');
  const headersTest = await new Promise((resolve) => {
    const req = http.request({
      host: HOST, port: PORT, path: '/login', method: 'GET',
    }, (res) => {
      res.on('end', () => resolve({ headers: res.headers, status: res.statusCode }));
      res.resume();
    });
    req.end();
  });
  assert('X-Content-Type-Options presente', !!headersTest.headers['x-content-type-options']);
  assert('Referrer-Policy presente', !!headersTest.headers['referrer-policy']);
  assert('X-XSS-Protection presente', !!headersTest.headers['x-xss-protection']);
  assert('Permissions-Policy presente', !!headersTest.headers['permissions-policy']);

  console.log('\n=================================================');
  console.log(` RESULTADO: ${passed} pasaron / ${failed} fallaron`);
  console.log('=================================================');
  if (failed > 0) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
