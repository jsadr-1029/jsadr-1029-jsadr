// Test the production endpoint by calling it directly
// We'll use a fake token first to see if it returns 401 (good) or 500 (bad)

console.log('=== Test 1: /api/prestamos (sin token) ===');
const r1 = await fetch('https://jsadr.com.co/api/prestamos');
console.log(`Status: ${r1.status}`);
const j1 = await r1.json();
console.log(`Response: ${JSON.stringify(j1)}`);

console.log('\n=== Test 2: /api/notificaciones (sin token) ===');
const r2 = await fetch('https://jsadr.com.co/api/notificaciones');
console.log(`Status: ${r2.status}`);
const j2 = await r2.json();
console.log(`Response: ${JSON.stringify(j2)}`);

console.log('\n=== Test 3: /api/dashboard (sin token) ===');
const r3 = await fetch('https://jsadr.com.co/api/dashboard');
console.log(`Status: ${r3.status}`);
const j3 = await r3.json();
console.log(`Response: ${JSON.stringify(j3)}`);

// Now let's try to get the actual error by hitting with an admin login
console.log('\n=== Test 4: Login as admin ===');
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
console.log(`Status: ${r4.status}`);
const j4 = await r4.json();
if (j4.success) {
  console.log('Login OK, testing /api/prestamos with token...');
  const token = j4.access_token;
  
  const r5 = await fetch('https://jsadr.com.co/api/prestamos', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(`\n=== Test 5: /api/prestamos (con token admin) ===`);
  console.log(`Status: ${r5.status}`);
  if (r5.ok) {
    const j5 = await r5.json();
    console.log(`Success: ${j5.success}`);
    console.log(`Total préstamos: ${j5.data?.length || 0}`);
    if (j5.data?.length > 0) {
      console.log(`Primer préstamo: ${j5.data[0].codigo} - ${j5.data[0].cliente?.nombre}`);
    }
  } else {
    const text = await r5.text();
    console.log(`Error: ${text.substring(0, 500)}`);
  }
} else {
  console.log(`Login failed: ${JSON.stringify(j4)}`);
}
