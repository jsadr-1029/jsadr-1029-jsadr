// The login response might have a different structure
console.log('=== Login as admin ===');
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j4 = await r4.json();
console.log('Full login response keys:', Object.keys(j4));
console.log('Full login response:', JSON.stringify(j4).substring(0, 500));

// Try different token field names
const token = j4.access_token || j4.token || j4.accessToken || (j4.data && j4.data.access_token) || (j4.data && j4.data.token);
console.log('\nToken found:', token ? token.substring(0, 30) + '...' : 'NONE');

if (token) {
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
      console.log(`First: ${j5.data[0].codigo}`);
    }
  } else {
    const text = await r5.text();
    console.log(`Error: ${text.substring(0, 300)}`);
  }
}
