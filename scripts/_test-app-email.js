const http = require('http');
const data = JSON.stringify({ accion: 'enviar-prueba', to: 'jsadr23@outlook.com' });
const req = http.request({
  hostname: 'localhost', port: 3000, path: '/api/email', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body.substring(0,500));
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();
