const r = await fetch('https://jsadr.com.co/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://jsadr.com.co' },
  body: JSON.stringify({ username: 'Js1214731649', password: 'Js951029*' }),
});
console.log('Status:', r.status);
const j = await r.json();
console.log('Response:', JSON.stringify(j).substring(0, 500));
