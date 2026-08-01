const nodemailer = require('nodemailer');
(async () => {
  console.log('Test 1: con la key antigua bGDw0LrI7XAtJF5M');
  const t1 = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', port: 587, secure: false, requireTLS: true,
    auth: { user: 'b3e8df001@smtp-brevo.com', pass: 'bGDw0LrI7XAtJF5M' },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    await t1.verify();
    console.log('  ✓ verify OK');
  } catch (e) {
    console.log('  ✗', e.code, e.message.substring(0, 100));
  }
  
  console.log('\nTest 2: testing without auth (just connectivity)');
  const t2 = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', port: 587, secure: false, requireTLS: true,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    // Just connect to verify SMTP server is reachable
    const net = require('net');
    await new Promise((res, rej) => {
      const s = net.connect(587, 'smtp-relay.brevo.com');
      s.on('connect', () => { console.log('  ✓ TCP connect OK'); s.end(); res(); });
      s.on('error', rej);
      setTimeout(() => rej(new Error('timeout')), 10000);
    });
  } catch (e) {
    console.log('  ✗', e.message);
  }
})();
