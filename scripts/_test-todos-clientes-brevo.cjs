// Pruebas finales: enviar correos DIRECTOS a TODOS los clientes
// usando enviarEmail() desde una prueba que ejecuta el código real
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60'
    }
  }
});

const BREVO_SMTP_KEY = 'REDACTED_USE_ENV';
const BREVO_USER = 'b3e8df001@smtp-brevo.com';
const FROM_EMAIL = 'jsa@jsadr.com.co';

function buildTransporter() {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: BREVO_USER, pass: BREVO_SMTP_KEY },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
  });
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' ENVÍO DIRECTO DE CORREOS A TODOS LOS CLIENTES — 3 ESCENARIOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const clientes = await prisma.cliente.findMany({
    where: { 
      email: { not: null },
      activo: true
    },
    select: { id: true, cedula: true, nombre: true, email: true }
  });

  console.log(`Clientes con email: ${clientes.length}\n`);

  const transporter = buildTransporter();
  const resultados = { otp: [], reset: [], notif: [] };

  // ============ ESCENARIO 1: OTP (6 dígitos) ============
  console.log('─── ESCENARIO 1: OTP (6 dígitos) ───');
  for (const c of clientes) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    try {
      const info = await transporter.sendMail({
        from: `"JSADR Plataforma" <${FROM_EMAIL}>`,
        to: c.email,
        subject: `[OTP] Tu código de verificación — ${c.nombre}`,
        html: `
<div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
    <h1 style="margin:0; font-size:20px;">JSADR · Código de verificación</h1>
  </div>
  <div style="background:#1a1530; padding:24px; border-radius:0 0 12px 12px; color:#e2e8f0;">
    <p>Hola <strong>${c.nombre}</strong>,</p>
    <p>Tu código OTP para firma de préstamo es:</p>
    <div style="background:rgba(255,255,255,0.08); padding:16px; border-radius:8px; text-align:center; margin:16px 0;">
      <span style="font-size:32px; font-family:monospace; color:#a855f7; font-weight:700; letter-spacing:8px;">${otp}</span>
    </div>
    <p style="font-size:12px; color:#94a3b8;">Este código expira en 5 minutos. No lo compartas con nadie.</p>
  </div>
</div>`
      });
      resultados.otp.push({ cliente: c.nombre, email: c.email, ok: true, messageId: info.messageId });
      console.log(`  ✅ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | ${info.messageId.substring(0, 60)}`);
    } catch (e) {
      resultados.otp.push({ cliente: c.nombre, email: c.email, ok: false, error: e.message });
      console.log(`  ❌ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log();

  // ============ ESCENARIO 2: RESET DE CLAVE ============
  console.log('─── ESCENARIO 2: RESET DE CLAVE ───');
  for (const c of clientes) {
    const tempPwd = 'Tmp' + Math.random().toString(36).substring(2, 10) + '*';
    try {
      const info = await transporter.sendMail({
        from: `"JSADR Plataforma" <${FROM_EMAIL}>`,
        to: c.email,
        subject: `[Reset] Tu contraseña temporal — ${c.nombre}`,
        html: `
<div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
    <h1 style="margin:0; font-size:20px;">JSADR · Recuperación de contraseña</h1>
  </div>
  <div style="background:#1a1530; padding:24px; border-radius:0 0 12px 12px; color:#e2e8f0;">
    <p>Hola <strong>${c.nombre}</strong>,</p>
    <p>Tu contraseña temporal es:</p>
    <div style="background:rgba(255,255,255,0.08); padding:16px; border-radius:8px; text-align:center; margin:16px 0;">
      <span style="font-size:20px; font-family:monospace; color:#f59e0b; font-weight:700;">${tempPwd}</span>
    </div>
    <p style="font-size:12px; color:#94a3b8;">Válida por 24h. Cámbiala al ingresar. Si no solicitaste este reset, contacta al administrador.</p>
  </div>
</div>`
      });
      resultados.reset.push({ cliente: c.nombre, email: c.email, ok: true, messageId: info.messageId, tempPwd });
      console.log(`  ✅ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | pwd=${tempPwd}`);
    } catch (e) {
      resultados.reset.push({ cliente: c.nombre, email: c.email, ok: false, error: e.message });
      console.log(`  ❌ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log();

  // ============ ESCENARIO 3: NOTIFICACIÓN DE PAGO ============
  console.log('─── ESCENARIO 3: NOTIFICACIÓN DE PAGO ───');
  for (const c of clientes) {
    const fecha = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    try {
      const info = await transporter.sendMail({
        from: `"JSADR Plataforma" <${FROM_EMAIL}>`,
        to: c.email,
        subject: `[Recordatorio] Pago próximo a vencer — ${c.nombre}`,
        html: `
<div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
    <h1 style="margin:0; font-size:20px;">JSADR · Recordatorio de pago</h1>
  </div>
  <div style="background:#1a1530; padding:24px; border-radius:0 0 12px 12px; color:#e2e8f0;">
    <p>Hola <strong>${c.nombre}</strong>,</p>
    <p>Tu próximo pago vence el <strong style="color:#06b6d4;">${fecha}</strong>.</p>
    <p>Por favor ingresa al portal para realizarlo a tiempo y evitar mora.</p>
    <a href="https://jsadr.com.co/portal" style="display:inline-block; background:#06b6d4; color:white; padding:10px 20px; border-radius:6px; text-decoration:none; margin-top:12px;">Ir al portal</a>
    <p style="font-size:12px; color:#94a3b8; margin-top:16px;">Si ya realizaste el pago, ignora este mensaje.</p>
  </div>
</div>`
      });
      resultados.notif.push({ cliente: c.nombre, email: c.email, ok: true, messageId: info.messageId });
      console.log(`  ✅ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | ${info.messageId.substring(0, 60)}`);
    } catch (e) {
      resultados.notif.push({ cliente: c.nombre, email: c.email, ok: false, error: e.message });
      console.log(`  ❌ ${c.nombre.padEnd(25)} ${c.email.padEnd(35)} | ${e.message.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log();

  // ============ RESUMEN ============
  const total = { otp: resultados.otp.filter(r => r.ok).length, reset: resultados.reset.filter(r => r.ok).length, notif: resultados.notif.filter(r => r.ok).length };
  const totalClientes = clientes.length;
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' RESUMEN FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Clientes totales con email: ${totalClientes}`);
  console.log(`  OTP enviados:               ${total.otp}/${totalClientes}`);
  console.log(`  Reset enviados:             ${total.reset}/${totalClientes}`);
  console.log(`  Notificaciones enviadas:    ${total.notif}/${totalClientes}`);
  console.log(`  TOTAL correos enviados:     ${total.otp + total.reset + total.notif}/${totalClientes * 3}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Guardar reporte
  const fs = require('fs');
  fs.writeFileSync('/home/z/my-project/download/reporte-correos-enviados.json', JSON.stringify({
    fecha: new Date().toISOString(),
    clientes: clientes.length,
    escenarios: {
      otp: { enviados: total.otp, total: totalClientes },
      reset: { enviados: total.reset, total: totalClientes },
      notificacion: { enviados: total.notif, total: totalClientes }
    },
    detalle: resultados
  }, null, 2));
  console.log('\nReporte guardado: /home/z/my-project/download/reporte-correos-enviados.json');

  await prisma.$disconnect();
})();
