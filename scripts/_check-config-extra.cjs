// Verificar configuracionExtra y apiKey de ConexionAPI.EMAIL_SMTP
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

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (!smtp) {
    console.log('NO EXISTE')
    return
  }
  console.log('=== ConexionAPI.EMAIL_SMTP estado completo ===')
  console.log({
    id: smtp.id,
    nombre: smtp.nombre,
    tipo: smtp.tipo,
    url: smtp.url,
    usuario: smtp.usuario,
    apiKey: smtp.apiKey,
    apiKeyLength: smtp.apiKey?.length || 0,
    passwordLength: smtp.password?.length || 0,
    configuracionExtra: smtp.configuracionExtra,
    activa: smtp.activa,
  })

  // Probar envío real via recuperar-clave endpoint en producción
  console.log('\n=== Test /api/auth/recuperar-clave en Vercel ===')
  const res = await fetch('https://jsadr-1029-jsadr.vercel.app/api/auth/recuperar-clave', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://jsadr-1029-jsadr.vercel.app',
      Referer: 'https://jsadr-1029-jsadr.vercel.app/',
      'User-Agent': 'Mozilla/5.0 (test)',
    },
    body: JSON.stringify({ identificador: 'adm-jsadr' }),
  })
  console.log(`HTTP ${res.status}`)
  const text = await res.text()
  console.log(`Body: ${text.slice(0, 300)}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
