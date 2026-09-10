import pkg from 'pg';
const { Client: PgClient } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const pg = new PgClient({ connectionString, ssl: { rejectUnauthorized: false } });
await pg.connect();

// Token generado en paso anterior
const token = 'de0dbeb1c576fc50b471c3184e1d892da4f5ff90727067730f0f5678f0a5a914';

const cli = await pg.query(`SELECT nombre, cedula, email FROM "Cliente" WHERE cedula = '1100012073'`);
const cliente = cli.rows[0];
console.log('Cliente:', cliente);

// Buscar credenciales Brevo en BD
const smtp = await pg.query(`
  SELECT clave, valor FROM "Configuracion" 
  WHERE clave IN ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_FROM_NAME', 'BREVO_API_KEY', 'BREVO_API_URL')
`);
const config = {};
smtp.rows.forEach(r => { config[r.clave] = r.valor; });
console.log('SMTP config disponible:', Object.keys(config).join(', '));

await pg.end();

// Generar el correo HTML
const link = `https://jsadr.com.co/recuperar-clave?token=${token}`;
const asunto = `Restablece tu contraseña — ${cliente.nombre}`.slice(0, 90);

const cuerpoHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Jsadr · Jo*** Se*** Al*** D** R**</h1>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Restablecimiento de contraseña</p>
  </div>
  <div style="background: #1a1530; padding: 24px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
    <p style="margin: 0 0 16px 0; font-size: 14px;">Hola <strong>${cliente.nombre}</strong>,</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta
      <strong style="color: #c4b5fd;">${cliente.cedula}</strong>.
      Para crear una nueva contraseña, haz clic en el siguiente botón:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);">
        🔑 Crear nueva contraseña
      </a>
    </div>
    <p style="margin: 16px 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 0; font-size: 12px; font-family: monospace; color: #a855f7; word-break: break-all; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.2);">
      ${link}
    </p>
    <p style="margin: 16px 0; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
      Este enlace es <strong>válido por 60 minutos</strong> y se puede usar <strong>una sola vez</strong>.
    </p>
    <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 12px; color: #fca5a5;">
        <strong>⚠️ Seguridad:</strong> Si no solicitaste este cambio, ignora este correo.
      </p>
    </div>
  </div>
</div>`;

// Enviar correo vía Brevo API
console.log('\nEnviando correo vía Brevo API...');
const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'api-key': config.BREVO_API_KEY,
  },
  body: JSON.stringify({
    sender: { 
      name: config.SMTP_FROM_NAME || 'Jsadr', 
      email: config.SMTP_FROM || 'noreply@jsadr.com.co' 
    },
    to: [{ email: cliente.email, name: cliente.nombre }],
    subject: asunto,
    htmlContent: cuerpoHtml,
  }),
});
console.log('Brevo status:', brevoRes.status);
const brevoJson = await brevoRes.json().catch(() => ({}));
console.log('Brevo response:', JSON.stringify(brevoJson, null, 2));
