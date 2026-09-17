const r = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
console.log('Status:', r.status);
const j = await r.json();
if (j.success || j.data?.access_token) {
  console.log('✅ Login OK! Token:', j.data?.access_token?.substring(0, 20) || 'N/A');
  
  // Test endpoints
  const token = j.data?.access_token;
  const endpoints = ['/api/prestamos', '/api/dashboard', '/api/pagos', '/api/clientes'];
  for (const ep of endpoints) {
    const res = await fetch(`https://jsadr.com.co${ep}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
    });
    const data = await res.json();
    console.log(`${res.ok ? '✅' : '❌'} ${ep} → ${res.status} (${data.data?.length ?? 'N/A'} items)`);
  }
  
  // Test portal login
  const pr = await fetch('https://jsadr.com.co/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
    body: JSON.stringify({ cedula: '43043108', clave: '43043108' }),
  });
  const pj = await pr.json();
  console.log(`${pj.success ? '✅' : '❌'} Portal login (Ana Maria): ${pj.success ? 'OK' : pj.error || pj.codigo}`);
} else {
  console.log('❌ Login failed:', JSON.stringify(j).substring(0, 300));
}
