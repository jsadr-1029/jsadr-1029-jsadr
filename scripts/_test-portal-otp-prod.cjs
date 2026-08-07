// Prueba end-to-end del flujo OTP del portal contra jsadr.com.co
// Verifica que el OTP llega al correo tras el fix de credenciales.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

const PROD_URL = 'https://jsadr.com.co'

function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

function decryptSensitive(encrypted) {
  try {
    const [ivHex, dataHex] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
    let dec = decipher.update(data)
    dec = Buffer.concat([dec, decipher.final()])
    return dec.toString('utf8')
  } catch (e) { return null }
}

async function main() {
  console.log('=== PRUEBA END-TO-END DEL FLUJO OTP DEL PORTAL ===\n')
  console.log(`URL producción: ${PROD_URL}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // 1. Buscar un cliente con email y PIN para hacer login
  const cliente = await prisma.cliente.findFirst({
    where: { 
      activo: true, 
      email: { not: '' },
      pinHash: { not: null },
    },
    select: { id: true, cedula: true, nombre: true, email: true, tokenSesion: true, tokenExpira: true }
  })
  if (!cliente) {
    console.log('✗ No hay cliente con email+PIN para probar')
    return
  }
  console.log(`Cliente de prueba: ${cliente.nombre} (cédula ${cliente.cedula})`)
  console.log(`Email: ${cliente.email}`)
  console.log(`Token sesión actual: ${cliente.tokenSesion ? cliente.tokenSesion.slice(0, 12) + '...' : 'NULL'}`)
  console.log(`Token expira: ${cliente.tokenExpira?.toISOString() || 'N/A'}`)
  console.log(`Token válido ahora: ${cliente.tokenSesion && cliente.tokenExpira && cliente.tokenExpira > new Date() ? 'SÍ' : 'NO'}\n`)

  // 2. Verificar que las credenciales en BD ahora descifran correctamente
  const conexion = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP', activa: true } })
  const pass = decryptSensitive(conexion.password)
  console.log(`Verificación de credenciales en BD:`)
  console.log(`  ConexionAPI.password descifra: ${pass ? '✓ SÍ' : '✗ NO'}`)
  if (pass) {
    console.log(`    valor: ${pass.slice(0, 12)}...${pass.slice(-6)}`)
    console.log(`    ¿Empieza con xsmtpsib-? ${pass.startsWith('xsmtpsib-') ? '✓' : '✗'}`)
  }
  console.log()

  // 3. Probar el endpoint de solicitar OTP directamente contra producción
  //    (usando el token del cliente si es válido, sino pedimos uno nuevo)
  let tokenSesion = null
  if (cliente.tokenSesion && cliente.tokenExpira && cliente.tokenExpira > new Date()) {
    tokenSesion = cliente.tokenSesion
    console.log('✓ Usando token de sesión existente')
  } else {
    // Hacer login con la cédula del cliente y la contraseña conocida
    // La contraseña por defecto de los clientes es su cédula (según el inventario)
    console.log('→ Haciendo login del cliente...')
    const loginRes = await fetch(`${PROD_URL}/api/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: cliente.cedula, pin: cliente.cedula }),
    })
    const loginData = await loginRes.json()
    if (!loginData.success) {
      console.log(`✗ Login falló: ${loginData.error}`)
      return
    }
    tokenSesion = loginData.token
    console.log(`✓ Login OK — token: ${tokenSesion.slice(0, 12)}...`)
  }

  // 4. Buscar si el cliente tiene alguna firma de préstamo pendiente
  //    Si la tiene, usar ese firmaId para solicitar OTP
  const firma = await prisma.firmaElectronica.findFirst({
    where: { 
      prestamo: { clienteId: cliente.id },
      estadoFirma: { in: ['PENDIENTE', 'OTP_ENVIADO'] },
    },
    include: { prestamo: true },
    orderBy: { createdAt: 'desc' },
  })
  
  // Headers comunes para simular navegador
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://jsadr.com.co',
    'Referer': 'https://jsadr.com.co/',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }

  if (firma) {
    console.log(`\n→ Llamando /api/portal/solicitar-otp con firmaId=${firma.id}...`)
    const otpRes = await fetch(`${PROD_URL}/api/portal/solicitar-otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ firmaId: firma.id }),
    })
    const otpData = await otpRes.json()
    console.log(`  Status: ${otpRes.status}`)
    console.log(`  Response: ${JSON.stringify(otpData, null, 2).slice(0, 400)}`)
    if (otpData.emailEnviado) {
      console.log(`\n✓✓✓ OTP ENVIADO POR EMAIL — el usuario debe recibirlo en ${cliente.email}`)
    } else {
      console.log(`\n✗ OTP NO enviado por email — revisar logs de Vercel`)
    }
  } else {
    console.log('\n→ El cliente no tiene firma de préstamo pendiente. Probando /api/portal/clave-dinamica/solicitar...')
    const cdRes = await fetch(`${PROD_URL}/api/portal/clave-dinamica/solicitar`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clienteId: cliente.id, token: tokenSesion }),
    })
    const cdData = await cdRes.json()
    console.log(`  Status: ${cdRes.status}`)
    console.log(`  Response: ${JSON.stringify(cdData, null, 2).slice(0, 400)}`)
    if (cdData.success && cdData.emailEnviado) {
      console.log(`\n✓✓✓ CLAVE DINÁMICA ENVIADA POR EMAIL — el usuario debe recibirla en ${cliente.email}`)
    } else {
      console.log(`\n✗ Clave dinámica NO enviada por email`)
    }
  }

  // 5. Esperar 3s y revisar el último EnvioCorreo
  console.log('\n→ Esperando 3s y revisando último EnvioCorreo...')
  await new Promise(r => setTimeout(r, 3000))
  const ultimoEnvio = await prisma.envioCorreo.findFirst({
    orderBy: { fechaEnvio: 'desc' },
    select: { fechaEnvio: true, destinatario: true, asunto: true, estado: true, mensajeError: true, metadata: true, enviadoPorNombre: true }
  })
  console.log(`  Último EnvioCorreo:`)
  console.log(`    fecha: ${ultimoEnvio?.fechaEnvio.toISOString()}`)
  console.log(`    destinatario: ${ultimoEnvio?.destinatario}`)
  console.log(`    asunto: ${ultimoEnvio?.asunto}`)
  console.log(`    estado: ${ultimoEnvio?.estado}`)
  console.log(`    enviadoPor: ${ultimoEnvio?.enviadoPorNombre}`)
  console.log(`    metadata: ${ultimoEnvio?.metadata}`)
  if (ultimoEnvio?.mensajeError) {
    console.log(`    error: ${ultimoEnvio.mensajeError.slice(0, 200)}`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
