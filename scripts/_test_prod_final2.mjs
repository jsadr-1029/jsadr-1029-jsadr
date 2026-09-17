// Final production test
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
      const count = j.data?.length ?? 'N/A';
      console.log(`✅ ${ep} → ${r.status} (items=${count})`);
      if (ep === '/api/prestamos' && j.data?.length > 0) {
        j.data.forEach(p => console.log(`  → ${p.codigo} | ${p.estado} | ${p.cliente?.nombre || 'N/A'}`));
      }
    } else {
      console.log(`❌ ${ep} → ${r.status}`);
    }
  }
} else {
  console.log('❌ Login failed');
}
