const nodemailer = require('nodemailer');
(async () => {
  // Variaciones posibles de la key
  const variations = [
    { user: 'b3e8df001@smtp-brevo.com', pass: 'bGDw0LrI7XAtJF5M' },
    // Probar como API key en header
    { user: 'jsa@jsadr.com.co', pass: 'bGDw0LrI7XAtJF5M' },
    // Quizá solo el usuario sin @smtp-brevo.com
    { user: 'b3e8df001', pass: 'bGDw0LrI7XAtJF5M' },
  ];
  for (const v of variations) {
    console.log(`\nProbando user="${v.user}" pass="${v.pass.substring(0,4)}..."`);
    try {
      const t = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587, secure: false, requireTLS: true,
        auth: v,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
      });
      await t.verify();
      console.log('  ✓ OK!');
      return v;
    } catch (e) {
      console.log('  ✗ ' + e.message.substring(0, 80));
    }
  }
  console.log('\n⚠️  NINGUNA combinación funcionó. La SMTP key debe estar caducada.');
  console.log('El usuario debe regenerar la SMTP key en https://app-smtp.brevo.com/');
})();
