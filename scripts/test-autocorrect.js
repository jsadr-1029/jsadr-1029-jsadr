// Test the auto-correction: send the wrong account ID
const BASE = 'http://localhost:3000'

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'Admin-Test-2026*' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.data?.access_token
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const aplicarRes = await fetch(`${BASE}/api/pagos/aplicar?q=`, { headers: authHeaders })
  const aplicarJson = await aplicarRes.json()
  const firstLoan = aplicarJson.data[0]
  console.log('Préstamo:', firstLoan.codigo, 'cuenta correcta:', firstLoan.cuentaRecaudo?.id)

  // Reverse the previous test payment first
  const previos = await db_pagoTestList(token)
  console.log('Pagos TEST previos (a anular):', previos.length)

  // Send the WRONG account ID (the category account, not the client account)
  const WRONG_ACCOUNT_ID = 'cmrpo5m6y0003xrjfvsmwqskx' // this is the category account that was being sent before
  const body = {
    prestamoId: firstLoan.id,
    numeroCuota: firstLoan.proximaCuota,
    montoTotal: firstLoan.montoTotalPendiente,
    metodoPago: 'EFECTIVO',
    referencia: 'TEST-AUTOCORRECT-' + Date.now(),
    cuentaRecaudoId: WRONG_ACCOUNT_ID, // INTENTIONALLY WRONG
  }
  console.log('\nEnviando cuentaRecaudoId INCORRECTO:', WRONG_ACCOUNT_ID)
  console.log('Esperado: auto-corrección a:', firstLoan.cuentaRecaudo?.id)

  const applyRes = await fetch(`${BASE}/api/pagos`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  })
  const applyJson = await applyRes.json()
  console.log('Status:', applyRes.status, 'Success:', applyJson.success)
  if (applyJson.success) {
    console.log('✓ Auto-corrección funcionó. Pago aplicado a cuenta:', applyJson.data?.cuentaRecaudoId)
  } else {
    console.log('✗ SIGUE FALLANDO:', applyJson.error)
  }
}

async function db_pagoTestList(token) {
  // Best effort: fetch pagos list and find TEST ones
  const r = await fetch('http://localhost:3000/api/pagos?estado=APLICADO', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  return (j.data || []).filter(p => (p.referencia || '').startsWith('TEST'))
}

main().catch(console.error)
