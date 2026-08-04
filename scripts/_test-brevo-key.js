const nodemailer = require('nodemailer');
(async () => {
  const keys = [
    'bGDw0LrI7XAtJF5M',
    // Probar también sin ceros confundidos con O
    'bGDw0LrI7XAtJF5M'.replace(/0/g, 'O'),
  ];
  for (const key of keys) {
    console.log(`\nProbando key: ${key.substring(0,4)}...${key.substring(key.length-4)}`);
    try {
      const t = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'b3e8df001@smtp-brevo.com', pass: key },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
      await t.verify();
      console.log('  ✓ AUTENTICACIÓN OK');
      return;
    } catch (e) {
      console.log('  ✗ ' + e.message.substring(0, 80));
    }
  }
})();
