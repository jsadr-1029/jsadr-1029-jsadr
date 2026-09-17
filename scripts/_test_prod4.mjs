// Full test of all endpoints
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j4 = await r4.json();
const token = j4.data.access_token;

console.log('=== Test ALL endpoints ===');
const endpoints = [
  '/api/prestamos',
  '/api/notificaciones',
  '/api/dashboard',
  '/api/pagos',
  '/api/pagos/informe?periodo=mes',
];

for (const ep of endpoints) {
  const r = await fetch(`https://jsadr.com.co${ep}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
  });
  const status = r.status;
  if (r.ok) {
    const j = await r.json();
    console.log(`✅ ${ep} → ${status} (success=${j.success}, items=${j.data?.length ?? 'N/A'})`);
  } else {
    const text = await r.text();
    console.log(`❌ ${ep} → ${status} ${text.substring(0, 150)}`);
  }
}
