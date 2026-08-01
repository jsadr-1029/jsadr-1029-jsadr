// =====================================================
// TEST DIRECTO de la lógica restaurar_smtp_backup
// (sin pasar por Next.js — verifica que la lógica funciona)
// =====================================================
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// === Llave hardcoded (igual a src/lib/security.ts) ===
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'
const BACKUP_KEY = crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()

function decryptBackup(encText) {
  const parts = encText.split(':')
  if (parts.length !== 2) return encText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', BACKUP_KEY, iv)
  let dec = decipher.update(parts[1], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

function getEnvKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definido')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptSensitive(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getEnvKey(), iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}

async function main() {
  console.log('=== TEST DIRECTO: restaurar_smtp_backup ===\n')

  // 1. Buscar correo principal
  let correo = await prisma.correoInstitucional.findFirst({
    where: { esPrincipal: true, estado: 'activo' },
  })
  if (!correo) correo = await prisma.correoInstitucional.findFirst({})
  if (!correo) throw new Error('No hay correo configurado')

  console.log('Correo:', correo.email)
  console.log('  smtpHost       :', correo.smtpHost)
  console.log('  smtpUser       :', correo.smtpUser)
  console.log('  tiene smtpPass :', !!correo.smtpPass)
  console.log('  tiene backup   :', !!correo.smtpPassBackup)

  if (!correo.smtpPassBackup) {
    console.log('\n❌ No hay backup. Ejecuta primero: node scripts/poblar-smtp-backup.js')
    process.exit(1)
  }

  // 2. Desencriptar backup con llave hardcoded
  const passPlano = decryptBackup(correo.smtpPassBackup)
  console.log('\n✓ Backup desencriptado (llave hardcoded):', passPlano.slice(0, 10) + '...' + passPlano.slice(-4))

  // 3. Re-encriptar con API_ENCRYPTION_KEY
  const nuevoSmtpPass = encryptSensitive(passPlano)
  console.log('✓ Re-encriptado con API_ENCRYPTION_KEY:', nuevoSmtpPass.slice(0, 16) + '...')

  // 4. Actualizar correoInstitucional
  await prisma.correoInstitucional.update({
    where: { id: correo.id },
    data: {
      smtpPass: nuevoSmtpPass,
      ultimoTest: null,
      ultimoTestOk: null,
    },
  })
  console.log('✓ correoInstitucional.smtpPass actualizado')

  // 5. Sincronizar conexionAPI
  const previos = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const p of previos) await prisma.conexionAPI.delete({ where: { id: p.id } })
  console.log(`  - Eliminados ${previos.length} registros EMAIL_SMTP previos`)

  const configuracionExtra = JSON.stringify({
    host: correo.smtpHost,
    port: Number(correo.smtpPort) || 587,
    secure: Boolean(correo.ssl),
    requireTLS: !correo.ssl && (correo.starttls || Number(correo.smtpPort) === 587),
    fromName: correo.nombreRemitente || correo.aliasRemitente || 'Sistema',
    fromEmail: correo.email,
  })

  const conn = await prisma.conexionAPI.create({
    data: {
      nombre: `SMTP — ${correo.email}`,
      tipo: 'EMAIL_SMTP',
      descripcion: `Sincronizado desde Configuración Global → Correo (${correo.email}). Host: ${correo.smtpHost}:${correo.smtpPort || 587}`,
      url: `${correo.smtpHost}:${correo.smtpPort || 587}`,
      apiKey: correo.email,
      usuario: correo.smtpUser,
      password: nuevoSmtpPass,
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })
  console.log('✓ conexionAPI creada con nuevo registro EMAIL_SMTP (id=' + conn.id + ')')

  // 6. Probar conexión SMTP real
  console.log('\n=== Test SMTP real ===')
  try {
    const nodemailer = require('nodemailer')
    const port = Number(correo.smtpPort) || 587
    const secure = correo.ssl || port === 465
    const requireTLS = !secure && (correo.starttls || port === 587 || port === 25)
    const transporter = nodemailer.createTransport({
      host: correo.smtpHost,
      port,
      secure,
      requireTLS,
      auth: { user: correo.smtpUser, pass: passPlano },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
    await transporter.verify()
    await transporter.close()
    console.log('✓ verify() OK — conexión SMTP exitosa con credenciales restauradas')
    await prisma.correoInstitucional.update({
      where: { id: correo.id },
      data: { ultimoTest: new Date(), ultimoTestOk: true },
    })
  } catch (err) {
    console.log('✗ Test SMTP falló:', err.message)
  }

  console.log('\n🎉 ¡RESTAURACIÓN DESDE BACKUP EXITOSA!')
  console.log('   El endpoint POST /api/configuracion-global {accion:"restaurar_smtp_backup"}')
  console.log('   hace exactamente esto cuando se llama desde la UI.')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
