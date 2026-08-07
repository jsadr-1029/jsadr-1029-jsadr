// Compara la API_ENCRYPTION_KEY local (de .env) con la que tiene Vercel.
// Si son diferentes, ese es el root cause: las credenciales en BD están cifradas
// con la llave local pero Vercel no puede descifrarlas.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

// El token de Vercel debe estar en .env (VERCEL_TOKEN) o en PlataformaSync
async function getVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  
  // Buscar en PlataformaSync
  const ps = await prisma.plataformaSync.findFirst({
    where: { plataforma: 'VERCEL' },
    select: { tokenCifrado: true }
  })
  if (!ps?.tokenCifrado) return null
  
  // Intentar descifrar con la llave actual
  const local = process.env.API_ENCRYPTION_KEY
  if (!local) return null
  
  function getKey(raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
    return crypto.createHash('sha256').update(raw).digest()
  }
  
  try {
    const [ivHex, dataHex] = ps.tokenCifrado.split(':')
    const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(local), Buffer.from(ivHex, 'hex'))
    let dec = decipher.update(Buffer.from(dataHex, 'hex'))
    dec = Buffer.concat([dec, decipher.final()])
    return dec.toString('utf8')
  } catch (e) {
    return null
  }
}

async function main() {
  console.log('=== COMPARACIÓN DE API_ENCRYPTION_KEY LOCAL VS VERCEL ===\n')
  
  const localKey = process.env.API_ENCRYPTION_KEY
  console.log(`API_ENCRYPTION_KEY local (.env):`)
  console.log(`  valor: ${localKey}`)
  console.log(`  longitud: ${localKey.length} chars`)
  console.log(`  ¿hex de 64 chars? ${/^[0-9a-fA-F]{64}$/.test(localKey) ? 'SÍ' : 'NO'}`)
  if (/^[0-9a-fA-F]{64}$/.test(localKey)) {
    const keyBuf = Buffer.from(localKey, 'hex')
    console.log(`  Buffer (hex): ${keyBuf.toString('hex')}`)
  }
  console.log()
  
  // Buscar el projectId y teamId de Vercel
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID
  console.log(`VERCEL_PROJECT_ID: ${projectId || '(no configurado)'}`)
  console.log(`VERCEL_TEAM_ID: ${teamId || '(no configurado)'}`)
  console.log()
  
  const token = await getVercelToken()
  if (!token) {
    console.log('✗ No se pudo obtener VERCEL_TOKEN')
    return
  }
  console.log(`✓ VERCEL_TOKEN obtenido (longitud ${token.length})`)
  
  // Listar env vars de Vercel
  const url = `https://api.vercel.com/v9/projects/${projectId}/env${teamId ? `?teamId=${teamId}` : ''}`
  console.log(`\n→ Consultando ${url}...`)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    console.log(`✗ HTTP ${res.status}: ${await res.text()}`)
    return
  }
  const data = await res.json()
  
  console.log(`\n=== Variables de entorno en Vercel ===`)
  for (const env of data.envs || []) {
    if (['API_ENCRYPTION_KEY', 'DATABASE_URL', 'NODE_ENV', 'BREVO_API_KEY', 'BREVO_SMTP_KEY', 'SMTP_USER', 'SMTP_PASS'].includes(env.key)) {
      let valor = env.value || '(encrypted)'
      if (env.type === 'encrypted') valor = '(encrypted — no visible)'
      console.log(`  ${env.key}:`)
      console.log(`    type: ${env.type}`)
      console.log(`    target: ${JSON.stringify(env.target)}`)
      console.log(`    value: ${typeof valor === 'string' && valor.length > 60 ? valor.slice(0, 30) + '...' + valor.slice(-12) : valor}`)
    }
  }
  
  // Si API_ENCRYPTION_KEY está cifrada en Vercel, no podemos comparar directamente.
  // Pero podemos hacer un test indirecto: llamar a un endpoint que use la llave.
  console.log('\n=== TEST INDIRECTO: cifrar algo localmente y descifrarlo en Vercel ===')
  console.log('No es posible sin un endpoint de debug. Pero podemos inferir:')
  console.log('Si la API_ENCRYPTION_KEY en Vercel es igual a la local, el fix de credenciales DEBERÍA funcionar.')
  console.log('Si es diferente, necesitamos actualizar Vercel o re-cifrar con la llave de Vercel.')
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
