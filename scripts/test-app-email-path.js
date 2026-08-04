// Simula exactamente lo que hace src/lib/email.ts cuando la app envía un correo:
// 1. Lee ConexionAPI.EMAIL_SMTP activa
// 2. Desencripta la password con API_ENCRYPTION_KEY de .env
// 3. Crea transporter y envía

const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}
function decrypt(encText) {
  const parts = encText.split(':');
  if (parts.length !== 2) return encText;
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  let dec = decipher.update(parts[1], 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

(async () => {
  console.log('=== Test de integración: src/lib/email.ts vs BD ===\n');
  
  // 1. Leer config como hace obtenerConfigSmtp()
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  });
  
  if (!conexion) {
    console.log('✗ No hay conexionAPI EMAIL_SMTP activa');
    process.exit(1);
  }
  console.log('✓ ConexionAPI encontrada:');
  console.log('  url:', conexion.url);
  console.log('  usuario:', conexion.usuario);
  console.log('  apiKey (fromEmail):', conexion.apiKey);
  
  // 2. Parsear configuracionExtra
  let host = '', port = 587, secure = false;
  let fromName = 'Sistema', fromEmail = '';
  if (conexion.configuracionExtra) {
    const extra = JSON.parse(conexion.configuracionExtra);
    host = extra.host; port = extra.port; secure = extra.secure;
    fromName = extra.fromName; fromEmail = extra.fromEmail;
  }
  console.log('  host:', host, 'port:', port);
  console.log('  from:', fromName, '<' + fromEmail + '>');
  
  // 3. Desencriptar password
  const pass = decrypt(conexion.password);
  console.log('  pass desencriptado:', pass.substring(0, 8) + '...' + pass.substring(pass.length - 6));
  console.log('  ✓ Decrypt OK (la API_ENCRYPTION_KEY coincide)\n');
  
  // 4. Crear transporter y verificar
  const transporter = nodemailer.createTransport({
    host, port, secure,
    requireTLS: !secure,
    auth: { user: conexion.usuario, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });
  
  console.log('Verificando conexión SMTP...');
  await transporter.verify();
  console.log('✓ transporter.verify() OK\n');
  
  // 5. Enviar correo de prueba al admin
  console.log('Enviando correo de prueba al remitente...');
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: fromEmail,
    subject: '✓ Sistema de correos operacional — Jsadr',
    text: `Sistema de correos operacional.

Configuración verificada:
- Host: ${host}:${port}
- Usuario: ${conexion.usuario}
- From: ${fromName} <${fromEmail}>

La app puede enviar correos automáticamente desde cualquier módulo.
Fecha: ${new Date().toISOString()}`,
  });
  console.log('✓ Correo de prueba enviado');
  console.log('  messageId:', info.messageId);
  console.log('  response:', info.response);
  
  // Marcar conexionAPI como probada
  await prisma.conexionAPI.update({
    where: { id: conexion.id },
    data: {
      probada: true,
      fechaUltimaPrueba: new Date(),
      resultadoUltimaPrueba: 'OK - verify() y sendMail() exitosos',
    },
  });
  await prisma.correoInstitucional.updateMany({
    where: { esPrincipal: true },
    data: { ultimoTest: new Date(), ultimoTestOk: true },
  });
  console.log('\n✓ BD actualizada (probada=true, ultimoTestOk=true)');
  console.log('\n🎉 ¡SISTEMA DE CORREOS 100% OPERACIONAL!');
  
  await prisma.$disconnect();
})().catch(e => {
  console.error('\n❌ ERROR:', e.message);
  process.exit(1);
});
