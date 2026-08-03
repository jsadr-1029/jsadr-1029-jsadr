// Crea la conexión SMTP Brevo directamente en la tabla ConexionAPI
// de la BD SQLite local. Cumple con el formato que espera src/lib/email.ts.
//
// Credenciales Brevo (tomadas de scripts/setup-brevo-smtp.js):
//   Host:    smtp-relay.brevo.com
//   Puerto:  587 (STARTTLS)
//   Usuario: b3e8df001@smtp-brevo.com
//   Pass:    bGDw0LrI7XAtJF5M  (SMTP key, NO la contraseña del panel)
//   From:    jsa@jsadr.com.co
//
// Encriptación: usa encryptSensitive de src/lib/security.ts, que en dev
// (sin API_ENCRYPTION_KEY) deriva la llave de 'dev-temp-encryption-key'.

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

// === Llave de encriptación (réplica exacta de src/lib/security.ts) ===
let ENCRYPTION_KEY = null
function getEncryptionKey() {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) {
    // Mismo comportamiento que security.ts en dev
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

// === Credenciales Brevo ===
const BREVO = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: 'b3e8df001@smtp-brevo.com',
  pass: 'bGDw0LrI7XAtJF5M', // SMTP key de Brevo
  fromEmail: 'jsa@jsadr.com.co',
  fromName: 'Jsadr - Aurora Bancaria',
}

async function main() {
  console.log('=== Creando conexión SMTP Brevo en ConexionAPI ===\n')
  console.log('  Host:', BREVO.host)
  console.log('  Port:', BREVO.port)
  console.log('  User:', BREVO.user)
  console.log('  Pass:', BREVO.pass.replace(/./g, '*'))
  console.log('  From:', BREVO.fromEmail, '(' + BREVO.fromName + ')')
  console.log('')

  // Encriptar password
  const encryptedPass = encryptSensitive(BREVO.pass)
  console.log('✓ Password encriptado (longitud=' + encryptedPass.length + ')')

  // Verificar roundtrip
  const dec = decryptSensitive(encryptedPass)
  if (dec !== BREVO.pass) {
    console.error('✗ Roundtrip de desencriptación fallido')
    process.exit(1)
  }
  console.log('✓ Roundtrip desencriptación OK')

  // Eliminar conexiones EMAIL_SMTP previas
  const previos = await db.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const p of previos) {
    await db.conexionAPI.delete({ where: { id: p.id } })
  }
  console.log('✓ Eliminadas ' + previos.length + ' conexiones EMAIL_SMTP previas')

  // ConfiguracionExtra (formato que espera src/lib/email.ts)
  const configuracionExtra = JSON.stringify({
    host: BREVO.host,
    port: BREVO.port,
    secure: false,
    requireTLS: true,
    fromName: BREVO.fromName,
    fromEmail: BREVO.fromEmail,
  })

  // Crear nueva conexión
  const nueva = await db.conexionAPI.create({
    data: {
      nombre: 'SMTP — Brevo (Jsadr Aurora Bancaria)',
      tipo: 'EMAIL_SMTP',
      descripcion: 'Relay SMTP Brevo. Host: ' + BREVO.host + ':' + BREVO.port + '. From: ' + BREVO.fromEmail,
      url: BREVO.host + ':' + BREVO.port,
      apiKey: BREVO.fromEmail,
      usuario: BREVO.user,
      password: encryptedPass,
      configuracionExtra,
      activa: true,
      probada: false,
    },
  })

  console.log('\n✓ Conexión creada en ConexionAPI:')
  console.log('  id:', nueva.id)
  console.log('  nombre:', nueva.nombre)
  console.log('  activa:', nueva.activa)

  // Verificar leyendo de BD
  const verif = await db.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!verif) {
    console.error('✗ No se encontró la conexión tras crearla')
    process.exit(1)
  }
  const passDesencriptado = decryptSensitive(verif.password)
  console.log('\n=== VERIFICACIÓN FINAL ===')
  console.log('  conexión activa encontrada:', verif.id)
  console.log('  host:', JSON.parse(verif.configuracionExtra).host)
  console.log('  usuario:', verif.usuario)
  console.log('  fromEmail:', verif.apiKey)
  console.log('  password desencriptado coincide:', passDesencriptado === BREVO.pass ? '✓ OK' : '✗ MISMATCH')
  console.log('\n🎉 Conexión SMTP Brevo lista para usar.')
  console.log('   El sistema src/lib/email.ts ahora usará Brevo en lugar de Ethereal.')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
