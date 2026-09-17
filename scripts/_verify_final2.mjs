console.log('Waiting 80 seconds for Vercel deploy...');
await new Promise(r => setTimeout(r, 80000));

console.log('=== Testing production ===');
const r = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j = await r.json();
const token = j.data?.access_token;

if (token) {
  console.log('✅ Admin login OK');
  
  const endpoints = ['/api/prestamos', '/api/dashboard', '/api/pagos', '/api/notificaciones', '/api/clientes'];
  for (const ep of endpoints) {
    const res = await fetch(`https://jsadr.com.co${ep}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ ${ep} → ${res.status} (items=${data.data?.length ?? 'N/A'})`);
    } else {
      console.log(`❌ ${ep} → ${res.status}`);
    }
  }
  
  // Test portal login for a client
  console.log('\n=== Testing portal login ===');
  const pr = await fetch('https://jsadr.com.co/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
    body: JSON.stringify({ cedula: '43043108', clave: '43043108' }),
  });
  const pj = await pr.json();
  console.log(`Portal login (Ana Maria Ocampo): ${pj.success ? '✅ OK' : '❌ ' + (pj.error || pj.codigo)}`);
  
  const pr2 = await fetch('https://jsadr.com.co/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
    body: JSON.stringify({ cedula: '1017215496', clave: '1017215496' }),
  });
  const pj2 = await pr2.json();
  console.log(`Portal login (David Roldan): ${pj2.success ? '✅ OK' : '❌ ' + (pj2.error || pj2.codigo)}`);
} else {
  console.log('❌ Admin login failed');
}
