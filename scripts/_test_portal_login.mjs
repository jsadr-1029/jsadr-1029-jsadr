// Test portal login for a few clients
const testClients = [
  { cedula: '43043108', nombre: 'Ana Maria Ocampo' },
  { cedula: '1017215496', nombre: 'David Roldan' },
  { cedula: '1100012073', nombre: 'Dana Luz Manjarrez' },
  { cedula: '1038627025', nombre: 'Vanesa Patiño' },
  { cedula: '1214731649', nombre: 'Johan Alvarez' },
];

console.log('=== Testing portal login ===');
for (const tc of testClients) {
  const res = await fetch('https://jsadr.com.co/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
    body: JSON.stringify({ cedula: tc.cedula, clave: tc.cedula }),
  });
  const json = await res.json();
  if (json.success) {
    console.log(`✅ ${tc.nombre} (CC ${tc.cedula}) - Login OK, token: ${json.data?.token?.substring(0, 15)}...`);
  } else if (json.codigo === 'CAMBIO_CLAVE_OBLIGATORIO') {
    console.log(`⚠️ ${tc.nombre} (CC ${tc.cedula}) - Debe cambiar clave (esperado, primer login)`);
  } else {
    console.log(`❌ ${tc.nombre} (CC ${tc.cedula}) - ${json.error || json.codigo}`);
  }
}
