// =====================================================
// enviar-otp-con-key.js
// =====================================================
// Variante del script principal que acepta la SMTP key de Brevo
// como argumento (cuando la key anterior está caducada).
//
// Uso:
//   node scripts/enviar-otp-con-key.js "NUEVA_SMTP_KEY_AQUI"
//
// O seteando la variable de entorno:
//   BREVO_SMTP_KEY="..." node scripts/enviar-otp-con-key.js
// =====================================================

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// --- SMTP key provista por el usuario ---
// Prioridad: argumento CLI > variable de entorno
// (esto evita que una key vieja en .env pise la nueva passada por CLI)
const SMTP_KEY = process.argv[2] || process.env.BREVO_SMTP_KEY

if (!SMTP_KEY) {
  console.error('❌ Falta la SMTP key de Brevo.')
  console.error('   Uso: node scripts/enviar-otp-con-key.js "TU_SMTP_KEY"')
  console.error('   O:   BREVO_SMTP_KEY="..." node scripts/enviar-otp-con-key.js')
  console.error('')
  console.error('   Obtenla en: https://app-smtp.brevo.com/')
  console.error('   (Brevo → SMTP & API → SMTP tab → Generate SMTP key)')
  process.exit(1)
}

// --- Constantes Brevo ---
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: SMTP_KEY,
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr · Jo*** Se*** Al*** D** R**',
}

// --- helpers de cifrado ---
function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}
function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}
function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}
function generarOtpNumerico(length = 6) {
  const max = Math.pow(10, length)
  const n = crypto.randomInt(0, max)
  return n.toString().padStart(length, '0')
}

// --- Helper para actualizar .env con la nueva key ---
function actualizarEnvConKey(key) {
  const envPath = path.join(__dirname, '..', '.env')
  let envContent = fs.readFileSync(envPath, 'utf8')
  if (/^BREVO_SMTP_KEY=/m.test(envContent)) {
    envContent = envContent.replace(/^BREVO_SMTP_KEY=.*$/m, `BREVO_SMTP_KEY="${key}"`)
  } else {
    envContent += `\nBREVO_SMTP_KEY="${key}"\n`
  }
  fs.writeFileSync(envPath, envContent)
  process.env.BREVO_SMTP_KEY = key
}

// --- Sincronizar Brevo en BD ---
async function sincronizarBrevo() {
  const encryptedPass = encrypt(BREVO.pass)

  // CorreoInstitucional
  let correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (correo) {
    correo = await prisma.correoInstitucional.update({
      where: { id: correo.id },
      data: {
        smtpHost: BREVO.host, smtpPort: BREVO.port, smtpUser: BREVO.user,
        smtpPass: encryptedPass, ssl: false, tls: true, starttls: true,
        ultimoTest: null, ultimoTestOk: null,
      },
    })
    console.log(`  ✓ CorreoInstitucional actualizado (id=${correo.id})`)
  } else {
    correo = await prisma.correoInstitucional.create({
      data: {
        nombre: 'Brevo (correo institucional principal)',
        email: BREVO.fromEmail, tipo: 'SMTP', responsable: 'sistema',
        estado: 'activo', prioridad: 1, esPrincipal: true, esRespaldo: false, esNoReply: false,
        smtpHost: BREVO.host, smtpPort: BREVO.port, smtpUser: BREVO.user,
        smtpPass: encryptedPass, smtpAuthType: 'LOGIN',
        ssl: false, tls: true, starttls: true, timeout: 30, maxReintentos: 3,
        limitePorMinuto: 60, nombreRemitente: BREVO.fromName, aliasRemitente: BREVO.fromEmail,
      },
    })
    console.log(`  ✓ CorreoInstitucional creado (id=${correo.id})`)
  }

  // ConexionAPI EMAIL_SMTP
  const existing = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const e of existing) await prisma.conexionAPI.delete({ where: { id: e.id } })

  const configuracionExtra = JSON.stringify({
    host: BREVO.host, port: BREVO.port, secure: false, requireTLS: true,
    fromName: BREVO.fromName, fromEmail: BREVO.fromEmail,
  })

  await prisma.conexionAPI.create({
    data: {
      nombre: 'Brevo SMTP (correo institucional)',
      tipo: 'EMAIL_SMTP',
      descripcion: 'Relay SMTP de Brevo (smtp-relay.brevo.com:587). 300 correos/día gratis.',
      url: `${BREVO.host}:${BREVO.port}`,
      apiKey: BREVO.fromEmail, usuario: BREVO.user, password: encryptedPass,
      configuracionExtra, activa: true, probada: false,
    },
  })
  console.log('  ✓ ConexionAPI EMAIL_SMTP creada/actualizada')
}

// --- Verificar SMTP ---
async function verificarSmtp() {
  const transporter = nodemailer.createTransport({
    host: BREVO.host, port: BREVO.port, secure: false, requireTLS: true,
    auth: { user: BREVO.user, pass: BREVO.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
  })
  console.log('  [verify] Conectando a smtp-relay.brevo.com:587...')
  await transporter.verify()
  console.log('  ✓ SMTP verificado: conexión + autenticación OK')
  return transporter
}

// --- Disparar OTP ---
async function dispararOtps(transporter) {
  const pendientes = await prisma.prestamo.findMany({
    where: { estado: 'PENDIENTE_ACEPTACION' },
    include: { cliente: { select: { id: true, nombre: true, email: true, telefono: true, cedula: true } } },
    orderBy: { fechaSolicitud: 'asc' },
  })
  console.log(`  ✓ ${pendientes.length} préstamos PENDIENTE_ACEPTACION encontrados\n`)

  const resultados = []
  let exito = 0, fallo = 0

  for (const p of pendientes) {
    const destinatario = p.cliente?.email
    const nombreCliente = p.cliente?.nombre || 'Cliente'
    const cedula = p.cliente?.cedula || null

    console.log(`  [${p.codigo}] cliente="${nombreCliente}" email="${destinatario}"`)

    if (!destinatario) {
      console.log('    ✗ sin email — saltando')
      resultados.push({ codigo: p.codigo, success: false, error: 'sin email', destinatario: null })
      fallo++; continue
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(destinatario)) {
      console.log(`    ✗ email inválido: "${destinatario}"`)
      resultados.push({ codigo: p.codigo, success: false, error: 'email inválido', destinatario })
      fallo++; continue
    }

    const otp = generarOtpNumerico(6)
    const otpHash = hashOtp(otp)

    try {
      const otpRegistro = await prisma.otpRegistro.create({
        data: {
          clienteId: p.clienteId, clienteCedula: cedula, clienteNombre: nombreCliente,
          codigoHash: otpHash, codigoPlano: otp,
          metodo: 'EMAIL', destinatario, tipo: 'FIRMA_ELECTRONICA',
          entidadRefId: p.id, descripcion: `OTP para aceptar T&C del préstamo ${p.codigo}`,
          intentos: 0, maxIntentos: 3, usado: false, bloqueado: false,
          expiraEn: new Date(Date.now() + 10 * 60 * 1000), verificado: false,
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

      const info = await transporter.sendMail({
        from: `"${BREVO.fromName}" <${BREVO.fromEmail}>`,
        to: destinatario, subject, text: textBody, html: htmlBody,
      })

      await prisma.envioCorreo.create({
        data: {
          remitenteEmail: BREVO.fromEmail, destinatario, asunto: subject,
          cuerpo: htmlBody, formato: 'html', estado: 'ENVIADO',
          intentos: 1, fechaEnvio: new Date(),
          metadata: JSON.stringify({
            otpRegistroId: otpRegistro.id, prestamoId: p.id, prestamoCodigo: p.codigo,
            messageId: info.messageId, response: info.response,
          }),
        },
      })

      await prisma.prestamo.update({
        where: { id: p.id },
        data: { tycEnviado: true, metodoConfirmacion: 'CORREO' },
      })

      console.log(`    ✓ OTP ${otp} enviado → messageId=${info.messageId}`)
      resultados.push({ codigo: p.codigo, success: true, otp, messageId: info.messageId, destinatario })
      exito++
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`)
      try {
        await prisma.envioCorreo.create({
          data: {
            remitenteEmail: BREVO.fromEmail, destinatario,
            asunto: `OTP préstamo ${p.codigo}`, cuerpo: '(fallo)',
            formato: 'html', estado: 'FALLIDO', intentos: 1,
            mensajeError: err.message,
            metadata: JSON.stringify({ prestamoId: p.id, prestamoCodigo: p.codigo }),
          },
        })
      } catch (e2) {}
      resultados.push({ codigo: p.codigo, success: false, error: err.message, destinatario })
      fallo++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  return { resultados, exito, fallo, total: pendientes.length }
}

// --- Main ---
async function main() {
  console.log('========================================================')
  console.log('ENVÍO DE OTP A PRÉSTAMOS PENDIENTES — JSADR (con key Brevo nueva)')
  console.log('========================================================\n')

  console.log(`[Paso 1] SMTP key recibida: ${SMTP_KEY.substring(0, 4)}...${SMTP_KEY.substring(SMTP_KEY.length - 4)}`)
  actualizarEnvConKey(SMTP_KEY)
  console.log('  ✓ .env actualizado con la nueva key\n')

  console.log('[Paso 2] Sincronizando credenciales Brevo con BD...')
  await sincronizarBrevo()

  console.log('\n[Paso 3] Verificando conectividad SMTP...')
  const transporter = await verificarSmtp()

  console.log('\n[Paso 4] Disparando OTP a préstamos pendientes...\n')
  const { resultados, exito, fallo, total } = await dispararOtps(transporter)

  console.log('\n========================================================')
  console.log('RESUMEN FINAL')
  console.log('========================================================')
  console.log(`Total préstamos pendientes: ${total}`)
  console.log(`OTP enviados con éxito:    ${exito}`)
  console.log(`Fallos:                     ${fallo}`)
  console.log(`Tasa de éxito:              ${(exito * 100 / total).toFixed(1)}%`)
  console.log('\nDetalle:')
  resultados.forEach(r => {
    if (r.success) {
      console.log(`  ✓ ${r.codigo} → ${r.destinatario} (OTP=${r.otp}, msgId=${r.messageId})`)
    } else {
      console.log(`  ✗ ${r.codigo} → ${r.destinatario || '(sin email)'} (error: ${r.error})`)
    }
  })

  const reportPath = path.join(__dirname, '..', 'download', `reporte-otp-prestamos-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify({
    fecha: new Date().toISOString(), total, exito, fallo, resultados,
  }, null, 2))
  console.log(`\nReporte guardado en: ${reportPath}`)
}

main().catch(e => {
  console.error('\n❌ ERROR:', e.message)
  process.exit(1)
}).finally(() => prisma.$disconnect())
