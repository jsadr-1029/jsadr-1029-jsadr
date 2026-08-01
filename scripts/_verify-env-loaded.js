// Just hit an API endpoint that uses one of the regen secrets
// to confirm dev server reloaded env. The /api/email GET endpoint 
// requires ADMIN role, so we'll just check it responds 401 (not 500).
const http = require('http');
http.get('http://localhost:3000/api/email', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0,200));
  });
}).on('error', e => console.error(e.message));
