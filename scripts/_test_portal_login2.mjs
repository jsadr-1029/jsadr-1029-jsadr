// Test with debeCambiarClave = false to get actual token
const testClients = ['43043108', '1017215496', '1100012073'];

console.log('=== Testing portal login (full response) ===');
for (const cedula of testClients) {
  const res = await fetch('https://jsadr.com.co/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
    body: JSON.stringify({ cedula, clave: cedula }),
  });
  const json = await res.json();
  console.log(`CC ${cedula}:`, JSON.stringify(json).substring(0, 200));
}
