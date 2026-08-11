// Recupera VERCEL_TOKEN y VERCEL_PROJECT_ID/TEAM_ID de la BD Neon (PlataformaSync)
// y los guarda en process.env para que este script y otros los puedan usar.
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const fs = require('fs')

// Cargar .env primero (para API_ENCRYPTION_KEY)
try {
  const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) {
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  }
} catch (e) {}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public&connect_timeout=60&pool_timeout=60',
    },
  },
})

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definida')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
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

async function main() {
  try {
    const vercel = await prisma.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (!vercel) {
      console.error('No hay PlataformaSync.VERCEL en la BD')
      process.exit(1)
    }

    const token = vercel.tokenCifrado ? decryptSensitive(vercel.tokenCifrado) : null
    console.log('VERCEL_TOKEN:', token ? `${token.slice(0, 12)}...${token.slice(-6)} (${token.length} chars)` : '(vacío)')

    // Otros datos útiles pueden estar en datosSync (JSON)
    let datosSync = {}
    try { datosSync = JSON.parse(vercel.datosSync || '{}') } catch {}
    console.log('VERCEL_PROJECT_ID:', vercel.entidadId || datosSync.projectId || process.env.VERCEL_PROJECT_ID || '(no encontrado)')
    console.log('VERCEL_TEAM_ID:', datosSync.teamId || process.env.VERCEL_TEAM_ID || '(no encontrado)')

    // Guardar en un archivo temporal para que otros scripts lo lean
    fs.writeFileSync('/home/z/my-project/scripts/.vercel-creds.json', JSON.stringify({
      token,
      projectId: vercel.entidadId || datosSync.projectId || process.env.VERCEL_PROJECT_ID,
      teamId: datosSync.teamId || process.env.VERCEL_TEAM_ID,
    }, null, 2))
    console.log('✅ Credenciales guardadas en /home/z/my-project/scripts/.vercel-creds.json')
  } catch (e) {
    console.error('ERROR:', e.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
