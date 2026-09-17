// Final test of all production endpoints
console.log('=== Login ===');
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j4 = await r4.json();
const token = j4.data?.access_token;

if (token) {
  console.log('✅ Login OK');
  
  const endpoints = ['/api/prestamos', '/api/notificaciones', '/api/dashboard', '/api/pagos'];
  for (const ep of endpoints) {
    const r = await fetch(`https://jsadr.com.co${ep}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
    });
    if (r.ok) {
      const j = await r.json();
      console.log(`✅ ${ep} → ${r.status} (items=${j.data?.length ?? 'N/A'})`);
    } else {
      const text = await r.text();
      console.log(`❌ ${ep} → ${r.status} ${text.substring(0, 100)}`);
    }
  }
} else {
  console.log('❌ Login failed:', JSON.stringify(j4));
}
