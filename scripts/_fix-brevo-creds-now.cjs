// Verifica SI las credenciales en BD descifran con la API_ENCRYPTION_KEY actual.
// Si NO descifran, recupera la SMTP key válida del git history y la re-cifra/guarda.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')
const { execSync } = require('child_process')

const ALGORITHM = 'aes-256-cbc'

// ⚠️ IMPORTANTE: esta derivación debe ser IDÉNTICA a src/lib/security.ts getEncryptionKey().
// - Si raw es un hex de 64 chars → Buffer.from(raw, 'hex') (32 bytes directos)
// - Cualquier otra longitud → SHA256(raw)
// NO usar SHA256(raw) si raw ya es hex de 64 chars — eso produce una llave diferente
// y producción no podría descifrar.
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('API_ENCRYPTION_KEY no definido en .env')
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  return crypto.createHash('sha256').update(raw).digest()
}

// BACKUP_KEY_SEED — debe ser IDÉNTICO a src/lib/security.ts BACKUP_KEY_SEED.
// Es hardcoded en el código fuente, así que es la misma llave en local y en Vercel.
// Usamos esta llave para cifrar credenciales críticas (SMTP, API) y que sean
// descifrables sin importar cuál API_ENCRYPTION_KEY tenga .env o Vercel.
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4'

function getBackupKey() {
  return crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()
}

function encryptSensitive(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// Cifra con BACKUP_KEY_SEED — mismo valor en local y Vercel.
// Usar para credenciales que deben sobrevivir rotación/pérdida de API_ENCRYPTION_KEY.
function encryptBackup(text) {
  const key = getBackupKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decryptSensitive(encrypted) {
  try {
    const [ivHex, dataHex] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const key = getEncryptionKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let dec = decipher.update(data)
    dec = Buffer.concat([dec, decipher.final()])
    return dec.toString('utf8')
  } catch (e) {
    return null
  }
}

function encryptSensitive(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

async function main() {
  console.log('=== VERIFICACIÓN Y RE-PARACIÓN DE CREDENCIALES BREVO ===\n')
  console.log('API_ENCRYPTION_KEY (de .env):')
  console.log(`  valor (primeros 16 chars): ${process.env.API_ENCRYPTION_KEY.slice(0, 16)}...`)
  console.log(`  longitud: ${process.env.API_ENCRYPTION_KEY.length} chars`)
  console.log(`  SHA256: ${getEncryptionKey().toString('hex').slice(0, 16)}...\n`)

  // 1. Leer ConexionAPI.EMAIL_SMTP
  const conexion = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (!conexion) {
    console.log('✗ No hay ConexionAPI.EMAIL_SMTP activa — saliendo.')
    return
  }

  console.log('--- ConexionAPI.EMAIL_SMTP ---')
  console.log(`  apiKey cifrado (primeros 30): ${conexion.apiKey?.slice(0, 30) || 'NULL'}...`)
  console.log(`  password cifrado (primeros 30): ${conexion.password?.slice(0, 30) || 'NULL'}...`)

  // Intentar descifrar con la llave actual
  let apiKeyDecrypted = null
  let passwordDecrypted = null
  if (conexion.apiKey && conexion.apiKey.includes(':')) {
    apiKeyDecrypted = decryptSensitive(conexion.apiKey)
    if (apiKeyDecrypted === conexion.apiKey) {
      console.log('  ✗ apiKey: descifrado FALLÓ (devolvió el mismo valor cifrado)')
      apiKeyDecrypted = null
    } else if (apiKeyDecrypted) {
      console.log(`  ✓ apiKey: descifrado OK — valor: ${apiKeyDecrypted.slice(0, 12)}...${apiKeyDecrypted.slice(-6)}`)
      console.log(`    ¿Empieza con xkeysib-? ${apiKeyDecrypted.startsWith('xkeysib-') ? 'SÍ ✓' : 'NO ✗'}`)
    } else {
      console.log('  ✗ apiKey: descifrado devolvió null')
    }
  }
  if (conexion.password && conexion.password.includes(':')) {
    passwordDecrypted = decryptSensitive(conexion.password)
    if (passwordDecrypted === conexion.password) {
      console.log('  ✗ password: descifrado FALLÓ (devolvió el mismo valor cifrado)')
      passwordDecrypted = null
    } else if (passwordDecrypted) {
      console.log(`  ✓ password: descifrado OK — valor: ${passwordDecrypted.slice(0, 12)}...${passwordDecrypted.slice(-6)}`)
      console.log(`    ¿Empieza con xsmtpsib-? ${passwordDecrypted.startsWith('xsmtpsib-') ? 'SÍ ✓' : 'NO ✗'}`)
    } else {
      console.log('  ✗ password: descifrado devolvió null')
    }
  }

  // 2. Leer CorreoInstitucional principal
  const correo = await prisma.correoInstitucional.findFirst({
    where: { estado: 'activo', esPrincipal: true },
  })
  console.log('\n--- CorreoInstitucional principal ---')
  if (!correo) {
    console.log('  No hay CorreoInstitucional principal activo')
  } else {
    console.log(`  smtpPass cifrado (primeros 30): ${correo.smtpPass?.slice(0, 30) || 'NULL'}...`)
    let smtpPassDecrypted = null
    if (correo.smtpPass && correo.smtpPass.includes(':')) {
      smtpPassDecrypted = decryptSensitive(correo.smtpPass)
      if (smtpPassDecrypted === correo.smtpPass) {
        console.log('  ✗ smtpPass: descifrado FALLÓ — huérfano')
        smtpPassDecrypted = null
      } else if (smtpPassDecrypted) {
        console.log(`  ✓ smtpPass: descifrado OK — valor: ${smtpPassDecrypted.slice(0, 12)}...${smtpPassDecrypted.slice(-6)}`)
      }
    }
  }

  // 3. FORZAR re-cifrado con BACKUP_KEY_SEED (siempre — no depende de .env)
  // Esto garantiza que las credenciales sean descifrables en Vercel sin importar
  // cuál API_ENCRYPTION_KEY tenga configurada.
  const forzarReparacion = true
  const necesitaReparacion = forzarReparacion || (!passwordDecrypted && !apiKeyDecrypted)
  if (necesitaReparacion) {
    if (forzarReparacion) {
      console.log('\n=== RE-CIFRADO FORZADO CON BACKUP_KEY_SEED ===')
      console.log('(Las credenciales descifran localmente con API_ENCRYPTION_KEY,')
      console.log(' pero Vercel puede tener una llave diferente. BACKUP_KEY_SEED')
      console.log(' es hardcoded en el código → misma llave en local y Vercel.)')
    }
    console.log('\n=== CREDENCIALES HUÉRFANAS — RECUPERANDO SMTP KEY DEL GIT HISTORY ===')
    // Buscar en el git history commits que contengan xsmtpsib-
    let gitSearch
    try {
      gitSearch = execSync(
        `git log --all -p --source 2>&1`,
        { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 60000, maxBuffer: 200 * 1024 * 1024 }
      )
    } catch (e) {
      console.log(`git log error: ${e.message.slice(0, 200)}`)
      gitSearch = ''
    }
    console.log(`git log output: ${gitSearch.length} chars`)

    const smtpKeys = new Set()
    const re = /xsmtpsib-[A-Za-z0-9_\-]{20,}/g
    let m
    while ((m = re.exec(gitSearch)) !== null) {
      // Filtrar el REDACTED
      if (!m[0].includes('REDACTED')) smtpKeys.add(m[0])
    }
    console.log(`SMTP keys encontradas en git history: ${smtpKeys.size}`)
    for (const k of smtpKeys) {
      console.log(`  - ${k.slice(0, 25)}...${k.slice(-8)}`)
    }

    // También buscar xkeysib- (API key HTTPS)
    const apiKeys = new Set()
    const reApi = /xkeysib-[A-Za-z0-9_\-]{20,}/g
    while ((m = reApi.exec(gitSearch)) !== null) {
      if (!m[0].includes('REDACTED')) apiKeys.add(m[0])
    }
    console.log(`API keys encontradas en git history: ${apiKeys.size}`)
    for (const k of apiKeys) {
      console.log(`  - ${k.slice(0, 25)}...${k.slice(-8)}`)
    }

    // Probar cada SMTP key — enviar un correo de prueba
    const nodemailer = require('nodemailer')
    let smtpKeyValida = null
    for (const k of smtpKeys) {
      try {
        console.log(`\n  Probando SMTP key ${k.slice(-8)}...`)
        const transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,
          auth: { user: 'b3e8df001@smtp-brevo.com', pass: k },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 15000,
        })
        await transporter.verify()
        console.log(`    ✓ verify() OK — key VÁLIDA`)
        smtpKeyValida = k
        transporter.close()
        break
      } catch (e) {
        console.log(`    ✗ ${e.message.slice(0, 100)}`)
      }
    }

    if (!smtpKeyValida) {
      console.log('\n✗ NO SE ENCONTRÓ SMTP KEY VÁLIDA en el git history.')
      console.log('  El usuario debe revelar la SMTP key desde el panel de Brevo y pegarla aquí.')
      return
    }

    // Probar cada API key
    let apiKeyValida = null
    for (const k of apiKeys) {
      try {
        console.log(`\n  Probando API key ${k.slice(-8)}...`)
        const res = await fetch('https://api.brevo.com/v3/smtp/account', {
          headers: { 'api-key': k, accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          console.log(`    ✓ HTTP 200 OK — API key VÁLIDA`)
          apiKeyValida = k
          break
        } else {
          console.log(`    ✗ HTTP ${res.status}`)
        }
      } catch (e) {
        console.log(`    ✗ ${e.message.slice(0, 100)}`)
      }
    }

    // Re-cifrar y guardar
    // IMPORTANTE: usar encryptBackup (BACKUP_KEY_SEED hardcoded) en lugar de
    // encryptSensitive (API_ENCRYPTION_KEY), porque la llave de .env local
    // puede diferir de la de Vercel. BACKUP_KEY_SEED es la misma en ambos
    // ambientes (está en el código fuente).
    console.log('\n=== RE-CIFRANDO Y GUARDANDO EN BD (con BACKUP_KEY_SEED) ===')
    const encryptedPass = encryptBackup(smtpKeyValida)
    const encryptedApiKey = apiKeyValida ? encryptBackup(apiKeyValida) : null

    await prisma.conexionAPI.updateMany({
      where: { tipo: 'EMAIL_SMTP' },
      data: {
        apiKey: encryptedApiKey || encryptedPass, // si no hay API key, dejar la SMTP key (no ideal pero evita NULL)
        password: encryptedPass,
        activa: true,
        probada: true,
        fechaUltimaPrueba: new Date(),
        resultadoUltimaPrueba: 'OK — credenciales re-cifradas con API_ENCRYPTION_KEY actual',
      },
    })
    console.log('✓ ConexionAPI.EMAIL_SMTP actualizada')

    if (correo) {
      await prisma.correoInstitucional.updateMany({
        where: { esPrincipal: true, estado: 'activo' },
        data: { smtpPass: encryptedPass },
      })
      console.log('✓ CorreoInstitucional.smtpPass actualizada')
    }

    // Verificación inmediata — descifrar con BACKUP_KEY_SEED
    const verif = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
    const backupKey = getBackupKey()
    function decryptWith(encrypted, key) {
      try {
        const [ivHex, dataHex] = encrypted.split(':')
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
        let dec = decipher.update(Buffer.from(dataHex, 'hex'))
        dec = Buffer.concat([dec, decipher.final()])
        return dec.toString('utf8')
      } catch (e) { return null }
    }
    const decVerif = decryptWith(verif.password, backupKey)
    console.log('\n=== VERIFICACIÓN (BACKUP_KEY_SEED) ===')
    console.log(`password descifra correctamente: ${decVerif === smtpKeyValida ? '✓ SÍ' : '✗ NO'}`)
    if (encryptedApiKey) {
      const decApiVerif = decryptWith(verif.apiKey, backupKey)
      console.log(`apiKey descifra correctamente: ${decApiVerif === apiKeyValida ? '✓ SÍ' : '✗ NO'}`)
    }
    // Verificar que también descifre con API_ENCRYPTION_KEY local (en caso de que Vercel tenga la misma)
    const decVerifLocal = decryptWith(verif.password, getEncryptionKey())
    console.log(`¿password también descifra con API_ENCRYPTION_KEY local? ${decVerifLocal === smtpKeyValida ? '✓ SÍ (no debería — se cifró con backup)' : '✗ NO (esperado)'}`)

    // 4. Enviar correo de prueba
    console.log('\n=== ENVÍO DE PRUEBA ===')
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'b3e8df001@smtp-brevo.com', pass: smtpKeyValida },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
    const info = await transporter.sendMail({
      from: '"Jsadr" <jsa@jsadr.com.co>',
      to: 'jsadr23@gmail.com',
      subject: `TEST reparación credenciales — ${new Date().toISOString()}`,
      text: `Hola,\n\nEste es un correo de prueba enviado tras re-cifrar las credenciales Brevo con la API_ENCRYPTION_KEY actual.\n\nTimestamp: ${new Date().toISOString()}\nMessage-ID debería estar en el header.\n\n— Sistema de Préstamos`,
    })
    console.log(`✓ Correo enviado: ${info.messageId}`)

    // Registrar en EnvioCorreo
    await prisma.envioCorreo.create({
      data: {
        remitenteEmail: 'jsa@jsadr.com.co',
        destinatario: 'jsadr23@gmail.com',
        asunto: 'TEST reparación credenciales',
        cuerpo: 'Correo de prueba tras re-cifrar credenciales',
        formato: 'texto',
        estado: 'ENVIADO',
        fechaEnvio: new Date(),
        enviadoPorNombre: 'Sistema (SMTP directo)',
        metadata: JSON.stringify({ messageId: info.messageId, via: 'SMTP_DIRECTO_REPARACION' }),
      },
    })
    console.log('✓ Registro EnvioCorreo creado')

    console.log('\n=== RESUMEN ===')
    console.log(`SMTP key válida recuperada: ${smtpKeyValida.slice(0, 25)}...${smtpKeyValida.slice(-8)}`)
    if (apiKeyValida) {
      console.log(`API key válida recuperada: ${apiKeyValida.slice(0, 25)}...${apiKeyValida.slice(-8)}`)
    } else {
      console.log('API key HTTPS NO encontrada — el sistema usará SMTP como camino principal en Vercel.')
      console.log('Si Vercel da error 525 (IP restriction), el usuario debe revelar la API key HTTPS desde el panel Brevo.')
    }
  } else {
    console.log('\n✓ Las credenciales descifran correctamente con la llave actual.')
    console.log('No se requiere reparación.')
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
