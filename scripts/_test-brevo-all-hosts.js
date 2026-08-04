const nodemailer = require('nodemailer');
(async () => {
  const hosts = [
    'smtp-relay.brevo.com',
    'smtp.brevo.com',
    'relay.brevo.com',
  ];
  for (const host of hosts) {
    console.log(`\nHost: ${host}:587`);
    try {
      const t = nodemailer.createTransport({
        host, port: 587, secure: false, requireTLS: true,
        auth: { user: 'b3e8df001@smtp-brevo.com', pass: 'bGDw0LrI7XAtJF5M' },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
      });
      await t.verify();
      console.log('  ✓ OK!');
      return;
    } catch (e) {
      console.log('  ✗ ' + e.message.substring(0, 100));
    }
  }
})();
