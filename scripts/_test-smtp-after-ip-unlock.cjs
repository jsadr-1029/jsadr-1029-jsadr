// Test directo de envío SMTP a jsadr23@gmail.com usando la SMTP key actual
// (xsmtpsib-...AuEQHE) — debe funcionar ahora que los bloqueos IP están desactivados.
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
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

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60' } }
});

function getBackupKey() {
  const seed =
    'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
    'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
    'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';
  return crypto.createHash('sha256').update(seed).digest();
}

function decryptBackup(encText) {
  try {
    const parts = encText.split(':');
    if (parts.length !== 2) return encText;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getBackupKey(), iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) { return encText; }
}

(async () => {
  try {
    const c = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } });
    if (!c) { console.log('Sin conexion EMAIL_SMTP'); return; }

    const smtpKey = decryptBackup(c.password);
    console.log('=== TEST SMTP CON BLOQUEOS IP DESACTIVADOS ===\n');
    console.log(`SMTP host: smtp-relay.brevo.com:587`);
    console.log(`SMTP user: ${c.usuario}`);
    console.log(`SMTP key:  ${smtpKey.substring(0, 20)}...${smtpKey.slice(-10)}`);
    console.log(`From: "JSADR Plataforma" <jsa@jsadr.com.co>`);
    console.log(`To: jsadr23@gmail.com`);
    console.log('');

    // 1) Verificar conexión
    console.log('--- Paso 1: verificar conexión SMTP ---');
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: c.usuario, pass: smtpKey },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    try {
      await transporter.verify();
      console.log('✅ verify() OK — conexión SMTP establecida\n');
    } catch (e) {
      console.log(`❌ verify() FALLÓ: ${e.message}\n`);
      console.log('Posibles causas:');
      console.log('  1. Aún queda un bloqueo IP activo en panel Brevo');
      console.log('  2. La SMTP key está revocada (verifícala en panel Brevo)');
      console.log('  3. Network/firewall bloquea el puerto 587');
      return;
    }

    // 2) Enviar correo real
    console.log('--- Paso 2: enviar correo de prueba ---');
    const info = await transporter.sendMail({
      from: '"JSADR Plataforma" <jsa@jsadr.com.co>',
      to: 'jsadr23@gmail.com',
      subject: '✅ SMTP recuperado — JSADR',
      text: `Este correo confirma que el envío SMTP de JSADR vuelve a funcionar.\n\nBloqueos IP desactivados en panel Brevo a las ${new Date().toISOString()}.\n\nA partir de ahora, los OTP del portal del cliente se enviarán vía SMTP sin restricción de IP.\n\nMessage-ID: ${Date.now()}`,
      html: `<h2>✅ SMTP de JSADR recuperado</h2><p>Los bloqueos IP han sido desactivados en el panel de Brevo.</p><p>A partir de ahora, los <strong>códigos OTP del portal del cliente</strong> se enviarán vía SMTP sin restricción de IP.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
    });
    console.log(`✅ Correo enviado`);
    console.log(`   Message-ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);

    // 3) Registrar en EnvioCorreo (auditoría)
    const correo = await prisma.correoInstitucional.findFirst({
      where: { email: 'jsa@jsadr.com.co', estado: 'activo' }
    });
    await prisma.envioCorreo.create({
      data: {
        correoInstitucionalId: correo?.id || null,
        remitenteEmail: 'jsa@jsadr.com.co',
        destinatario: 'jsadr23@gmail.com',
        asunto: '✅ SMTP recuperado — JSADR',
        cuerpo: 'Test SMTP tras desactivar bloqueos IP en panel Brevo',
        formato: 'html',
        estado: 'ENVIADO',
        fechaEnvio: new Date(),
        enviadoPorNombre: 'Sistema (SMTP directo)',
        metadata: JSON.stringify({
          messageId: info.messageId,
          via: 'SMTP_TEST_POST_IP_UNLOCK',
        }),
      },
    });
    console.log('\n✅ EnvioCorreo registrado en BD');

    console.log('\n=== CONCLUSIÓN ===');
    console.log('✅ SMTP funciona desde esta máquina.');
    console.log('✅ Debería funcionar también desde Vercel (sin restricción IP).');
    console.log('✅ Si Vercel aún falla, el código optimizado intentará HTTPS API → SMTP fallback.');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
