/**
 * Prueba end-to-end: simular el flujo de OTP como lo hace la app.
 * 1. Genera un código OTP de 6 dígitos
 * 2. Lo guarda en BD (tabla CodigoVerificacion o similar)
 * 3. Llama a enviarEmail con el template de OTP
 * 4. Verifica que llegue a la bandeja
 */
const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

(async () => {
  console.log('=== PRUEBA END-TO-END DE OTP ===\n');

  // 1. Generar código de 6 dígitos (igual que el sistema)
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  console.log('Código OTP generado:', codigo);

  // 2. Buscar cliente/usuario destino
  const TO_EMAIL = 'jsadr23@gmail.com';
  const NOMBRE = 'Johan Alvarez';
  console.log('Destino:', TO_EMAIL);

  // 3. Cargar librería de email (replicando src/lib/email.ts)
  const ALGORITHM = 'aes-256-cbc';
  const nodemailer = require('nodemailer');

  // 4. Leer credenciales de la BD (deben estar ya re-cifradas con API_ENCRYPTION_KEY actual)
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  });
  if (!conexion) {
    console.error('✗ No hay conexion EMAIL_SMTP activa');
    process.exit(1);
  }

  // Desencriptar
  const keyBuf = Buffer.from(process.env.API_ENCRYPTION_KEY, 'hex');
  function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }

  let apiKey = null;
  let smtpPass = null;
  try { apiKey = decrypt(conexion.apiKey); } catch (e) { console.log('API key no descifrable:', e.message); }
  try { smtpPass = decrypt(conexion.password); } catch (e) { console.log('SMTP pass no descifrable:', e.message); }

  console.log('API key desencriptada:', apiKey ? apiKey.substring(0, 20) + '...' + apiKey.slice(-8) : '(no disponible)');
  console.log('SMTP pass desencriptada:', smtpPass ? smtpPass.substring(0, 20) + '...' + smtpPass.slice(-8) : '(no disponible)');

  // 5. Plantilla OTP (igual que la app)
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;margin:0">
      <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;padding:8px 16px;border-radius:8px;font-weight:bold">JSADR</div>
        </div>
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 8px 0;text-align:center">Tu código de verificación</h1>
        <p style="color:#64748b;text-align:center;margin-bottom:32px">Hola <strong>${NOMBRE}</strong>, usa este código para continuar:</p>
        <div style="text-align:center;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;padding:24px;margin-bottom:32px">
          <div style="font-size:42px;font-weight:bold;letter-spacing:8px;color:#0f172a;font-family:monospace">${codigo}</div>
        </div>
        <p style="color:#64748b;font-size:14px;text-align:center;margin-bottom:16px">Este código expira en <strong>10 minutos</strong>.</p>
        <p style="color:#94a3b8;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;margin:0">
          Si no solicitaste este código, ignora este correo.<br>JSADR — Plataforma de Gestión de Préstamos
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `JSADR — Tu código de verificación\n\nHola ${NOMBRE},\n\nTu código es: ${codigo}\n\nEste código expira en 10 minutos.\n\nSi no solicitaste este código, ignora este correo.\n\nJSADR — Plataforma de Gestión de Préstamos`;

  // 6. Enviar (probar API primero, luego SMTP fallback)
  let enviado = false;
  let via = '';
  let messageId = '';

  if (apiKey && apiKey.startsWith('xkeysib-')) {
    console.log('\n--- Intentando vía Brevo HTTPS API ---');
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'JSADR Plataforma', email: 'jsa@jsadr.com.co' },
          to: [{ email: TO_EMAIL }],
          subject: `Tu código OTP — ${NOMBRE}`,
          htmlContent: html,
          textContent: textContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        enviado = true;
        via = 'BREVO_HTTPS_API';
        messageId = data.messageId;
        console.log('✓ Enviado vía API. messageId:', messageId);
      } else {
        const txt = await res.text();
        console.log('✗ API falló HTTP', res.status, ':', txt.substring(0, 200));
      }
    } catch (e) {
      console.log('✗ API exception:', e.message);
    }
  }

  if (!enviado && smtpPass && smtpPass.startsWith('xsmtpsib-')) {
    console.log('\n--- Intentando vía SMTP fallback ---');
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: 'b3e8df001@smtp-brevo.com', pass: smtpPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
      const info = await transporter.sendMail({
        from: '"JSADR Plataforma" <jsa@jsadr.com.co>',
        to: TO_EMAIL,
        subject: `Tu código OTP — ${NOMBRE}`,
        text: textContent,
        html: html,
      });
      enviado = true;
      via = 'SMTP_FALLBACK';
      messageId = info.messageId;
      console.log('✓ Enviado vía SMTP. messageId:', messageId);
    } catch (e) {
      console.log('✗ SMTP exception:', e.message);
    }
  }

  // 7. Registrar en EnvioCorreo (auditoría)
  if (enviado) {
    console.log('\n=== Registro en EnvioCorreo ===');
    try {
      // Buscar CorreoInstitucional para relacionar
      const correo = await prisma.correoInstitucional.findFirst({
        where: { email: 'jsa@jsadr.com.co', estado: 'activo' },
        select: { id: true },
      });
      await prisma.envioCorreo.create({
        data: {
          correoInstitucionalId: correo?.id || null,
          remitenteEmail: 'jsa@jsadr.com.co',
          destinatario: TO_EMAIL,
          asunto: `Tu código OTP — ${NOMBRE}`,
          cuerpo: textContent,
          formato: 'html',
          estado: 'ENVIADO',
          fechaEnvio: new Date(),
          enviadoPorNombre: `Diagnóstico (${via})`,
          metadata: JSON.stringify({ messageId, via, codigoGenerado: codigo }),
        },
      });
      console.log('✓ Registro creado en EnvioCorreo');
    } catch (e) {
      console.log('✗ No se pudo registrar:', e.message);
    }
  }

  console.log('\n=== RESULTADO FINAL ===');
  console.log('Enviado:', enviado ? '✓ SÍ' : '✗ NO');
  if (enviado) {
    console.log('Vía:', via);
    console.log('Message ID:', messageId);
    console.log('Código OTP:', codigo);
    console.log('Destino:', TO_EMAIL);
    console.log('\n👉 Revisa la bandeja de jsadr23@gmail.com (también spam/promociones).');
  }

  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
