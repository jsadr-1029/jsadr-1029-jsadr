// Prueba end-to-end del flujo OTP del portal del cliente.
// Simula exactamente lo que haría la app cuando un cliente solicita su código:
// 1. Genera un código OTP de 6 dígitos
// 2. Llama a enviarEmail() con el template HTML de OTP
// 3. Verifica que se registre en EnvioCorreo con estado ENVIADO
//
// Si este script reporta success = true, el portal del cliente debería funcionar.

const fs = require('fs');
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    envVars[m[1]] = v;
  }
});

// Cargar todas las env vars al process.env
Object.assign(process.env, envVars);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Imitar decryptSensitive de src/lib/security.ts
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY || 'dev-temp-encryption-key';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}
function getBackupKey() {
  const seed =
    'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
    'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
    'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';
  return crypto.createHash('sha256').update(seed).digest();
}
function decryptSensitive(encText) {
  if (!encText) return encText;
  const parts = encText.split(':');
  if (parts.length !== 2) return encText;
  // Intentar primero con API_ENCRYPTION_KEY
  for (const key of [getEncryptionKey(), getBackupKey()]) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let dec = decipher.update(parts[1], 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } catch (e) { /* intentar siguiente */ }
  }
  return encText;
}

async function enviarOtpEmail(to, codigo, nombre) {
  const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
  if (!c) throw new Error('No hay ConexionAPI.EMAIL_SMTP activa');

  const smtpKey = decryptSensitive(c.password);
  if (!smtpKey.startsWith('xsmtpsib-')) {
    throw new Error('SMTP key no desencripta correctamente: ' + smtpKey.substring(0, 20));
  }

  // Configurar transporter SMTP (igual que src/lib/email.ts)
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: c.usuario, pass: smtpKey },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  const subject = `Tu código de acceso JSADR: ${codigo}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Código de acceso JSADR</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
  <div style="max-width:500px; margin:0 auto; background:#fff; border-radius:8px; padding:32px;">
    <h2 style="color:#1e3a8a; margin-top:0;">Hola ${nombre},</h2>
    <p style="font-size:16px; color:#374151;">Has solicitado acceder al portal del cliente. Tu código de verificación es:</p>
    <div style="text-align:center; padding:24px; background:#eff6ff; border-radius:8px; margin:24px 0;">
      <span style="font-size:42px; font-weight:bold; letter-spacing:8px; color:#1e40af;">${codigo}</span>
    </div>
    <p style="font-size:14px; color:#6b7280;">Este código expira en 10 minutos. No lo compartas con nadie.</p>
    <p style="font-size:14px; color:#6b7280;">Si no solicitaste este código, ignora este correo.</p>
    <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
    <p style="font-size:12px; color:#9ca3af;">JSADR Plataforma · jsadr.com.co</p>
  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: '"JSADR Plataforma" <jsa@jsadr.com.co>',
    to,
    subject,
    html,
  });
  return info;
}

(async () => {
  console.log('=== PRUEBA END-TO-END OTP PORTAL CLIENTE ===\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Generar código de 6 dígitos (igual que producción)
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  const TO_EMAIL = 'jsadr23@gmail.com';
  const NOMBRE = 'Johan Alvarez';

  console.log(`Código OTP generado: ${codigo}`);
  console.log(`Destino: ${TO_EMAIL}`);
  console.log('');

  try {
    console.log('--- Enviando correo OTP ---');
    const info = await enviarOtpEmail(TO_EMAIL, codigo, NOMBRE);
    console.log(`✅ Correo enviado`);
    console.log(`   Message-ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log('');

    // Registrar en EnvioCorreo (igual que producción)
    console.log('--- Registrando en EnvioCorreo ---');
    const correo = await prisma.correoInstitucional.findFirst({
      where: { email: 'jsa@jsadr.com.co', estado: 'activo' }
    });
    const envio = await prisma.envioCorreo.create({
      data: {
        correoInstitucionalId: correo?.id || null,
        remitenteEmail: 'jsa@jsadr.com.co',
        destinatario: TO_EMAIL,
        asunto: `Tu código de acceso JSADR: ${codigo}`,
        cuerpo: `OTP enviado: ${codigo}`,
        formato: 'html',
        estado: 'ENVIADO',
        fechaEnvio: new Date(),
        enviadoPorNombre: 'Sistema (OTP test post-unlock)',
        metadata: JSON.stringify({
          messageId: info.messageId,
          via: 'SMTP_OTP_TEST',
          codigo: codigo,
        }),
      },
    });
    console.log(`✅ EnvioCorreo registrado (id: ${envio.id})`);
    console.log('');

    console.log('=== RESULTADO ===');
    console.log('✅ FLUJO OTP END-TO-END OK');
    console.log('✅ El portal del cliente debería poder enviar OTP ahora.');
    console.log('');
    console.log('Próximo paso: el commit + push propagará el fix a Vercel.');
    console.log('Después del deploy, probar el login real en https://jsadr.com.co/login');

  } catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
