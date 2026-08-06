// Envía el Excel del plan de pruebas QA por correo usando Brevo SMTP
// Destinatario: jsa@jsadr.com.co
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

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

const excelPath = '/home/z/my-project/download/plan-pruebas-qa-jsadr.xlsx';
const toEmail = 'jsa@jsadr.com.co';

async function main() {
  if (!fs.existsSync(excelPath)) {
    console.error('ERROR: Excel file not found:', excelPath);
    process.exit(1);
  }

  const fileSize = fs.statSync(excelPath).size;
  console.log(`Excel encontrado: ${excelPath} (${(fileSize/1024).toFixed(1)} KB)`);

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
    from: `"${process.env.SMTP_FROM_NAME || 'JSADR Plataforma'}" <${process.env.SMTP_FROM}>`,
    to: toEmail,
    subject: 'Plan de Pruebas QA por Módulos - JSADR',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">Plan de Pruebas QA por Módulos</h2>
        <p>Hola,</p>
        <p>Adjunto encontrarás el archivo Excel con el <strong>plan de pruebas QA organizado por módulos</strong> de la plataforma JSADR.</p>
        <p>El documento contiene:</p>
        <ul>
          <li>Casos de prueba organizados por módulo</li>
          <li>Descripción, pasos y resultados esperados</li>
          <li>Estado y observaciones</li>
          <li>Matriz de cobertura por módulo</li>
        </ul>
        <p>Si tienes preguntas o necesitas ajustes, no dudes en responder este correo.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888;">Este correo fue enviado automáticamente desde la plataforma JSADR.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'plan-pruebas-qa-jsadr.xlsx',
        path: excelPath,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  };

  console.log('Enviando correo a', toEmail, '...');
  const info = await transporter.sendMail(mailOptions);
  console.log('Correo enviado OK');
  console.log('MessageId:', info.messageId);
  console.log('Response:', info.response);
}

main().catch(err => {
  console.error('ERROR enviando correo:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
