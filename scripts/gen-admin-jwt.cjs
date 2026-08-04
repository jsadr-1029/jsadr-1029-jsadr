// Genera un JWT admin firmado con JWT_SECRET para usar en pruebas de endpoints protegidos
const fs = require('fs')
const crypto = require('crypto')

const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('JWT_SECRET no definido')
  process.exit(1)
}

// Generar JWT HS256 manualmente
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const header = { alg: 'HS256', typ: 'JWT' }
const now = Math.floor(Date.now() / 1000)
const payload = {
  sub: 'diag-admin',
  id: 'diag-admin',
  userId: 'diag-admin',
  nombre: 'Diagnóstico',
  rol: 'ADMIN',
  username: 'admin-diag',
  iat: now,
  exp: now + 3600, // 1 hora
}

const headerB64 = base64url(JSON.stringify(header))
const payloadB64 = base64url(JSON.stringify(payload))
const data = `${headerB64}.${payloadB64}`
const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = `${data}.${signature}`

console.log(jwt)
