/**
 * Envío de prueba vía SMTP.
 * Uso:
 *   BREVO_SMTP_KEY=xsmtpsib-... node scripts/_send-test-email-smtp.cjs
 *   TEST_TO=email@dominio.com   node scripts/_send-test-email-smtp.cjs   (default: jsadr23@gmail.com)
 */
const fs = require('fs');
const nodemailer = require('nodemailer');

// Cargar .env
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});

const SMTP_KEY = process.env.BREVO_SMTP_KEY;
const TEST_TO = process.env.TEST_TO || 'jsadr23@gmail.com';

if (!SMTP_KEY) {
  console.error('ERROR: Debes pasar BREVO_SMTP_KEY como variable de entorno.');
  process.exit(1);
}

(async () => {
  console.log('=== Envío de prueba vía SMTP ===\n');
  console.log('Destino:', TEST_TO);

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: 'b3e8df001@smtp-brevo.com', pass: SMTP_KEY },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    const info = await transporter.sendMail({
      from: '"JSADR Diagnóstico" <jsa@jsadr.com.co>',
      to: TEST_TO,
      subject: '[JSADR] OTP reparado vía SMTP — ' + new Date().toISOString(),
      text: 'Confirmación: el sistema de OTP está funcionando vía SMTP.\n\nPróximo paso: configurar la API key HTTPS de Brevo para evitar el error 525 en Vercel.',
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;color:#0f172a">
          <h2 style="color:#0ea5e9">JSADR — OTP reparado</h2>
          <p>Confirmación: el sistema de envío de OTP vía SMTP está funcionando correctamente.</p>
          <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
          <p><strong>Vía:</strong> SMTP (smtp-relay.brevo.com:587)</p>
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0">
          <p style="color:#64748b;font-size:12px">
            Este correo confirma que las credenciales Brevo fueron recuperadas y re-cifradas
            con la API_ENCRYPTION_KEY actual.
          </p>
        </div>
      `,
    });
    console.log('✓ Correo enviado OK');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
  } catch (e) {
    console.log('✗ Error:', e.message);
  }
})();
