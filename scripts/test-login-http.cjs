#!/usr/bin/env node
// =====================================================
// test-login-http.cjs
// =====================================================
// Prueba los 3 flujos de login vía HTTP real contra el
// servidor dev que corre en localhost:3000:
//   1) /api/auth/login          (sistema admin/gestor/consultor/abogado)
//   2) /api/portal/login        (cliente: cédula + PIN)
//   3) /api/juridico/portal/auth (abogado: cédula + clave)
// =====================================================

const BASE = 'http://localhost:3000';

async function post(path, body) {
  const start = Date.now();
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { _raw: text }; }
    return { status: r.status, ok: r.ok, json, ms: Date.now() - start };
  } catch (e) {
    return { status: 0, ok: false, error: e.message, ms: Date.now() - start };
  }
}

async function main() {
  console.log('=====================================================');
  console.log(' TEST HTTP DE LOGIN — servidor dev en localhost:3000');
  console.log('=====================================================\n');

  // ===== 1) USUARIOS DEL SISTEMA =====
  console.log('--- 1) /api/auth/login (sistema) ---');
  const usuariosSistema = [
    { username: 'adm-jsadr',       rol: 'ADMIN' },
    { username: 'gestor-jsadr',    rol: 'GESTOR' },
    { username: 'consultor-jsadr', rol: 'CONSULTOR' },
    { username: 'abogado-jsadr',   rol: 'ABOGADO' },
  ];
  for (const u of usuariosSistema) {
    const r = await post('/api/auth/login', { username: u.username, password: 'Js951029*' });
    const ok = r.ok && r.json?.success && (r.json?.data?.access_token || r.json?.requiresMFA);
    console.log(`  ${ok ? '✅' : '❌'} [${u.rol}] @${u.username.padEnd(20)} → HTTP ${r.status} (${r.ms}ms) ${ok ? 'LOGIN OK' : JSON.stringify(r.json?.error || r.json)}`);
  }

  // ===== 2) CLIENTES (portal cliente) =====
  console.log('\n--- 2) /api/portal/login (cliente cédula+PIN) ---');
  const clientes = [
    { cedula: '1214726347', nombre: 'CAROLINA ALVAREZ' },
    { cedula: '1214731649', nombre: 'JOHAN ALVAREZ' },   // el que estaba roto
    { cedula: '123456789',  nombre: 'juaquin' },
    { cedula: '8888888888', nombre: 'Test Gestor OK' },
    { cedula: '9000000002', nombre: 'prueba jsadr23' },
    { cedula: '9000000004', nombre: 'prueba johan-1029' },
    { cedula: '9000000005', nombre: 'prueba jsadr29' },
  ];
  for (const c of clientes) {
    const r = await post('/api/portal/login', { cedula: c.cedula, pin: '1234' });
    const ok = r.ok && r.json?.success && r.json?.token;
    console.log(`  ${ok ? '✅' : '❌'} ${c.cedula.padEnd(14)} | ${c.nombre.padEnd(25)} → HTTP ${r.status} (${r.ms}ms) ${ok ? 'LOGIN OK' : JSON.stringify(r.json?.error || r.json)}`);
  }

  // ===== 3) PORTAL JURÍDICO =====
  console.log('\n--- 3) /api/juridico/portal/auth (abogado cédula+clave) ---');
  // abogado-jsadr tiene cedula=1234567890
  const r = await post('/api/juridico/portal/auth', { cedula: '1234567890', clave: 'Js951029*' });
  const ok = r.ok && r.json?.success;
  console.log(`  ${ok ? '✅' : '❌'} abogado-jsadr (cedula=1234567890) → HTTP ${r.status} (${r.ms}ms) ${ok ? 'LOGIN OK' : JSON.stringify(r.json?.error || r.json)}`);

  console.log('\n=====================================================');
  console.log(' Test HTTP completado');
  console.log('=====================================================');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
