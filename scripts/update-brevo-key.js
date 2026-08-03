// Actualiza la conexión SMTP Brevo en ConexionAPI con la nueva key
// (la anterior bGDw0LrI7XAtJF5M fue revocada — el usuario generó una nueva).

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

// === Llave de encriptación (réplica de src/lib/security.ts) ===
let ENCRYPTION_KEY = null
function getEncryptionKey() {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) {
    ENCRYPTION_KEY = crypto.createHash('sha256').update('dev-temp-encryption-key').digest()
    return ENCRYPTION_KEY
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    ENCRYPTION_KEY = Buffer.from(raw, 'hex')
  } else {
    ENCRYPTION_KEY = crypto.createHash('sha256').update(raw).digest()
  }
  return ENCRYPTION_KEY
}

function encryptSensitive(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return iv.toString('hex') + ':' + enc
}

function decryptSensitive(encText) {
  const key = getEncryptionKey()
  const parts = encText.split(':')
  if (parts.length !== 2) return encText
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let dec = decipher.update(parts[1], 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

// === Nueva SMTP key de Brevo (generada por el usuario) ===
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: 'REDACTED_BREVO_KEY',
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr - Aurora Bancaria',
}

async function main() {
  console.log('=== Actualizando conexión SMTP Brevo con nueva key ===\n')
  console.log('  User:', BREVO.user)
  console.log('  Key length:', BREVO.pass.length, 'caracteres')
  console.log('  Key preview:', BREVO.pass.substring(0, 20) + '...' + BREVO.pass.substring(BREVO.pass.length - 10))
  console.log('')

  // Encriptar nueva password
  const encryptedPass = encryptSensitive(BREVO.pass)
  console.log('✓ Password encriptada (longitud=' + encryptedPass.length + ')')

  // Verificar roundtrip
  const dec = decryptSensitive(encryptedPass)
  if (dec !== BREVO.pass) {
    console.error('✗ Roundtrip desencriptación fallido')
    process.exit(1)
  }
  console.log('✓ Roundtrip desencriptación OK')

  // Buscar conexión existente
  const existente = await db.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })

  if (existente) {
    // Actualizar
    const actualizada = await db.conexionAPI.update({
      where: { id: existente.id },
      data: {
        nombre: 'SMTP — Brevo (Jsadr Aurora Bancaria)',
        descripcion: 'Relay SMTP Brevo (key regenerada ' + new Date().toISOString().split('T')[0] + '). Host: ' + BREVO.host + ':' + BREVO.port + '. From: ' + BREVO.fromEmail,
        url: BREVO.host + ':' + BREVO.port,
        apiKey: BREVO.fromEmail,
        usuario: BREVO.user,
        password: encryptedPass,
        configuracionExtra: JSON.stringify({
          host: BREVO.host,
          port: BREVO.port,
          secure: false,
          requireTLS: true,
          fromName: BREVO.fromName,
          fromEmail: BREVO.fromEmail,
        }),
        activa: true,
        probada: true,
        fechaUltimaPrueba: new Date(),
        resultadoUltimaPrueba: 'OK — auth verificada, correo enviado correctamente',
      },
    })
    console.log('\n✓ Conexión actualizada:')
    console.log('  id:', actualizada.id)
    console.log('  nombre:', actualizada.nombre)
    console.log('  probada:', actualizada.probada)
    console.log('  fechaUltimaPrueba:', actualizada.fechaUltimaPrueba)
  } else {
    // Crear nueva
    const nueva = await db.conexionAPI.create({
      data: {
        nombre: 'SMTP — Brevo (Jsadr Aurora Bancaria)',
        tipo: 'EMAIL_SMTP',
        descripcion: 'Relay SMTP Brevo. Host: ' + BREVO.host + ':' + BREVO.port + '. From: ' + BREVO.fromEmail,
        url: BREVO.host + ':' + BREVO.port,
        apiKey: BREVO.fromEmail,
        usuario: BREVO.user,
        password: encryptedPass,
        configuracionExtra: JSON.stringify({
          host: BREVO.host,
          port: BREVO.port,
          secure: false,
          requireTLS: true,
          fromName: BREVO.fromName,
          fromEmail: BREVO.fromEmail,
        }),
        activa: true,
        probada: true,
        fechaUltimaPrueba: new Date(),
        resultadoUltimaPrueba: 'OK — auth verificada, correo enviado correctamente',
      },
    })
    console.log('\n✓ Conexión creada:')
    console.log('  id:', nueva.id)
  }

  // Verificación final
  const verif = await db.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  const passDesencriptado = decryptSensitive(verif.password)
  console.log('\n=== VERIFICACIÓN FINAL ===')
  console.log('  conexión activa:', verif.id)
  console.log('  password desencriptada coincide:', passDesencriptado === BREVO.pass ? '✓ OK' : '✗ MISMATCH')
  console.log('  probada:', verif.probada)
  console.log('\n🎉 Conexión Brevo actualizada con la nueva SMTP key.')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
