const http = require('http');
const data = JSON.stringify({ cedula: '1234567890', clave: 'JsadrAbogado2026*' });
const req = http.request({
  hostname: 'localhost', port: 3000, path: '/api/juridico/portal/auth', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const j = JSON.parse(body);
      console.log('Success:', j.success);
      if (j.data?.usuario) {
        console.log('Usuario:', j.data.usuario);
        console.log('Token expires:', j.data.expira);
      } else {
        console.log('Error:', j.error);
      }
    } catch {
      console.log('Body:', body.substring(0,300));
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();
