// Test with proper auth flow
console.log('=== Login as admin ===');
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j4 = await r4.json();
console.log(`Login status: ${r4.status}, success: ${j4.success}`);

if (j4.success) {
  const token = j4.access_token;
  console.log(`Token: ${token?.substring(0, 20)}...`);
  
  // Wait a moment then test
  await new Promise(r => setTimeout(r, 500));
  
  console.log('\n=== Test: /api/prestamos ===');
  const r5 = await fetch('https://jsadr.com.co/api/prestamos', {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://jsadr.com.co',
    },
  });
  console.log(`Status: ${r5.status}`);
  if (r5.ok) {
    const j5 = await r5.json();
    console.log(`Success: ${j5.success}, Total: ${j5.data?.length || 0}`);
    if (j5.data?.length > 0) {
      console.log(`First: ${j5.data[0].codigo} - ${j5.data[0].cliente?.nombre || 'NO CLIENTE'}`);
    }
  } else {
    const text = await r5.text();
    console.log(`Error response: ${text.substring(0, 500)}`);
  }
  
  console.log('\n=== Test: /api/notificaciones ===');
  const r6 = await fetch('https://jsadr.com.co/api/notificaciones', {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://jsadr.com.co',
    },
  });
  console.log(`Status: ${r6.status}`);
  if (r6.ok) {
    const j6 = await r6.json();
    console.log(`Success: ${j6.success}, Total: ${j6.data?.length || 0}`);
  } else {
    const text = await r6.text();
    console.log(`Error: ${text.substring(0, 300)}`);
  }
} else {
  console.log(`Login failed: ${JSON.stringify(j4)}`);
}
