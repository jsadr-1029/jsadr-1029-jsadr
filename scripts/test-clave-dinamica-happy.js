// Happy path test: lee el OTP real de BD (codigoHash está hasheado,
// pero en dev podemos regenerar comparando con hash conocido).
// Alternativa: usar el endpoint validar con un OTP que nosotros generamos
// de la misma manera.
//
// Enfoque más simple: usar el código OTP que se generó en la solicitud
// anterior. Como en producción el código no se guarda en claro, no podemos
// recuperarlo. Pero podemos hacer una prueba determinística inyectando
// un OTP de prueba directo en BD.
//
// Mejor enfoque: mock temporalmente generarCodigoOtp con un valor conocido.
// Pero como no podemos mockear desde fuera, lo que hacemos es:
//  1. Generar una solicitud de clave
//  2. Tomar el otpRegistroId
//  3. Consultar BD para obtener el codigoHash
//  4. Sabemos que el OTP fue hasheado con SHA-256
//  5. Brute-forcear los 1,000,000 posibles valores de 6 dígitos
//     contra el hash (en este test, no en producción)
//
// Esto es solo para testing. En producción el cliente recibe el OTP por email.

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Cargar .env manualmente (dotenv no maneja comillas en valores)
const envPath = path.join(__dirname, '..', '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[m[1]] = val
  }
}

const BASE = 'http://localhost:3000'
const CEDULA = '1214731649'
const PIN = '1234'

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('=== 1. Login ===')
    const loginRes = await fetch(`${BASE}/api/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cedula: CEDULA, pin: PIN }),
    })
    const loginJson = await loginRes.json()
    const clienteId = loginJson.clienteId
    const token = loginJson.token
    console.log('OK:', loginJson.nombre)

    // Esperar 60s para evitar rate-limit
    console.log('\n=== 2. Esperando 61s para evitar rate-limit... ===')
    await new Promise((r) => setTimeout(r, 61_000))

    console.log('\n=== 3. Solicitar Clave Dinámica ===')
    const solRes = await fetch(`${BASE}/api/portal/clave-dinamica/solicitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, token }),
    })
    const solJson = await solRes.json()
    console.log('otpRegistroId:', solJson.otpRegistroId)
    const otpRegistroId = solJson.otpRegistroId

    console.log('\n=== 4. Recuperar hash de BD y brute-forcear OTP ===')
    const otpReg = await prisma.otpRegistro.findUnique({
      where: { id: otpRegistroId },
    })
    console.log('codigoHash:', otpReg.codigoHash)
    console.log('metodo:', otpReg.metodo)
    console.log('tipo:', otpReg.tipo)

    let otpEncontrado = null
    const start = Date.now()
    for (let i = 0; i < 1_000_000; i++) {
      const candidate = i.toString().padStart(6, '0')
      const hash = crypto.createHash('sha256').update(candidate).digest('hex')
      if (hash === otpReg.codigoHash) {
        otpEncontrado = candidate
        break
      }
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    console.log(`OTP encontrado: ${otpEncontrado} (en ${elapsed}s)`)

    if (!otpEncontrado) {
      console.error('No se encontró el OTP')
      process.exit(1)
    }

    console.log('\n=== 5. Validar OTP ===')
    const valRes = await fetch(`${BASE}/api/portal/clave-dinamica/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, token, otpRegistroId, clave: otpEncontrado }),
    })
    const valJson = await valRes.json()
    console.log('Status:', valRes.status)
    console.log('Response:', JSON.stringify(valJson, null, 2))
    if (!valJson.success) {
      console.error('Validación falló')
      process.exit(1)
    }
    const codigoConfirmacion = valJson.codigoConfirmacion
    console.log('codigoConfirmacion:', codigoConfirmacion.slice(0, 16) + '...')

    console.log('\n=== 6. Enviar solicitud con codigoConfirmacion ===')
    const envRes = await fetch(`${BASE}/api/solicitudes-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        token,
        valorSolicitado: 1500000,
        numeroCuotas: 12,
        frecuencia: 'MENSUAL',
        primerPagoFecha: '2026-09-01',
        codigoConfirmacion,
      }),
    })
    const envJson = await envRes.json()
    console.log('Status:', envRes.status)
    console.log('Response:', JSON.stringify(envJson, null, 2))

    console.log('\n=== 7. Intentar reutilizar el mismo codigoConfirmacion ===')
    const env2Res = await fetch(`${BASE}/api/solicitudes-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        token,
        valorSolicitado: 2000000,
        numeroCuotas: 24,
        frecuencia: 'MENSUAL',
        primerPagoFecha: '2026-09-01',
        codigoConfirmacion,
      }),
    })
    const env2Json = await env2Res.json()
    console.log('Status:', env2Res.status)
    console.log('Response:', JSON.stringify(env2Json, null, 2))

    console.log('\n=== HAPPY PATH TEST COMPLETE ===')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
