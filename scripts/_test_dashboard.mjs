// Test the dashboard endpoint specifically
const r4 = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
const j4 = await r4.json();
const token = j4.data.access_token;

console.log('=== /api/dashboard ===');
const r = await fetch('https://jsadr.com.co/api/dashboard', {
  headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://jsadr.com.co' },
});
console.log(`Status: ${r.status}`);
if (!r.ok) {
  const text = await r.text();
  console.log(`Error: ${text}`);
}
