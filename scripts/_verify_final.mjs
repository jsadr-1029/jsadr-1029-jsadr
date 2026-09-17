// Wait for Vercel to deploy
console.log('Waiting 80 seconds for Vercel deploy...');
await new Promise(r => setTimeout(r, 80000));

// Test login
console.log('=== Testing production ===');
const r = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j = await r.json();
const token = j.data?.access_token;

if (token) {
  console.log('✅ Login OK');
  
  const endpoints = ['/api/prestamos', '/api/dashboard', '/api/pagos', '/api/notificaciones'];
  for (const ep of endpoints) {
    const res = await fetch(`https://jsadr.com.co${ep}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
    });
    if (res.ok) {
      const data = await res.json();
      const count = data.data?.length ?? 'N/A';
      console.log(`✅ ${ep} → ${res.status} (items=${count})`);
      if (ep === '/api/prestamos' && data.data?.length > 0) {
        data.data.forEach(p => console.log(`  → ${p.codigo} | ${p.estado} | ${p.cliente?.nombre || ''}`));
      }
    } else {
      console.log(`❌ ${ep} → ${res.status}`);
    }
  }
} else {
  console.log('❌ Login failed:', JSON.stringify(j));
}
