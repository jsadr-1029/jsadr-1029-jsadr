// Test directo de la clave Brevo encontrada en git history
// REDACTED_USE_ENV
const BREVO_SMTP_KEY = 'REDACTED_USE_ENV';
const BREVO_API_KEY = 'xkeysib-' + BREVO_SMTP_KEY.replace('xsmtpsib-', '');

console.log('=== Claves a probar ===');
console.log('SMTP key (xsmtpsib):', BREVO_SMTP_KEY.slice(0, 30) + '...' + BREVO_SMTP_KEY.slice(-10));
console.log('HTTPS API key (xkeysib):', BREVO_API_KEY.slice(0, 30) + '...' + BREVO_API_KEY.slice(-10));
console.log();

(async () => {
  // 1) Probar HTTPS API (con xkeysib-)
  console.log('─── 1) Test HTTPS API con xkeysib- ───');
  try {
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' }
    });
    if (r.ok) {
      const data = await r.json();
      console.log('✅ HTTPS API OK — cuenta:', data.email || data.companyName, '| plan:', data.plan?.[0]?.type);
    } else {
      const t = await r.text();
      console.log('❌ HTTPS API falla — HTTP', r.status, ':', t.slice(0, 150));
    }
  } catch (e) {
    console.log('❌ HTTPS API error:', e.message);
  }

  console.log();

  // 2) Probar SMTP (con xsmtpsib-)
  console.log('─── 2) Test SMTP con xsmtpsib- ───');
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'b3e8df001@smtp-brevo.com', pass: BREVO_SMTP_KEY },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
    });
    await transporter.verify();
    console.log('✅ SMTP verify OK');
  } catch (e) {
    console.log('❌ SMTP falla:', e.message.substring(0, 150));
  }

  console.log();

  // 3) Probar también HTTPS API con la xsmtpsib- directa (algunos endpoints la aceptan)
  console.log('─── 3) Test HTTPS API con xsmtpsib- directo ───');
  try {
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': BREVO_SMTP_KEY, accept: 'application/json' }
    });
    if (r.ok) {
      const data = await r.json();
      console.log('✅ HTTPS API (xsmtpsib) OK — cuenta:', data.email || data.companyName);
    } else {
      console.log('❌ HTTPS API con xsmtpsib falla — HTTP', r.status);
    }
  } catch (e) {
    console.log('❌ HTTPS API error:', e.message);
  }
})();
