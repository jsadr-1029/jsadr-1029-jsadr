// Inspecciona los últimos envíos de correo y la config SMTP actual en la BD Neon
const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const ALGORITHM = 'aes-256-cbc'
function getKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}
function decrypt(text) {
  try {
    const parts = text.split(':')
    if (parts.length !== 2) return text
    const iv = Buffer.from(parts[0], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    let d = decipher.update(parts[1], 'hex', 'utf8')
    d += decipher.final('utf8')
    return d
  } catch (e) {
    return `<DECRYPT_FAIL: ${e.message}>`
  }
}

;(async () => {
  try {
    console.log('=== ConexionAPI.EMAIL_SMTP ===')
    const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
    if (smtp) {
      console.log(`  id: ${smtp.id}`)
      console.log(`  nombre: ${smtp.nombre}`)
      console.log(`  activa: ${smtp.activa}`)
      console.log(`  usuario: ${smtp.usuario}`)
      console.log(`  password (cifrado, ${smtp.password?.length || 0} chars): ${smtp.password?.slice(0, 30)}...`)
      console.log(`  password (descifrado): ${smtp.password ? decrypt(smtp.password).slice(0, 25) + '...' + decrypt(smtp.password).slice(-6) : '(vacío)'}`)
      console.log(`  apiKey: ${smtp.apiKey}`)
      console.log(`  url: ${smtp.url}`)
      console.log(`  configuracionExtra: ${smtp.configuracionExtra}`)
      console.log(`  probada: ${smtp.probada}`)
      console.log(`  resultadoUltimaPrueba: ${smtp.resultadoUltimaPrueba}`)
    } else {
      console.log('  NO EXISTE')
    }

    console.log('\n=== CorreoInstitucional (jsa@jsadr.com.co) ===')
    const correo = await prisma.correoInstitucional.findFirst({ where: { email: 'jsa@jsadr.com.co' } })
    if (correo) {
      console.log(`  id: ${correo.id}`)
      console.log(`  email: ${correo.email}`)
      console.log(`  estado: ${correo.estado}`)
      console.log(`  esPrincipal: ${correo.esPrincipal}`)
      console.log(`  smtpHost: ${correo.smtpHost}`)
      console.log(`  smtpPort: ${correo.smtpPort}`)
      console.log(`  smtpUser: ${correo.smtpUser}`)
      console.log(`  smtpPass (descifrado): ${correo.smtpPass ? decrypt(correo.smtpPass).slice(0, 25) + '...' + decrypt(correo.smtpPass).slice(-6) : '(vacío)'}`)
    } else {
      console.log('  NO EXISTE')
    }

    console.log('\n=== Últimos 5 EnvioCorreo ===')
    const envios = await prisma.envioCorreo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    for (const e of envios) {
      console.log(`\n  [${e.id.slice(-8)}] ${e.createdAt.toISOString()}`)
      console.log(`    destinatario: ${e.destinatario}`)
      console.log(`    asunto: ${e.asunto}`)
      console.log(`    estado: ${e.estado}`)
      console.log(`    mensajeError: ${e.mensajeError || '(ninguno)'}`)
    }

    console.log('\n=== Vercel env vars check ===')
    const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (vercel?.tokenCifrado) {
      const token = decrypt(vercel.tokenCifrado)
      const res = await fetch(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/env?teamId=${process.env.VERCEL_TEAM_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const brevo = (data.envs || []).find(e => e.key === 'BREVO_SMTP_KEY')
        const vercelToken = (data.envs || []).find(e => e.key === 'VERCEL_TOKEN')
        const encKey = (data.envs || []).find(e => e.key === 'API_ENCRYPTION_KEY')
        console.log(`  BREVO_SMTP_KEY: ${brevo ? '✅ existe (target=' + brevo.target?.join(',') + ', updated=' + new Date(brevo.updatedAt).toISOString() + ')' : '❌ NO EXISTE'}`)
        console.log(`  VERCEL_TOKEN:   ${vercelToken ? '✅ existe' : '❌ NO EXISTE'}`)
        console.log(`  API_ENCRYPTION_KEY: ${encKey ? '✅ existe' : '❌ NO EXISTE'}`)
      } else {
        console.log(`  ❌ HTTP ${res.status} listando env vars`)
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message)
  } finally {
    await prisma.$disconnect()
  }
})()
