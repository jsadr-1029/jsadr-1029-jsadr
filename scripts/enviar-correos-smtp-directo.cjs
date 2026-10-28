// Lee credenciales SMTP de CorreoInstitucional y envía correos de firma
const { Client } = require('pg');
const nodemailer = require('nodemailer');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

const CONDUCTOR_TOKEN = 'fac1bda7966bf4aad8eba7c97d06f6658eb1367320ee5e54900e3d179a091209';
const PROPIETARIO_TOKEN = '6071e4357f063f9db17ef5644598aa1f2590ebaa098fe650d45889759835d255';
const NUMERO_CONTRATO = 'CTR-20261028-000001';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Obtener credenciales SMTP
  const connRes = await client.query(`
    SELECT nombre, email, "smtpHost", "smtpPort", "smtpUser", "smtpPass",
           ssl, tls, starttls, "nombreRemitente", "aliasRemitente", "esPrincipal"
    FROM "CorreoInstitucional"
    WHERE "smtpHost" IS NOT NULL AND "smtpUser" IS NOT NULL
       AND estado = 'activo'
    ORDER BY "esPrincipal" DESC, prioridad ASC
    LIMIT 3
  `);

  if (connRes.rows.length === 0) {
    console.log('✗ No hay CorreoInstitucional con SMTP configurado');
    await client.end();
    return;
  }

  for (const c of connRes.rows) {
    console.log('=== CORREO INSTITUCIONAL DISPONIBLE ===');
    console.log('  Nombre:', c.nombre);
    console.log('  Email:', c.email);
    console.log('  SMTP Host:', c.smtpHost);
    console.log('  SMTP Port:', c.smtpPort);
    console.log('  SMTP User:', c.smtpUser);
    console.log('  SMTP Pass:', c.smtpPass ? `[presente, ${c.smtpPass.length} chars]` : '[vacío]');
    console.log('  SSL:', c.ssl, '| TLS:', c.tls, '| STARTTLS:', c.starttls);
    console.log('  Es principal:', c.esPrincipal);
  }

  const correo = connRes.rows[0]; // Usar el principal
  console.log('\n→ Usando:', correo.email, 'para enviar');

  // 2. Configurar transporter de nodemailer
  const transporter = nodemailer.createTransport({
    host: correo.smtpHost,
    port: correo.smtpPort || 587,
    secure: correo.smtpPort === 465,
    auth: {
      user: correo.smtpUser,
      pass: correo.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // 3. Enviar correo al CONDUCTOR
  const conductorLink = `https://jsadr.com.co/firma-contrato-vehiculo/${CONDUCTOR_TOKEN}`;
  const conductorEmail = 'yoimanfranco72@gmail.com';
  console.log('\n=== ENVIANDO AL CONDUCTOR ===');
  console.log('  Para:', conductorEmail);
  try {
    const info = await transporter.sendMail({
      from: `"${correo.nombreRemitente || correo.nombre}" <${correo.email}>`,
      to: conductorEmail,
      subject: `Contrato de Arrendamiento ${NUMERO_CONTRATO} - Vehículo DLW357 - Firma Electrónica`,
      text: `Estimado/a Yoiman Smith Franco Valderrama,

Se ha generado un contrato de arrendamiento de vehículo automotor a su nombre.

Número de contrato: ${NUMERO_CONTRATO}
Vehículo: Ford Fiesta 2012 - Placa DLW357
Modalidad: Semanal - $480.000/semana
Fecha de inicio: 24 de octubre de 2026
Fecha de terminación: 23 de enero de 2027
Arrendador: Johan Sebastian Alvarez Del Rio (CC 1214731649)

Para completar la firma electrónica del contrato, ingresa al siguiente enlace:
${conductorLink}

El enlace expira en 7 días. No compartas este enlace con nadie.

Saludos,
Sistema de Gestión de Arrendamiento de Vehículos - Jsadr`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e3a8a;">🚗 Contrato de Arrendamiento de Vehículo - Firma Electrónica</h2>
  <p>Estimado/a <strong>Yoiman Smith Franco Valderrama</strong>,</p>
  <p>Se ha generado un contrato de arrendamiento de vehículo automotor a su nombre con los siguientes datos:</p>
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Número de contrato:</strong> ${NUMERO_CONTRATO}</p>
    <p style="margin: 4px 0;"><strong>Vehículo:</strong> Ford Fiesta 2012 - Placa DLW357</p>
    <p style="margin: 4px 0;"><strong>Modalidad:</strong> Semanal - $480.000/semana</p>
    <p style="margin: 4px 0;"><strong>Fecha de inicio:</strong> 24 de octubre de 2026</p>
    <p style="margin: 4px 0;"><strong>Fecha de terminación:</strong> 23 de enero de 2027</p>
    <p style="margin: 4px 0;"><strong>Arrendador:</strong> Johan Sebastian Alvarez Del Rio (CC 1214731649)</p>
  </div>
  <p>Para completar la firma electrónica del contrato, ingresa al siguiente enlace:</p>
  <div style="text-align: center; margin: 25px 0;">
    <a href="${conductorLink}" style="background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      🔐 Firmar Contrato Electrónicamente
    </a>
  </div>
  <p style="color: #6b7280; font-size: 12px;">
    ⏰ El enlace expira en 7 días.<br>
    ⚠️ No compartas este enlace con nadie.<br>
    El contrato incluye sello de seguridad y código QR de autenticidad conforme a la Ley 527 de 1999.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 11px; text-align: center;">
    © 2026 Jsadr · Sistema de Gestión de Arrendamiento de Vehículos
  </p>
</div>`,
    });
    console.log('  ✓ Correo enviado! ID:', info.messageId);
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }

  // 4. Enviar correo al PROPIETARIO
  const propietarioLink = `https://jsadr.com.co/firma-contrato-vehiculo/${PROPIETARIO_TOKEN}`;
  const propietarioEmail = 'jsadr23@outlook.com';
  console.log('\n=== ENVIANDO AL PROPIETARIO ===');
  console.log('  Para:', propietarioEmail);
  try {
    const info = await transporter.sendMail({
      from: `"${correo.nombreRemitente || correo.nombre}" <${correo.email}>`,
      to: propietarioEmail,
      subject: `Contrato de Arrendamiento ${NUMERO_CONTRATO} - Vehículo DLW357 - Firma Electrónica (Propietario)`,
      text: `Estimado/a Johan Sebastian Alvarez Del Rio,

Se ha generado un contrato de arrendamiento de vehículo automotor en su condición de propietario/arrendador.

Número de contrato: ${NUMERO_CONTRATO}
Vehículo: Ford Fiesta 2012 - Placa DLW357
Modalidad: Semanal - $480.000/semana
Fecha de inicio: 24 de octubre de 2026
Fecha de terminación: 23 de enero de 2027
Arrendatario (Conductor): Yoiman Smith Franco Valderrama (CC 1037125498)

IMPORTANTE: El conductor debe firmar primero el contrato. Una vez que él complete su firma, podrás firmar tú como propietario usando este enlace:
${propietarioLink}

El enlace expira en 7 días. No compartas este enlace con nadie.

Saludos,
Sistema de Gestión de Arrendamiento de Vehículos - Jsadr`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e3a8a;">🚗 Contrato de Arrendamiento de Vehículo - Firma Electrónica</h2>
  <p>Estimado/a <strong>Johan Sebastian Alvarez Del Rio</strong>,</p>
  <p>Se ha generado un contrato de arrendamiento de vehículo automotor en su condición de propietario/arrendador:</p>
  <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Número de contrato:</strong> ${NUMERO_CONTRATO}</p>
    <p style="margin: 4px 0;"><strong>Vehículo:</strong> Ford Fiesta 2012 - Placa DLW357</p>
    <p style="margin: 4px 0;"><strong>Modalidad:</strong> Semanal - $480.000/semana</p>
    <p style="margin: 4px 0;"><strong>Fecha de inicio:</strong> 24 de octubre de 2026</p>
    <p style="margin: 4px 0;"><strong>Fecha de terminación:</strong> 23 de enero de 2027</p>
    <p style="margin: 4px 0;"><strong>Arrendatario (Conductor):</strong> Yoiman Smith Franco Valderrama (CC 1037125498)</p>
  </div>
  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
    <p style="margin: 0; color: #92400e; font-size: 13px;">
      ⚠️ <strong>Importante:</strong> El conductor debe firmar primero el contrato. Una vez que él complete su firma, podrás firmar tú como propietario usando este enlace.
    </p>
  </div>
  <p>Enlace para tu firma electrónica:</p>
  <div style="text-align: center; margin: 25px 0;">
    <a href="${propietarioLink}" style="background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      🔐 Firmar Contrato como Propietario
    </a>
  </div>
  <p style="color: #6b7280; font-size: 12px;">
    ⏰ El enlace expira en 7 días.<br>
    ⚠️ No compartas este enlace con nadie.<br>
    El contrato incluye sello de seguridad y código QR de autenticidad conforme a la Ley 527 de 1999.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 11px; text-align: center;">
    © 2026 Jsadr · Sistema de Gestión de Arrendamiento de Vehículos
  </p>
</div>`,
    });
    console.log('  ✓ Correo enviado! ID:', info.messageId);
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }

  await client.end();
  console.log('\n=== ENVÍO COMPLETADO ===');
}

main().catch(e => { console.error(e); process.exit(1); });
