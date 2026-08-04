// Test Vercel login simulating a real browser (with Origin header)
const VERCEL_URL = 'https://jsadr-1029-jsadr.vercel.app';
const ORIGIN = VERCEL_URL;

async function tryLogin(username, password) {
  const res = await fetch(`${VERCEL_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': ORIGIN,
      'Referer': `${ORIGIN}/`,
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ username, password, step: 1 }),
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 300); }
  console.log(`  ${username}/${password} → HTTP ${res.status} →`, JSON.stringify(parsed).slice(0, 250));
  return res.status;
}

async function tryPortalCedula(cedula) {
  const res = await fetch(`${VERCEL_URL}/api/portal/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': ORIGIN,
      'Referer': `${ORIGIN}/`,
    },
    body: JSON.stringify({ accion: 'verificar_cedula', cedula }),
  });
  const txt = await res.text();
  console.log(`  Portal cedula=${cedula} → HTTP ${res.status} →`, txt.slice(0, 300));
}

console.log('=== Login test on Vercel (with proper Origin header) ===\n');
console.log('Trying admin users with several common passwords:');
const users = ['adm-jsadr', 'gestor-jsadr', 'consultor-jsadr', 'abogado-jsadr', 'admin'];
const passwords = ['Jsadr2025$', 'Jsadr2025', 'jsadr2025', 'Jsadr123!', 'admin', 'Admin123!', '12345678'];

for (const u of users) {
  for (const p of passwords) {
    const status = await tryLogin(u, p);
    if (status === 200) break;
  }
}

console.log('\n=== Portal cliente tests ===');
// Try some sample cedulas
const cedulas = ['1037629541', '1036628455', '1214731649'];
for (const c of cedulas) {
  await tryPortalCedula(c);
}

console.log('\n=== Test a public API to check if Prisma works on Vercel ===');
// This endpoint should work if Prisma+Neon is correctly configured
const res = await fetch(`${VERCEL_URL}/api/simulador`, {
  headers: { 'Origin': ORIGIN },
});
console.log(`  GET /api/simulador → HTTP ${res.status}`);
if (!res.ok) {
  console.log(`  Body: ${(await res.text()).slice(0, 400)}`);
}
