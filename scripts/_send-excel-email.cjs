// Envía el Excel final por correo usando Brevo SMTP
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Cargar .env manualmente
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
});

const EXCEL_PATH = '/home/z/my-project/download/informe-final-jsadr.xlsx';
const TO_EMAILS = (process.env.MAIL_TO || 'jsa@jsadr.com.co,JSADR23@GMAIL.COM').split(',').map(s => s.trim());

if (!fs.existsSync(EXCEL_PATH)) {
  console.error('❌ No se encontró el Excel:', EXCEL_PATH);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

(async () => {
  console.log('=== ENVIAR EXCEL POR CORREO ===');
  console.log('De :', process.env.SMTP_FROM);
  console.log('Para:', TO_EMAILS.join(', '));
  console.log('Adjunto:', EXCEL_PATH);

  const info = await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
    to: TO_EMAILS.join(', '),
    subject: 'Informe Final JSADR — Credenciales + Sincronización (Excel)',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px;">
          Informe Final JSADR — Credenciales y Sincronización
        </h2>

        <p>Adjunto encontrarás el archivo Excel con el informe completo, incluyendo:</p>

        <ul style="background:#f8fafc; padding:16px 24px; border-radius:6px;">
          <li><b>Usuarios del Sistema (7):</b> Admin, Gestores, Consultor y Abogados — todos con clave <code style="background:#dbeafe; padding:2px 6px; border-radius:3px;">Js951029*</code></li>
          <li><b>Clientes del Portal (9):</b> login con número de cédula + clave <code style="background:#dbeafe; padding:2px 6px; border-radius:3px;">4321</code></li>
          <li><b>Sincronización 100% verificada:</b> GitHub (commit <code>eb74854</code>), Vercel (deploy READY en <code>jsadr.com.co</code>), Neon (PlataformaSync OK)</li>
          <li><b>Resultados QA:</b> 13 módulos, 195 TCs aprobados, 32 hallazgos documentados</li>
          <li><b>Hojas del Excel:</b> Resumen Ejecutivo · Usuarios · Clientes · URLs · Sincronización · QA · Hallazgos · Notas</li>
        </ul>

        <h3 style="color: #1e3a8a;">Credenciales de acceso rápido</h3>
        <table style="width:100%; border-collapse:collapse; margin:8px 0 16px;">
          <thead>
            <tr style="background:#1e3a8a; color:white;">
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">Portal</th>
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">Usuario</th>
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">Clave</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:8px; border:1px solid #e2e8f0;">Admin</td><td style="padding:8px; border:1px solid #e2e8f0;">Adm-Jsadr</td><td style="padding:8px; border:1px solid #e2e8f0;"><code>Js951029*</code></td></tr>
            <tr><td style="padding:8px; border:1px solid #e2e8f0;">Administrativo</td><td style="padding:8px; border:1px solid #e2e8f0;">P_jsadr · gestor-jsadr · consultor-jsadr</td><td style="padding:8px; border:1px solid #e2e8f0;"><code>Js951029*</code></td></tr>
            <tr><td style="padding:8px; border:1px solid #e2e8f0;">Jurídico</td><td style="padding:8px; border:1px solid #e2e8f0;">JD_jsadr · Jd_jsadr · abogado-jsadr</td><td style="padding:8px; border:1px solid #e2e8f0;"><code>Js951029*</code></td></tr>
            <tr><td style="padding:8px; border:1px solid #e2e8f0;">Cliente</td><td style="padding:8px; border:1px solid #e2e8f0;">cédula del cliente</td><td style="padding:8px; border:1px solid #e2e8f0;"><code>4321</code></td></tr>
          </tbody>
        </table>

        <p style="color:#64748b; font-size:13px; margin-top:24px;">
          URLs: <a href="https://jsadr.com.co/admin">/admin</a> ·
          <a href="https://jsadr.com.co/login">/login</a> ·
          <a href="https://jsadr.com.co/juridico">/juridico</a>
        </p>

        <p style="color:#64748b; font-size:13px;">
          Generado automáticamente por la plataforma JSADR.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: 'informe-final-jsadr.xlsx',
        path: EXCEL_PATH,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });

  console.log('\n✅ Correo enviado correctamente!');
  console.log('   Message ID:', info.messageId);
  console.log('   Response:', info.response);
})().catch(err => {
  console.error('❌ Error enviando correo:', err.message);
  if (err.response) console.error('   Brevo response:', err.response);
  process.exit(1);
});
