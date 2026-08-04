const nodemailer = require('nodemailer');
(async () => {
  const KEY = 'REDACTED_BREVO_KEY';
  console.log('Probando key:', KEY.substring(0, 25) + '...' + KEY.substring(KEY.length - 8));
  
  // Brevo con API key moderna: el usuario es el email del remitente, el pass es la api key
  const variants = [
    { user: 'jsa@jsadr.com.co', pass: KEY },
    { user: 'b3e8df001@smtp-brevo.com', pass: KEY },
  ];
  for (const v of variants) {
    console.log(`\nVariante user="${v.user}":`);
    try {
      const t = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587, secure: false, requireTLS: true,
        auth: v,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
      await t.verify();
      console.log('  ✓ AUTENTICACIÓN OK!!!');
      console.log('  user:', v.user);
      return;
    } catch (e) {
      console.log('  ✗ ' + e.message.substring(0, 120));
    }
  }
})();
