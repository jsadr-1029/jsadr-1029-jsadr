// Obtiene el reporte completo de auditoría de seguridad y lo imprime en formato legible
const fs = require('fs');
const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3000;

function login(username, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username, password });
    const req = http.request({
      host: HOST,
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        try {
          const json = JSON.parse(data);
          resolve({ cookies, json, status: res.statusCode });
        } catch (e) {
          resolve({ cookies, raw: data, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(cookies, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      path,
      method: 'GET',
      headers: { Cookie: cookies, Origin: 'http://localhost:3000' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const loginRes = await login('adm-jsadr', 'Js951029*');
  console.log('Login status:', loginRes.status);
  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.raw || loginRes.json);
    process.exit(1);
  }
  // Guardar cookie para reusar
  fs.writeFileSync('/tmp/admin_cookie.txt', loginRes.cookies);
  console.log('Cookie guardada en /tmp/admin_cookie.txt');

  const audit = await get(loginRes.cookies, '/api/auditoria-seguridad');
  if (audit.status !== 200) {
    console.error('Audit fetch failed:', audit.status, audit.raw || audit.json);
    process.exit(1);
  }

  const hallazgos = audit.json.data.hallazgos || [];
  const resumen = audit.json.data.resumen || {};
  const score = audit.json.data.score || audit.json.data.porcentaje || null;

  console.log('\n=================================================');
  console.log(' REPORTE DE AUDITORÍA DE SEGURIDAD');
  console.log('=================================================');
  console.log(`Total hallazgos: ${hallazgos.length}`);
  console.log('Resumen:', JSON.stringify(resumen, null, 2));
  if (score !== null) console.log('Score:', JSON.stringify(score, null, 2));

  // Agrupar por estado
  const porEstado = {};
  for (const h of hallazgos) {
    const e = h.estado || '?';
    if (!porEstado[e]) porEstado[e] = [];
    porEstado[e].push(h);
  }
  console.log('\n--- Por estado ---');
  for (const [e, arr] of Object.entries(porEstado)) {
    console.log(`${e} : ${arr.length}`);
  }

  // Detallar los que NO cumplen (no son 🟢)
  console.log('\n=================================================');
  console.log(' HALLAZGOS NO COMPLACIENTES (estado != 🟢)');
  console.log('=================================================');
  for (const h of hallazgos) {
    if (h.estado === '🟢') continue;
    console.log('\n------------------------------------------');
    console.log(`Control:    ${h.control}`);
    console.log(`Estado:     ${h.estado}`);
    console.log(`Riesgo:     ${h.riesgo}`);
    console.log(`Prioridad:  ${h.prioridad}`);
    console.log(`Evidencia:  ${h.evidencia}`);
    console.log(`Explicación: ${h.explicacion}`);
    console.log(`Escenario:  ${h.escenario}`);
    console.log(`Recomendación: ${h.recomendacion}`);
  }

  // Guardar JSON completo para análisis
  fs.writeFileSync('/tmp/audit_full.json', JSON.stringify(audit.json, null, 2));
  console.log('\n--- JSON completo guardado en /tmp/audit_full.json ---');
})().catch(e => { console.error(e); process.exit(1); });
