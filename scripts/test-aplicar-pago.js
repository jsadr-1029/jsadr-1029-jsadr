// Test script to reproduce "no me está dejando aplicar pago"
// Simulates: login → buscar préstamos → aplicar pago
const BASE = 'http://localhost:3000'

async function main() {
  // 1. Login as admin
  console.log('=== 1. Login admin ===')
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'Admin-Test-2026*' }),
  })
  const loginJson = await loginRes.json()
  console.log('Login:', loginJson.success, loginJson.data?.usuario?.rol || loginJson.error || JSON.stringify(loginJson).slice(0, 200))
  const token = loginJson.data?.access_token
  if (!token) {
    console.error('No token obtained. Aborting.')
    process.exit(1)
  }
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // 2. List loans available for payment
  console.log('\n=== 2. Buscar préstamos para aplicar pago ===')
  const aplicarRes = await fetch(`${BASE}/api/pagos/aplicar?q=`, { headers: authHeaders })
  const aplicarJson = await aplicarRes.json()
  console.log('Status:', aplicarRes.status, 'Success:', aplicarJson.success)
  if (!aplicarJson.success || !aplicarJson.data?.length) {
    console.error('No hay préstamos disponibles. Aborting.')
    console.log('Response:', JSON.stringify(aplicarJson).slice(0, 500))
    process.exit(1)
  }
  console.log('Total préstamos:', aplicarJson.data.length)
  const firstLoan = aplicarJson.data[0]
  console.log('Primer préstamo:')
  console.log({
    id: firstLoan.id,
    codigo: firstLoan.codigo,
    cliente: firstLoan.cliente?.nombre,
    proximaCuota: firstLoan.proximaCuota,
    numeroCuotas: firstLoan.numeroCuotas,
    montoTotalPendiente: firstLoan.montoTotalPendiente,
    cuotaBase: firstLoan.cuotaBase,
    totalCuotaConMora: firstLoan.totalCuotaConMora,
    estado: firstLoan.estado,
    cuentaRecaudo: firstLoan.cuentaRecaudo?.id,
  })

  // 3. Try to apply payment
  console.log('\n=== 3. Aplicar pago ===')
  const body = {
    prestamoId: firstLoan.id,
    numeroCuota: firstLoan.proximaCuota,
    montoTotal: firstLoan.montoTotalPendiente,
    metodoPago: 'EFECTIVO',
    referencia: 'TEST-' + Date.now(),
    cuentaRecaudoId: firstLoan.cuentaRecaudo?.id || null,
  }
  console.log('Body:', JSON.stringify(body, null, 2))
  const applyRes = await fetch(`${BASE}/api/pagos`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  })
  const applyJson = await applyRes.json()
  console.log('Status:', applyRes.status)
  console.log('Success:', applyJson.success)
  console.log('Response:', JSON.stringify(applyJson, null, 2).slice(0, 1500))

  // 4. If 400, try without cuentaRecaudoId (could be the source of mismatch)
  if (!applyJson.success && applyRes.status === 400) {
    console.log('\n=== 4. Intentando sin cuentaRecaudoId ===')
    const body2 = {
      prestamoId: firstLoan.id,
      numeroCuota: firstLoan.proximaCuota,
      montoTotal: firstLoan.montoTotalPendiente,
      metodoPago: 'EFECTIVO',
      referencia: 'TEST2-' + Date.now(),
    }
    const applyRes2 = await fetch(`${BASE}/api/pagos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body2),
    })
    const applyJson2 = await applyRes2.json()
    console.log('Status:', applyRes2.status)
    console.log('Response:', JSON.stringify(applyJson2).slice(0, 500))
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
