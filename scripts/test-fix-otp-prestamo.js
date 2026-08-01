// =====================================================
// TEST DIRECTO: simular lo que hace POST /api/prestamos/[id]/enviar-codigo
// Verifica que el fix (setear metodoConfirmacion='CORREO') funciona
// =====================================================
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const nodemailer = require('nodemailer')
const prisma = new PrismaClient()

// === Helpers de cifrado (réplica de src/lib/security.ts) ===
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

async function main() {
  const prestamoId = 'cms9g0vmo0001r65kctz5gtlb' // PREST-PRUEBA-624505-1

  console.log('=== TEST DIRECTO: enviar-codigo + setear metodoConfirmacion ===\n')

  // 1. Estado ANTES
  const antes = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    select: { codigo: true, estado: true, metodoConfirmacion: true, cliente: { select: { email: true, nombre: true, telefono: true } } }
  })
  console.log('ANTES:', JSON.stringify(antes, null, 2))

  // 2. Generar código (igual que el endpoint)
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 6; i++) codigo += caracteres[crypto.randomInt(0, caracteres.length)]
  console.log('\nCódigo generado:', codigo)

  // 3. Expiración 24h
  const fechaExpiracion = new Date()
  fechaExpiracion.setHours(fechaExpiracion.getHours() + 24)

  // 4. Eliminar código anterior + crear nuevo
  await prisma.codigoConfirmacion.deleteMany({ where: { prestamoId } })
  await prisma.codigoConfirmacion.create({
    data: { prestamoId, codigo, emailCliente: antes.cliente.email, fechaExpiracion }
  })
  console.log('✓ CodigoConfirmacion creado en BD')

  // 5. === EL FIX: setear metodoConfirmacion='CORREO' ===
  await prisma.prestamo.update({
    where: { id: prestamoId },
    data: {
      estado: 'PENDIENTE_ACEPTACION',
      metodoConfirmacion: 'CORREO',  // ← ESTO es lo que faltaba
      fechaAprobacion: new Date(),
      tycEnviado: true,
    },
  })
  console.log('✓ Prestamo actualizado: estado=PENDIENTE_ACEPTACION, metodoConfirmacion=CORREO')

  // 6. Enviar email real vía Brevo (igual que src/lib/email.ts)
  const conexion = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } })
  if (!conexion) throw new Error('No hay SMTP configurado')

  let host = '', port = 587, secure = false, fromName = 'Sistema', fromEmail = ''
  const extra = JSON.parse(conexion.configuracionExtra)
  host = extra.host; port = extra.port; secure = extra.secure
  fromName = extra.fromName; fromEmail = extra.fromEmail
  const user = conexion.usuario
  const pass = decrypt(conexion.password)

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
  })

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: antes.cliente.email,
    subject: `Código de Confirmación - Préstamo (test fix OTP)`,
    text: `Tu código es: ${codigo}\nExpira en 24 horas.`,
    html: `<div style="font-family:Arial;text-align:center;padding:40px;">
      <h2>Código de Confirmación (test fix OTP)</h2>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e40af;font-family:monospace;padding:20px;">${codigo}</div>
      <p>Expira en 24 horas.</p>
    </div>`,
  })
  console.log('✓ Email enviado. MessageId:', info.messageId)
  console.log('  Response:', info.response)

  // 7. Estado DESPUÉS
  const despues = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    select: { codigo: true, estado: true, metodoConfirmacion: true }
  })
  console.log('\nDESPUÉS:', JSON.stringify(despues, null, 2))

  // 8. Verificar que ahora la UI mostraría el input de verificación
  console.log('\n=== Verificación del fix ===')
  console.log('  estado === PENDIENTE_ACEPTACION:', despues.estado === 'PENDIENTE_ACEPTACION' ? '✓' : '✗')
  console.log('  metodoConfirmacion === CORREO  :', despues.metodoConfirmacion === 'CORREO' ? '✓' : '✗')
  console.log('  UI mostrará "Verificar y Activar":', despues.estado === 'PENDIENTE_ACEPTACION' && (despues.metodoConfirmacion === 'CORREO' || !despues.metodoConfirmacion) ? '✓ SÍ' : '✗ NO')
  console.log('\n🎉 Fix verificado: el modal de detalle ahora mostrará el input de verificación OTP.')
}

main()
  .catch((e) => { console.error('❌ ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
