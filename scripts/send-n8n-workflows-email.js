// Envía los 3 workflows de n8n por correo a jsa@jsadr.com.co
const nodemailer = require('nodemailer');
const fs = require('fs');

// Cargar .env manualmente
const envPath = '/home/z/my-project/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = value;
});

const files = [
  '/home/z/my-project/download/n8n-workflows/workflow-1-send-otp.json',
  '/home/z/my-project/download/n8n-workflows/workflow-2-verify-otp.json',
  '/home/z/my-project/download/n8n-workflows/workflow-3-chatbot.json',
  '/home/z/my-project/download/n8n-workflows/README.md',
];

async function main() {
  // Verificar que todos los archivos existen
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error('Archivo no encontrado:', f);
      process.exit(1);
    }
  }

  console.log('Enviando 4 archivos por correo a jsa@jsadr.com.co...');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
    to: 'jsa@jsadr.com.co',
    subject: 'n8n Workflows - JSADR WhatsApp + IA (4 archivos)',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">Workflows n8n — JSADR WhatsApp + IA</h2>
        <p>Hola Johan,</p>
        <p>Adjunto encontrarás los <strong>3 workflows de n8n</strong> listos para importar, más un README con instrucciones detalladas:</p>
        <ul>
          <li><strong>workflow-1-send-otp.json</strong> — Enviar OTP por WhatsApp</li>
          <li><strong>workflow-2-verify-otp.json</strong> — Verificar OTP</li>
          <li><strong>workflow-3-chatbot.json</strong> — Chatbot con Z.AI (GLM-4.6)</li>
          <li><strong>README.md</strong> — Guía paso a paso</li>
        </ul>
        <h3 style="color: #1a73e8;">Cómo importarlos en n8n Cloud:</h3>
        <ol>
          <li>Descarga los 4 archivos a tu computadora</li>
          <li>Entra a <a href="https://app.n8n.cloud">https://app.n8n.cloud</a></li>
          <li>Ve a <strong>Workflows</strong> → <strong>Add workflow</strong></li>
          <li>Haz clic en los 3 puntos (...) → <strong>Import from file</strong></li>
          <li>Selecciona cada archivo JSON (uno por workflow)</li>
          <li>Repite para los 3 workflows</li>
        </ol>
        <h3 style="color: #1a73e8;">Después de importar:</h3>
        <p>Sigue las instrucciones del <strong>README.md</strong> para:</p>
        <ul>
          <li>Reemplazar el placeholder de la API key de Z.AI en el Workflow 3</li>
          <li>Activar los 3 workflows (toggle verde)</li>
          <li>Configurar el webhook en Meta Developers</li>
          <li>Probar el flujo completo</li>
        </ul>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888;">Este correo fue enviado automáticamente desde la plataforma JSADR.</p>
      </div>
    `,
    attachments: files.map(f => ({
      filename: f.split('/').pop(),
      path: f,
    })),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Correo enviado OK');
  console.log('MessageId:', info.messageId);
  console.log('Response:', info.response);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
