// =====================================================
// enviar-otp-prestamos-pendientes-v2.cjs
// =====================================================
// Versión segura del script de envío de OTP que:
//   1. Lee la clave Brevo desde .env (BREVO_SMTP_KEY) — NO hardcodeada
//   2. NO sobrescribe las credenciales ya guardadas en ConexionAPI/CorreoInstitucional
//      (esas credenciales están protegidas con clave maestra "Eliminar")
//   3. Solo verifica SMTP y envía los OTPs
//
// Pasos:
//   1. Cargar .env, leer BREVO_SMTP_KEY
//   2. Verificar SMTP con transporter.verify()
//   3. Buscar 20 préstamos en estado PENDIENTE_ACEPTACION
//   4. Para cada uno: generar OTP, registrarlo en OtpRegistro, enviar correo
//   5. Registrar cada envío en EnvioCorreo
// =====================================================

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

// Cargar .env manualmente
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Brevo config (lee la key desde .env, no hardcodeada)
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: process.env.BREVO_SMTP_KEY,
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr · Jo*** Se*** Al*** D** R**',
}

if (!BREVO.pass) {
  console.error('❌ BREVO_SMTP_KEY no definido en .env')
  process.exit(1)
}

console.log(`Brevo key cargada: ${BREVO.pass.slice(0, 25)}...${BREVO.pass.slice(-6)}`)

// Helpers
function generarOtpNumerico(length = 6) {
  const max = Math.pow(10, length)
  const n = crypto.randomInt(0, max)
  return n.toString().padStart(length, '0')
}

function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

async function verificarSmtp() {
  const transporter = nodemailer.createTransport({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    auth: { user: BREVO.user, pass: BREVO.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
  console.log('  [verify] Conectando a smtp-relay.brevo.com:587...')
  await transporter.verify()
  console.log('  ✓ SMTP verificado: conexión + autenticación OK')
  return transporter
}

async function buscarPendientes() {
  const pendientes = await prisma.prestamo.findMany({
    where: { estado: 'PENDIENTE_ACEPTACION' },
    include: {
      cliente: { select: { id: true, nombre: true, email: true, telefono: true, cedula: true } },
    },
    orderBy: { fechaSolicitud: 'asc' },
    take: 20,
  })
  console.log(`  ✓ ${pendientes.length} préstamos PENDIENTE_ACEPTACION encontrados`)
  return pendientes
}

async function dispararOtps(pendientes, transporter) {
  const resultados = []
  let exito = 0
  let fallo = 0

  for (const p of pendientes) {
    const destinatario = p.cliente?.email
    const nombreCliente = p.cliente?.nombre || 'Cliente'
    const cedula = p.cliente?.cedula || null

    console.log(`\n  [${p.codigo}] cliente="${nombreCliente}" email="${destinatario}"`)

    if (!destinatario) {
      console.log('    ✗ El cliente no tiene email registrado — saltando')
      resultados.push({ codigo: p.codigo, success: false, error: 'sin email', destinatario: null })
      fallo++
      continue
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(destinatario)) {
      console.log(`    ✗ Email inválido: "${destinatario}" — saltando`)
      resultados.push({ codigo: p.codigo, success: false, error: 'email inválido', destinatario })
      fallo++
      continue
    }

    // Generar OTP
    const otp = generarOtpNumerico(6)
    const otpHash = hashOtp(otp)

    try {
      // Registrar OTP en OtpRegistro
      const otpRegistro = await prisma.otpRegistro.create({
        data: {
          clienteId: p.clienteId,
          clienteCedula: cedula,
          clienteNombre: nombreCliente,
          codigoHash: otpHash,
          codigoPlano: null, // no guardar en claro en BD
          metodo: 'EMAIL',
          destinatario,
          tipo: 'FIRMA_ELECTRONICA',
          entidadRefId: p.id,
          descripcion: `OTP para aceptar T&C del préstamo ${p.codigo}`,
          intentos: 0,
          maxIntentos: 3,
          usado: false,
          bloqueado: false,
          expiraEn: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
          verificado: false,
        },
      })

      const subject = `Tu código OTP para aceptar el préstamo ${p.codigo}`
      const textBody = `Hola ${nombreCliente},

Tu código OTP para aceptar los términos y condiciones del préstamo ${p.codigo} es:

    ${otp}

Este código expira en 10 minutos.
Si no solicitaste este código, ignora este correo.

— Jsadr · Jo*** Se*** Al*** D** R**`
      const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; background: #f9fafb;">
  <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <h2 style="margin: 0 0 8px; color: #111827;">Hola ${nombreCliente},</h2>
    <p style="margin: 0 0 20px; color: #4b5563;">
      Recibiste este correo porque tienes un préstamo pendiente de aceptación.
      Usa el siguiente código para confirmar:
    </p>
    <div style="background: #f3f4f6; border-left: 4px solid #16a34a; padding: 16px 20px; margin: 16px 0; border-radius: 6px;">
      <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Código OTP</div>
      <div style="font-size: 32px; font-weight: bold; color: #16a34a; font-family: 'Courier New', monospace; letter-spacing: 4px;">${otp}</div>
    </div>
    <p style="margin: 12px 0; color: #4b5563; font-size: 14px;">
      <strong>Préstamo:</strong> ${p.codigo}<br>
      <strong>Expira en:</strong> 10 minutos
    </p>
    <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">
      Si no solicitaste este código, ignora este correo. No se realizará ninguna acción.
    </p>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
    Jsadr · Jo*** Se*** Al*** D** R** — Plataforma de Préstamos
  </p>
</div>`

      // Enviar correo
      const info = await transporter.sendMail({
        from: `"${BREVO.fromName}" <${BREVO.fromEmail}>`,
        to: destinatario,
        subject,
        text: textBody,
        html: htmlBody,
      })

      // Registrar envío en EnvioCorreo
      await prisma.envioCorreo.create({
        data: {
          correoInstitucionalId: null,
          remitenteEmail: BREVO.fromEmail,
          destinatario,
          asunto: subject,
          cuerpo: htmlBody,
          formato: 'html',
          estado: 'ENVIADO',
          intentos: 1,
          fechaEnvio: new Date(),
          metadata: JSON.stringify({
            otpRegistroId: otpRegistro.id,
            prestamoId: p.id,
            prestamoCodigo: p.codigo,
            messageId: info.messageId,
            response: info.response,
          }),
        },
      })

      // Marcar préstamo: tycEnviado=true, metodoConfirmacion=CORREO
      await prisma.prestamo.update({
        where: { id: p.id },
        data: {
          tycEnviado: true,
          metodoConfirmacion: 'CORREO',
        },
      })

      console.log(`    ✓ OTP ${otp} enviado → messageId=${info.messageId}`)
      resultados.push({
        codigo: p.codigo,
        success: true,
        otp,
        messageId: info.messageId,
        destinatario,
        otpRegistroId: otpRegistro.id,
      })
      exito++
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`)

      try {
        await prisma.envioCorreo.create({
          data: {
            remitenteEmail: BREVO.fromEmail,
            destinatario,
            asunto: `OTP préstamo ${p.codigo}`,
            cuerpo: '(fallo de envío)',
            formato: 'html',
            estado: 'FALLIDO',
            intentos: 1,
            mensajeError: err.message,
            metadata: JSON.stringify({ prestamoId: p.id, prestamoCodigo: p.codigo }),
          },
        })
      } catch (e2) {
        console.log(`    (no se pudo registrar en EnvioCorreo: ${e2.message})`)
      }

      resultados.push({ codigo: p.codigo, success: false, error: err.message, destinatario })
      fallo++
    }

    // Pausa de 500ms entre envíos para no saturar Brevo
    await new Promise(r => setTimeout(r, 500))
  }

  return { resultados, exito, fallo }
}

async function main() {
  console.log('========================================================')
  console.log('ENVÍO DE OTP A PRÉSTAMOS PENDIENTES — JSADR (v2)')
  console.log('========================================================\n')

  console.log('[Paso 1] Verificando conectividad SMTP con Brevo...')
  const transporter = await verificarSmtp()

  console.log('\n[Paso 2] Buscando préstamos PENDIENTE_ACEPTACION...')
  const pendientes = await buscarPendientes()

  console.log('\n[Paso 3] Disparando OTP a cada préstamo...\n')
  const { resultados, exito, fallo } = await dispararOtps(pendientes, transporter)

  console.log('\n========================================================')
  console.log('RESUMEN FINAL')
  console.log('========================================================')
  console.log(`Total préstamos pendientes: ${pendientes.length}`)
  console.log(`OTP enviados con éxito:    ${exito}`)
  console.log(`Fallos:                     ${fallo}`)
  console.log(`Tasa de éxito:              ${(exito * 100 / Math.max(pendientes.length, 1)).toFixed(1)}%`)
  console.log('\nDetalle por préstamo:')
  resultados.forEach(r => {
    if (r.success) {
      console.log(`  ✓ ${r.codigo} → ${r.destinatario} (OTP=${r.otp}, msgId=${r.messageId})`)
    } else {
      console.log(`  ✗ ${r.codigo} → ${r.destinatario || '(sin email)'} (error: ${r.error})`)
    }
  })

  // Guardar reporte
  const reportPath = path.join(__dirname, '..', 'download', `reporte-otp-prestamos-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify({
    fecha: new Date().toISOString(),
    total: pendientes.length,
    exito,
    fallo,
    resultados,
  }, null, 2))
  console.log(`\nReporte guardado en: ${reportPath}`)
}

main()
  .catch(e => {
    console.error('\n❌ ERROR FATAL:', e.message)
    if (e.stack) console.error(e.stack)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
