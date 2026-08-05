// Smoke test: login → solicitar clave → (sin OTP real, no podemos validar
// pero sí verificar que el endpoint responde correctamente y que el 
// endpoint de solicitudes-web rechaza sin codigoConfirmacion)
const BASE = 'http://localhost:3000'
const CEDULA = '1214731649'
const PIN = '1234'

async function main() {
  console.log('=== 1. Login portal ===')
  const loginRes = await fetch(`${BASE}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: CEDULA, pin: PIN }),
  })
  const loginJson = await loginRes.json()
  console.log('Login:', loginJson.success, 'clienteId:', loginJson.clienteId, 'nombre:', loginJson.nombre)
  if (!loginJson.success) {
    console.error('Login falló')
    process.exit(1)
  }
  const clienteId = loginJson.clienteId
  const token = loginJson.token

  console.log('\n=== 2. Solicitar Clave Dinámica ===')
  const solRes = await fetch(`${BASE}/api/portal/clave-dinamica/solicitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteId, token }),
  })
  const solJson = await solRes.json()
  console.log('Status:', solRes.status)
  console.log('Response:', JSON.stringify(solJson, null, 2))

  console.log('\n=== 3. Validar clave con valor incorrecto ===')
  const valRes = await fetch(`${BASE}/api/portal/clave-dinamica/validar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      token,
      otpRegistroId: solJson.otpRegistroId,
      clave: '000000',
    }),
  })
  const valJson = await valRes.json()
  console.log('Status:', valRes.status)
  console.log('Response:', JSON.stringify(valJson, null, 2))

  console.log('\n=== 4. Intentar enviar solicitud sin codigoConfirmacion ===')
  const envRes = await fetch(`${BASE}/api/solicitudes-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      token,
      valorSolicitado: 1000000,
      numeroCuotas: 12,
      frecuencia: 'MENSUAL',
      primerPagoFecha: '2026-09-01',
    }),
  })
  const envJson = await envRes.json()
  console.log('Status:', envRes.status)
  console.log('Response:', JSON.stringify(envJson, null, 2))

  console.log('\n=== 5. Intentar enviar con codigoConfirmacion inválido ===')
  const env2Res = await fetch(`${BASE}/api/solicitudes-web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      token,
      valorSolicitado: 1000000,
      numeroCuotas: 12,
      frecuencia: 'MENSUAL',
      primerPagoFecha: '2026-09-01',
      codigoConfirmacion: 'fake_invalid_token_12345',
    }),
  })
  const env2Json = await env2Res.json()
  console.log('Status:', env2Res.status)
  console.log('Response:', JSON.stringify(env2Json, null, 2))

  console.log('\n=== 6. Rate-limit: solicitar otra clave inmediatamente ===')
  const rlRes = await fetch(`${BASE}/api/portal/clave-dinamica/solicitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteId, token }),
  })
  const rlJson = await rlRes.json()
  console.log('Status:', rlRes.status)
  console.log('Response:', JSON.stringify(rlJson, null, 2))

  console.log('\n=== TEST COMPLETE ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
