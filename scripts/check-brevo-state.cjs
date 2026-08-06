// Diagnóstico: estado de credenciales Brevo en BD y desencripción
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()
const ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'jsadr-encryption-key-32bytes!!'

function getEncryptionKey() {
  // Misma lógica que src/lib/security.ts
  const seed = ENCRYPTION_KEY
  return crypto.createHash('sha256').update(seed).digest()
}

function tryDecrypt(encryptedText) {
  if (!encryptedText) return { ok: false, reason: 'null/empty' }
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return { ok: false, reason: 'no cifrado (no tiene formato iv:hex)', raw: encryptedText.substring(0, 50) }
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return { ok: true, plaintext: decrypted }
  } catch (err) {
    return { ok: false, reason: err.message, raw: encryptedText.substring(0, 30) + '...' }
  }
}

async function main() {
  console.log('=== API_ENCRYPTION_KEY usada ===')
  console.log(ENCRYPTION_KEY)
  console.log('Hash SHA-256:', getEncryptionKey().toString('hex').substring(0, 16) + '...')
  console.log()

  console.log('=== ConexionAPI.EMAIL_SMTP ===')
  const conexiones = await prisma.conexionAPI.findMany({ where: { tipo: 'EMAIL_SMTP' } })
  for (const c of conexiones) {
    console.log('ID:', c.id, '| nombre:', c.nombre, '| activa:', c.activa, '| probada:', c.probada)
    console.log('  usuario:', c.usuario)
    console.log('  url:', c.url)
    console.log('  apiKey raw length:', (c.apiKey || '').length)
    const decApi = tryDecrypt(c.apiKey)
    console.log('  apiKey desencriptada:', decApi.ok ? 'OK (' + decApi.plaintext.substring(0, 8) + '...)' : 'FALLÓ (' + decApi.reason + ')')
    const decPass = tryDecrypt(c.password)
    console.log('  password desencriptada:', decPass.ok ? 'OK (' + decPass.plaintext.substring(0, 8) + '...)' : 'FALLÓ (' + decPass.reason + ')')
    console.log()
  }

  console.log('=== CorreoInstitucional ===')
  const correos = await prisma.correoInstitucional.findMany()
  for (const ci of correos) {
    console.log('ID:', ci.id, '| nombre:', ci.nombre, '| estado:', ci.estado, '| esPrincipal:', ci.esPrincipal)
    console.log('  email:', ci.email)
    console.log('  smtpHost:', ci.smtpHost, '| smtpPort:', ci.smtpPort, '| smtpUser:', ci.smtpUser)
    const decPass = tryDecrypt(ci.smtpPass)
    console.log('  smtpPass desencriptada:', decPass.ok ? 'OK (' + decPass.plaintext.substring(0, 8) + '...)' : 'FALLÓ (' + decPass.reason + ')')
    const decBackup = tryDecrypt(ci.smtpPassBackup)
    console.log('  smtpPassBackup desencriptada:', decBackup.ok ? 'OK (' + decBackup.plaintext.substring(0, 8) + '...)' : (ci.smtpPassBackup ? 'FALLÓ' : 'NULL'))
    console.log()
  }

  console.log('=== Últimos EnvioCorreo (10) ===')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { asunto: true, estado: true, mensajeError: true, createdAt: true, via: true }
  })
  for (const e of envios) {
    console.log(`  ${e.createdAt.toISOString().substring(0, 16)} | ${e.estado} | ${e.via || 'N/A'} | ${(e.asunto || '').substring(0, 50)} | err=${(e.mensajeError || '').substring(0, 60)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
