// =====================================================
// enviar-otp-prestamos-pendientes.js
// =====================================================
// Ejecuta el flujo completo:
//   1. Verifica/crea variables .env (API_ENCRYPTION_KEY, BREVO_SMTP_KEY)
//   2. Sincroniza Brevo a ConexionAPI (tabla que lee src/lib/email.ts)
//   3. Crea CorreoInstitucional principal si no existe
//   4. Verifica SMTP con transporter.verify()
//   5. Busca los 20 préstamos en estado PENDIENTE_ACEPTACION
//   6. Para cada uno: genera OTP, lo hashea, lo registra en OtpRegistro,
//      y envía el correo con el código en claro al cliente.
//   7. Registra cada envío en EnvioCorreo con estado final.
// =====================================================

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// --- Constantes Brevo (vinculadas por el usuario) ---
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: 'bGDw0LrI7XAtJF5M', // SMTP key de Brevo (NO la contraseña del panel)
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr · Jo*** Se*** Al*** D** R**',
}

// --- Helpers de cifrado (réplica de src/lib/security.ts) ---
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
function decrypt(encText) {
  const parts = encText.split(':')
  if (parts.length !== 2) return encText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv)
  let dec = decipher.update(parts[1], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// --- Helper para generar OTP numérico de 6 dígitos (CSPRNG) ---
function generarOtpNumerico(length = 6) {
  const max = Math.pow(10, length)
  const n = crypto.randomInt(0, max)
  return n.toString().padStart(length, '0')
}

// --- Helper para hashear OTP (SHA-256) ---
function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// --- Paso 1: Asegurar .env ---
function asegurarEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  let envContent = fs.readFileSync(envPath, 'utf8')
  let modified = false

  if (!/^API_ENCRYPTION_KEY=/m.test(envContent)) {
    const newKey = crypto.randomBytes(32).toString('hex')
    envContent += `\nAPI_ENCRYPTION_KEY="${newKey}"\n`
    console.log(`  ✓ API_ENCRYPTION_KEY generada y agregada a .env`)
    modified = true
  } else if (/^API_ENCRYPTION_KEY=""\s*$/m.test(envContent)) {
    const newKey = crypto.randomBytes(32).toString('hex')
    envContent = envContent.replace(
      /^API_ENCRYPTION_KEY=""\s*$/m,
      `API_ENCRYPTION_KEY="${newKey}"`
    )
    console.log(`  ✓ API_ENCRYPTION_KEY estaba vacía, generada y seteada en .env`)
    modified = true
  } else {
    console.log('  ✓ API_ENCRYPTION_KEY ya presente en .env')
  }

  if (!/^BREVO_SMTP_KEY=/m.test(envContent)) {
    envContent += `BREVO_SMTP_KEY="${BREVO.pass}"\n`
    console.log(`  ✓ BREVO_SMTP_KEY agregada a .env`)
    modified = true
  } else {
    console.log('  ✓ BREVO_SMTP_KEY ya presente en .env')
  }

  if (modified) {
    fs.writeFileSync(envPath, envContent)
    // Recargar env vars en este proceso
    const newEnv = Object.fromEntries(
      envContent.split('\n')
        .filter(l => l.includes('='))
        .map(l => {
          const [k, ...v] = l.split('=')
          let val = v.join('=').trim()
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
          return [k.trim(), val]
        })
    )
    Object.assign(process.env, newEnv)
  }
}

// --- Paso 2: Sincronizar Brevo a ConexionAPI + CorreoInstitucional ---
async function sincronizarBrevo() {
  const encryptedPass = encrypt(BREVO.pass)
  // Roundtrip check
  if (decrypt(encryptedPass) !== BREVO.pass) {
    throw new Error('Roundtrip de encriptación fallido — la API_ENCRYPTION_KEY no funciona')
  }
  console.log('  ✓ Roundtrip AES-256-CBC OK')

  // 2a. Crear/actualizar CorreoInstitucional principal
  let correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) {
    correo = await prisma.correoInstitucional.create({
      data: {
        nombre: 'Brevo (correo institucional principal)',
        email: BREVO.fromEmail,
        tipo: 'SMTP',
        responsable: 'sistema',
        estado: 'activo',
        prioridad: 1,
        esPrincipal: true,
        esRespaldo: false,
        esNoReply: false,
        smtpHost: BREVO.host,
        smtpPort: BREVO.port,
        smtpUser: BREVO.user,
        smtpPass: encryptedPass,
        smtpAuthType: 'LOGIN',
        ssl: false,
        tls: true,
        starttls: true,
        timeout: 30,
        maxReintentos: 3,
        limitePorMinuto: 60,
        nombreRemitente: BREVO.fromName,
        aliasRemitente: BREVO.fromEmail,
        ultimoTest: null,
        ultimoTestOk: null,
      },
    })
    console.log(`  ✓ CorreoInstitucional creado (id=${correo.id})`)
  } else {
    correo = await prisma.correoInstitucional.update({
      where: { id: correo.id },
      data: {
        smtpHost: BREVO.host,
        smtpPort: BREVO.port,
        smtpUser: BREVO.user,
        smtpPass: encryptedPass,
        ssl: false, tls: true, starttls: true,
        ultimoTest: null, ultimoTestOk: null,
      },
    })
    console.log(`  ✓ CorreoInstitucional actualizado (id=${correo.id})`)
  }

  // 2b. Reemplazar ConexionAPI EMAIL_SMTP
  const existing = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const e of existing) {
    await prisma.conexionAPI.delete({ where: { id: e.id } })
  }
  if (existing.length > 0) {
    console.log(`  ✓ ${existing.length} registro(s) EMAIL_SMTP previo(s) eliminado(s)`)
  }

  const configuracionExtra = JSON.stringify({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    fromName: BREVO.fromName,
    fromEmail: BREVO.fromEmail,
  })

  const conn = await prisma.conexionAPI.create({
    data: {
      nombre: 'Brevo SMTP (correo institucional)',
      tipo: 'EMAIL_SMTP',
      descripcion: 'Relay SMTP de Brevo (smtp-relay.brevo.com:587). 300 correos/día gratis.',
      url: `${BREVO.host}:${BREVO.port}`,
      apiKey: BREVO.fromEmail,
      usuario: BREVO.user,
      password: encryptedPass,
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })
  console.log(`  ✓ ConexionAPI EMAIL_SMTP creada (id=${conn.id})`)
}

// --- Paso 3: Verificar SMTP ---
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

// --- Paso 4: Buscar préstamos pendientes ---
async function buscarPendientes() {
  const pendientes = await prisma.prestamo.findMany({
    where: { estado: 'PENDIENTE_ACEPTACION' },
    include: {
      cliente: { select: { id: true, nombre: true, email: true, telefono: true, cedula: true } },
    },
    orderBy: { fechaSolicitud: 'asc' },
  })
  console.log(`  ✓ ${pendientes.length} préstamos PENDIENTE_ACEPTACION encontrados`)
  return pendientes
}

// --- Paso 5: Disparar OTP a cada préstamo ---
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

    // Validar email
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
          codigoPlano: process.env.NODE_ENV === 'production' ? null : otp,
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

      // Construir correo
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
          correoInstitucionalId: null, // se setea abajo si lo necesitamos
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

      // Actualizar préstamo: marcar tycEnviado=true
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

      // Registrar fallo en EnvioCorreo
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

    // Pausa de 300ms entre envíos para no saturar Brevo
    await new Promise(r => setTimeout(r, 300))
  }

  return { resultados, exito, fallo }
}

// --- Main ---
async function main() {
  console.log('========================================================')
  console.log('ENVÍO DE OTP A PRÉSTAMOS PENDIENTES — JSADR')
  console.log('========================================================\n')

  console.log('[Paso 1] Verificando .env...')
  asegurarEnv()

  console.log('\n[Paso 2] Sincronizando credenciales Brevo con BD...')
  await sincronizarBrevo()

  console.log('\n[Paso 3] Verificando conectividad SMTP con Brevo...')
  const transporter = await verificarSmtp()

  console.log('\n[Paso 4] Buscando préstamos PENDIENTE_ACEPTACION...')
  const pendientes = await buscarPendientes()

  console.log('\n[Paso 5] Disparando OTP a cada préstamo...\n')
  const { resultados, exito, fallo } = await dispararOtps(pendientes, transporter)

  console.log('\n========================================================')
  console.log('RESUMEN FINAL')
  console.log('========================================================')
  console.log(`Total préstamos pendientes: ${pendientes.length}`)
  console.log(`OTP enviados con éxito:    ${exito}`)
  console.log(`Fallos:                     ${fallo}`)
  console.log(`Tasa de éxito:              ${(exito * 100 / pendientes.length).toFixed(1)}%`)
  console.log('\nDetalle por préstamo:')
  resultados.forEach(r => {
    if (r.success) {
      console.log(`  ✓ ${r.codigo} → ${r.destinatario} (OTP=${r.otp}, msgId=${r.messageId})`)
    } else {
      console.log(`  ✗ ${r.codigo} → ${r.destinatario || '(sin email)'} (error: ${r.error})`)
    }
  })

  // Guardar reporte en archivo
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
