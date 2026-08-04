// =====================================================
// PRUEBA E2E: Crear clientes + créditos + enviar OTP
// =====================================================
// Crea 5 clientes de prueba con los emails proporcionados,
// les envía:
//   1. Un correo "prueba invitacion"
//   2. Crea un crédito para cada uno
//   3. Dispara el OTP de firma del crédito y lo envía por correo
//
// Al final imprime un reporte con MessageIds y estado de cada envío.
// =====================================================

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const nodemailer = require('nodemailer')
const prisma = new PrismaClient()

// --- helpers de cifrado ---
function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido en .env')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
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
function hashOtp(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex')
}

// --- obtiene config SMTP desde conexionAPI (igual que src/lib/email.ts) ---
async function obtenerTransporter() {
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!conexion) throw new Error('No hay SMTP configurado en conexionAPI')

  let host = '', port = 587, secure = false
  let fromName = 'Sistema de Préstamos', fromEmail = ''

  if (conexion.configuracionExtra) {
    const extra = JSON.parse(conexion.configuracionExtra)
    if (extra.host) host = extra.host
    if (extra.port) port = parseInt(extra.port)
    if (extra.secure !== undefined) secure = !!extra.secure
    if (extra.fromName) fromName = extra.fromName
    if (extra.fromEmail) fromEmail = extra.fromEmail
  }
  if (!host && conexion.url) {
    const parts = conexion.url.split(':')
    host = parts[0]
    if (parts[1]) port = parseInt(parts[1])
  }
  const user = conexion.usuario || ''
  const pass = decrypt(conexion.password)
  if (!fromEmail) fromEmail = conexion.apiKey || user

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
  return { transporter, fromName, fromEmail }
}

// --- genera OTP numérico de 6 dígitos (igual que src/lib/otp.ts) ---
function generarCodigoOtp(tipo = 'numeric', length = 6) {
  if (tipo === 'numeric') {
    const max = Math.pow(10, length)
    const n = crypto.randomInt(0, max)
    return n.toString().padStart(length, '0')
  }
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHA[bytes[i] % ALPHA.length]
  }
  return out
}

// --- 5 emails de prueba ---
const EMAILS = [
  'jsadr23@gmail.com',
  'jsadr23@outlook.com',
  'jhoan-1029@hotmail.com',
  'johan-1029@hotmail.com',
  'jsadr29@gmail.com',
]

async function main() {
  console.log('=== PRUEBA E2E — Sistema OTP + Email ===\n')
  console.log('Emails destino:', EMAILS.length, 'direcciones\n')

  const { transporter, fromName, fromEmail } = await obtenerTransporter()
  console.log('✓ Transporter listo:', fromEmail, '\n')

  const resultados = []

  for (let i = 0; i < EMAILS.length; i++) {
    const email = EMAILS[i]
    const nombreCliente = `prueba ${email.split('@')[0]}`  // "prueba jsadr23" etc.
    const cedula = `90000${(i + 1).toString().padStart(5, '0')}`  // 90000001..5
    const telefono = `300000000${i + 1}`
    console.log(`\n--- [${i + 1}/5] Procesando: ${email} ---`)
    const resultado = { email, nombre: nombreCliente, cedula, enviados: [] }

    // ============= PASO 1: Crear o buscar cliente =============
    let cliente = await prisma.cliente.findFirst({ where: { email } })
    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nombre: nombreCliente,
          cedula,
          email,
          telefono,
          activo: true,
        },
      })
      console.log(`  ✓ Cliente creado: ${cliente.id} (cedula=${cedula})`)
    } else {
      console.log(`  ✓ Cliente existente: ${cliente.id}`)
    }

    // ============= PASO 2: Enviar correo "prueba invitacion" =============
    const codigoPrestamo = `PREST-PRUEBA-${Date.now().toString().slice(-6)}-${i + 1}`
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'prueba invitacion — Jo*** Se*** Al*** D** R**',
        text: `Hola ${nombreCliente},

Este es un correo de prueba invitacion de Jo*** Se*** Al*** D** R**.

Si recibes este correo, la configuración SMTP está funcionando correctamente.

Datos del cliente:
- Nombre: ${nombreCliente}
- Email: ${email}
- Cédula: ${cedula}
- Teléfono: ${telefono}

Fecha: ${new Date().toISOString()}

— Jo*** Se*** Al*** D** R**`,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af;">Jo*** Se*** Al*** D** R** — prueba invitacion</h2>
  <p>Hola <strong>${nombreCliente}</strong>,</p>
  <p>Este es un correo de <strong>prueba invitacion</strong> de Jo*** Se*** Al*** D** R**.</p>
  <p>Si recibes este correo, la configuración SMTP está funcionando correctamente.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Nombre</td><td style="padding: 8px;">${nombreCliente}</td></tr>
    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Email</td><td style="padding: 8px;">${email}</td></tr>
    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Cédula</td><td style="padding: 8px;">${cedula}</td></tr>
    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Teléfono</td><td style="padding: 8px;">${telefono}</td></tr>
    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold;">Fecha</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
  </table>
  <p style="color: #6b7280; font-size: 13px;">Jo*** Se*** Al*** D** R** v4.0</p>
</div>`,
      })
      console.log(`  ✓ [INVITACION] MessageId: ${info.messageId}`)
      resultado.enviados.push({ tipo: 'INVITACION', messageId: info.messageId, response: info.response })
    } catch (e) {
      console.error(`  ✗ [INVITACION] Falló: ${e.message}`)
      resultado.enviados.push({ tipo: 'INVITACION', error: e.message })
    }

    // ============= PASO 3: Crear préstamo =============
    const montoPrincipal = 1000000 * (i + 1)  // 1M, 2M, 3M, 4M, 5M
    const plazoMeses = 12
    const tasaInteresAnual = 24  // 24% anual
    const tasaMensual = tasaInteresAnual / 12 / 100
    const montoCuota = Math.round((montoPrincipal * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses)))
    const totalPagar = montoCuota * plazoMeses
    const totalInteres = totalPagar - montoPrincipal

    let prestamo = await prisma.prestamo.create({
      data: {
        codigo: codigoPrestamo,
        clienteId: cliente.id,
        montoPrincipal,
        montoCuota,
        numeroCuotas: plazoMeses,
        totalPagar,
        totalInteres,
        tasaAplicada: tasaInteresAnual,  // tasa efectiva aplicada
        plazoMeses,
        frecuencia: 'MENSUAL',
        tasaInteresAnual,
        tasaInteresMensual: tasaMensual * 100,
        tasaMoraDiaria: 0.1,  // 0.1% diario
        estado: 'PENDIENTE_ACEPTACION',
        fechaSolicitud: new Date(),
        fechaDesembolso: null,
        fechaVencimiento: null,
        tycAceptado: false,
      },
    })
    console.log(`  ✓ Préstamo creado: ${prestamo.codigo} (monto=$${montoPrincipal.toLocaleString('es-CO')})`)

    // ============= PASO 4: Crear firma electrónica + OTP =============
    const otp = generarCodigoOtp('numeric', 6)
    const otpHash = hashOtp(otp)
    const fechaEnvio = new Date()
    const expiraEn = new Date(fechaEnvio.getTime() + 5 * 60 * 1000)

    const firma = await prisma.firmaElectronica.create({
      data: {
        prestamoId: prestamo.id,
        clienteId: cliente.id,
        tipo: 'TYC',
        imagenFirma: '',
        otpEnviado: true,
        otpCodigo: otpHash,  // HASHEADO (no texto plano)
        otpCanal: 'EMAIL',
        otpFechaEnvio: fechaEnvio,
        estadoFirma: 'OTP_ENVIADO',
        maxIntentos: 5,
        intentosOTP: 0,
        otpValidado: false,
      },
    })
    console.log(`  ✓ Firma creada: ${firma.id} (OTP hasheado en BD)`)

    // Registrar en OtpRegistro (trazabilidad)
    const otpReg = await prisma.otpRegistro.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        codigoHash: otpHash,
        codigoPlano: null,  // NUNCA en texto plano
        metodo: 'EMAIL',
        destinatario: email,
        tipo: 'FIRMA_ELECTRONICA',
        entidadRefId: firma.id,
        descripcion: `OTP firma TyC préstamo ${prestamo.codigo} (prueba E2E)`,
        intentos: 0,
        maxIntentos: 5,
        usado: false,
        bloqueado: false,
        expiraEn,
        verificado: false,
      },
    })
    console.log(`  ✓ OtpRegistro creado: ${otpReg.id}`)

    // ============= PASO 5: Enviar correo con el OTP =============
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `Tu código OTP — Jo*** Se*** Al*** D** R** (préstamo ${prestamo.codigo})`,
        text: `Hola ${nombreCliente},

Tu código de verificación para firma del préstamo ${prestamo.codigo} es:

  ${otp}

Este código expira en 5 minutos.
No lo compartas con nadie.

Si no solicitaste este código, ignora este correo.

— Jo*** Se*** Al*** D** R**`,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
  <h2 style="color: #1e40af; margin-bottom: 8px;">Jo*** Se*** Al*** D** R**</h2>
  <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Verificación de firma electrónica</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;">
  <p>Hola <strong>${nombreCliente}</strong>,</p>
  <p>Tu código de verificación para firma del préstamo <strong>${prestamo.codigo}</strong> es:</p>
  <div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; background: #f3f4f6; padding: 16px 32px; border-radius: 8px; font-family: 'Courier New', monospace;">${otp}</div>
  </div>
  <p style="color: #6b7280; font-size: 13px;">Este código expira en <strong>5 minutos</strong>. No lo compartas con nadie.</p>
  <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este código, ignora este correo.</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">Jo*** Se*** Al*** D** R** v4.0 — Sistema de préstamos</p>
</div>`,
      })
      console.log(`  ✓ [OTP] MessageId: ${info.messageId}`)
      resultado.enviados.push({
        tipo: 'OTP',
        messageId: info.messageId,
        response: info.response,
        otp,  // solo en el log local para verificación
        firmaId: firma.id,
        prestamoCodigo: prestamo.codigo,
      })
    } catch (e) {
      console.error(`  ✗ [OTP] Falló: ${e.message}`)
      resultado.enviados.push({ tipo: 'OTP', error: e.message })
    }

    resultados.push(resultado)

    // Pequeña pausa entre clientes para no saturar Brevo
    await new Promise(r => setTimeout(r, 800))
  }

  // ============= REPORTE FINAL =============
  console.log('\n\n' + '='.repeat(60))
  console.log('=== REPORTE FINAL ===')
  console.log('='.repeat(60))
  console.log(`Total clientes procesados: ${resultados.length}`)
  console.log(`Total correos enviados: ${resultados.reduce((acc, r) => acc + r.enviados.length, 0)}`)
  console.log('')

  resultados.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.email}`)
    console.log(`    Cliente: ${r.nombre} (cedula=${r.cedula})`)
    r.enviados.forEach(e => {
      if (e.messageId) {
        console.log(`    ✓ ${e.tipo.padEnd(10)} messageId=${e.messageId}`)
        if (e.otp) console.log(`                 OTP=${e.otp}  (préstamo=${e.prestamoCodigo})`)
      } else {
        console.log(`    ✗ ${e.tipo.padEnd(10)} ERROR: ${e.error}`)
      }
    })
    console.log('')
  })

  // ============= VERIFICACIÓN EN BD =============
  console.log('=== VERIFICACIÓN EN BD ===')
  const totalOtpRegistros = await prisma.otpRegistro.count()
  const totalFirmas = await prisma.firmaElectronica.count({ where: { otpCanal: 'EMAIL' } })
  const totalClientes = await prisma.cliente.count({ where: { email: { in: EMAILS } } })
  const totalPrestamos = await prisma.prestamo.count({ where: { codigo: { contains: 'PREST-PRUEBA-' } } })
  console.log(`OtpRegistro total: ${totalOtpRegistros} (antes: 0)`)
  console.log(`FirmaElectronica EMAIL canal: ${totalFirmas}`)
  console.log(`Clientes PRUEBA_OTP: ${totalClientes}`)
  console.log(`Préstamos PREST-PRUEBA-: ${totalPrestamos}`)
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR:', e.message)
    console.error(e.stack)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
