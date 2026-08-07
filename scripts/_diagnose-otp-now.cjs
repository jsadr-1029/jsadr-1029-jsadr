// Diagnóstico en tiempo real del flujo OTP del portal del cliente.
// Verifica:
// 1. Estado de credenciales Brevo en BD (ConexionAPI + CorreoInstitucional)
// 2. Últimos 10 registros de EnvioCorreo (estado, error, vía)
// 3. Últimos 10 accesos al portal (qué está haciendo el usuario ahora)
// 4. Últimos 10 OtpRegistro (OTP generados)
// 5. Prueba directa de envío de email
// 6. Estado de env vars locales (.env)

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Misma lógica de desencripción que src/lib/security.ts
const crypto = require('crypto')

function deriveKey(seed) {
  return crypto.createHash('sha256').update(seed).digest()
}

function decrypt(encrypted, keySeed) {
  try {
    const [ivHex, dataHex] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const key = deriveKey(keySeed)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let dec = decipher.update(data)
    dec = Buffer.concat([dec, decipher.final()])
    return dec.toString('utf8')
  } catch (e) {
    return null
  }
}

function tryDecrypt(encrypted, candidateSeeds) {
  for (const seed of candidateSeeds) {
    const dec = decrypt(encrypted, seed)
    if (dec && dec !== encrypted && /^[\x20-\x7E]+$/.test(dec)) {
      return { value: dec, seed }
    }
  }
  return null
}

async function main() {
  console.log('=== DIAGNÓSTICO EN TIEMPO REAL DEL FLUJO OTP ===\n')
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // 1. Estado de credenciales en BD
  console.log('--- 1. Estado de credenciales en BD ---')
  const conexionEmail = await prisma.conexionAPI.findFirst({
    where: { tipo: 'EMAIL_SMTP', activa: true },
  })
  if (conexionEmail) {
    console.log(`ConexionAPI.EMAIL_SMTP:`)
    console.log(`  - url: ${conexionEmail.url}`)
    console.log(`  - usuario: ${conexionEmail.usuario}`)
    console.log(`  - apiKey (cifrado?): ${conexionEmail.apiKey ? conexionEmail.apiKey.slice(0, 30) + '...' : 'NULL'}`)
    console.log(`  - password (cifrado?): ${conexionEmail.password ? conexionEmail.password.slice(0, 30) + '...' : 'NULL'}`)
    console.log(`  - configuracionExtra: ${conexionEmail.configuracionExtra}`)

    // Intentar desencriptar con la llave actual de .env
    const currentKey = process.env.API_ENCRYPTION_KEY
    if (currentKey) {
      const candidateSeeds = [
        currentKey,
        Buffer.from(currentKey, 'hex').toString('utf8').slice(0, 32),
      ]
      if (conexionEmail.apiKey && conexionEmail.apiKey.includes(':')) {
        const dec = tryDecrypt(conexionEmail.apiKey, candidateSeeds)
        if (dec) {
          console.log(`  ✓ apiKey DESCIFRADA con API_ENCRYPTION_KEY actual (termina en ...${dec.value.slice(-6)})`)
          console.log(`    ¿Empieza con xkeysib-? ${dec.value.startsWith('xkeysib-') ? 'SÍ ✓' : 'NO ✗'}`)
        } else {
          console.log(`  ✗ apiKey NO descifrable con API_ENCRYPTION_KEY actual — huérfana`)
        }
      }
      if (conexionEmail.password && conexionEmail.password.includes(':')) {
        const dec = tryDecrypt(conexionEmail.password, candidateSeeds)
        if (dec) {
          console.log(`  ✓ password DESCIFRADO con API_ENCRYPTION_KEY actual (termina en ...${dec.value.slice(-6)})`)
          console.log(`    ¿Empieza con xsmtpsib-? ${dec.value.startsWith('xsmtpsib-') ? 'SÍ ✓' : 'NO ✗'}`)
        } else {
          console.log(`  ✗ password NO descifrable con API_ENCRYPTION_KEY actual — huérfano`)
        }
      }
    }
  } else {
    console.log('  NO HAY ConexionAPI.EMAIL_SMTP activa')
  }

  console.log()
  const correoInst = await prisma.correoInstitucional.findFirst({
    where: { estado: 'activo', esPrincipal: true },
  })
  if (correoInst) {
    console.log(`CorreoInstitucional principal:`)
    console.log(`  - email: ${correoInst.email}`)
    console.log(`  - smtpHost: ${correoInst.smtpHost}:${correoInst.smtpPort}`)
    console.log(`  - smtpUser: ${correoInst.smtpUser}`)
    console.log(`  - smtpPass (cifrado?): ${correoInst.smtpPass ? correoInst.smtpPass.slice(0, 30) + '...' : 'NULL'}`)
  } else {
    console.log('  NO HAY CorreoInstitucional principal activo')
  }

  // 2. Últimos 10 EnvioCorreo
  console.log('\n--- 2. Últimos 10 EnvioCorreo ---')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { fechaEnvio: 'desc' },
    take: 10,
    select: {
      fechaEnvio: true,
      destinatario: true,
      asunto: true,
      estado: true,
      enviadoPorNombre: true,
      mensajeError: true,
      metadata: true,
    },
  })
  if (envios.length === 0) {
    console.log('  (sin envíos registrados)')
  } else {
    for (const e of envios) {
      const meta = e.metadata ? JSON.parse(e.metadata) : {}
      console.log(`  [${e.fechaEnvio.toISOString()}] ${e.estado} | ${e.destinatario} | ${e.asunto?.slice(0, 50)} | vía=${meta.via || 'N/A'} | err=${e.mensajeError?.slice(0, 100) || ''}`)
    }
  }

  // 3. Últimos 10 AccesoPortal
  console.log('\n--- 3. Últimos 10 AccesoPortal ---')
  const accesos = await prisma.accesoPortal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      createdAt: true,
      clienteNombre: true,
      clienteCedula: true,
      accion: true,
      exito: true,
      detalle: true,
    },
  })
  if (accesos.length === 0) {
    console.log('  (sin accesos registrados)')
  } else {
    for (const a of accesos) {
      console.log(`  [${a.createdAt.toISOString()}] ${a.exito ? '✓' : '✗'} ${a.accion} | ${a.clienteNombre} (${a.clienteCedula}) | ${a.detalle?.slice(0, 80) || ''}`)
    }
  }

  // 4. Últimos 10 OtpRegistro
  console.log('\n--- 4. Últimos 10 OtpRegistro ---')
  const otps = await prisma.otpRegistro.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      createdAt: true,
      clienteNombre: true,
      clienteCedula: true,
      tipo: true,
      metodo: true,
      destinatario: true,
      usado: true,
      expiraEn: true,
      expirado: true,
    },
  })
  if (otps.length === 0) {
    console.log('  (sin OTPs registrados)')
  } else {
    for (const o of otps) {
      console.log(`  [${o.createdAt.toISOString()}] tipo=${o.tipo} metodo=${o.metodo} usado=${o.usado} expirado=${o.expirado} | ${o.clienteNombre} (${o.clienteCedula}) → ${o.destinatario}`)
    }
  }

  // 5. Estado de env vars locales
  console.log('\n--- 5. Variables de entorno (.env local) ---')
  console.log(`  BREVO_API_KEY: ${process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.slice(0, 15) + '...' : '(vacío)'}`)
  console.log(`  BREVO_SMTP_KEY: ${process.env.BREVO_SMTP_KEY ? process.env.BREVO_SMTP_KEY.slice(0, 15) + '...' : '(vacío)'}`)
  console.log(`  SMTP_USER: ${process.env.SMTP_USER || '(vacío)'}`)
  console.log(`  SMTP_PASS: ${process.env.SMTP_PASS ? process.env.SMTP_PASS.slice(0, 15) + '...' : '(vacío)'}`)
  console.log(`  API_ENCRYPTION_KEY: ${process.env.API_ENCRYPTION_KEY ? process.env.API_ENCRYPTION_KEY.slice(0, 15) + '...' : '(vacío)'}`)
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✓ configurado' : '(vacío)'}`)
}

main()
  .catch(e => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
