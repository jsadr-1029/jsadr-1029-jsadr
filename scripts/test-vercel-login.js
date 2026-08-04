// Test the actual Vercel login endpoint to capture the error
const VERCEL_URL = 'https://jsadr-1029-jsadr.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function testLogin(baseUrl, label) {
  console.log(`\n=== Test login @ ${label} (${baseUrl}) ===`);
  try {
    // Probe a public endpoint first
    const probe = await fetch(`${baseUrl}/api/auth/login`, { method: 'GET' });
    console.log(`  GET /api/auth/login → HTTP ${probe.status}`);

    // Try a login with a known admin credential (won't succeed but we want to see the error message)
    const testCreds = [
      { username: 'admin', password: 'admin123' },
      { username: 'admin', password: 'Admin123!' },
      { username: 'admin', password: '12345678' },
    ];
    for (const c of testCreds) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, step: 1 }),
      });
      const txt = await res.text();
      let parsed;
      try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 200); }
      console.log(`  POST login ${c.username}/${c.password} → HTTP ${res.status} →`, parsed);
      if (res.status === 200) break;
    }

    // Also try the portal login
    const portal = await fetch(`${baseUrl}/api/portal/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'verificar_cedula', cedula: '0000000000' }),
    });
    const pt = await portal.text();
    let pp;
    try { pp = JSON.parse(pt); } catch { pp = pt.slice(0, 200); }
    console.log(`  POST portal verificar_cedula → HTTP ${portal.status} →`, pp);
  } catch (err) {
    console.log(`  ❌ Network error: ${err.message}`);
  }
}

await testLogin(VERCEL_URL, 'VERCEL PRODUCCIÓN');
await testLogin(LOCAL_URL, 'LOCAL');
