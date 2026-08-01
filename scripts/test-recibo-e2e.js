// E2E test: apply payment + fetch receipt + verify fidelizacion endpoint
const BASE = 'http://localhost:3000'

async function main() {
  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adm-jsadr', password: 'Admin-Test-2026*' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.data?.access_token
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // List loans
  const aplicarRes = await fetch(`${BASE}/api/pagos/aplicar?q=`, { headers: authHeaders })
  const aplicarJson = await aplicarRes.json()
  const loan = aplicarJson.data[0]
  console.log('Préstamo:', loan.codigo, 'cuota', loan.proximaCuota, '/', loan.numeroCuotas, 'monto:', loan.montoTotalPendiente)

  // Apply payment
  const applyRes = await fetch(`${BASE}/api/pagos`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      prestamoId: loan.id,
      numeroCuota: loan.proximaCuota,
      montoTotal: loan.montoTotalPendiente,
      metodoPago: 'EFECTIVO',
      referencia: 'E2E-' + Date.now(),
    }),
  })
  const applyJson = await applyRes.json()
  if (!applyJson.success) {
    console.error('✗ Aplicar pago falló:', applyJson.error)
    process.exit(1)
  }
  const pagoId = applyJson.data.id
  console.log('✓ Pago aplicado. pagoId:', pagoId)

  // Fetch receipt data
  const reciboRes = await fetch(`${BASE}/api/pagos/recibo`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pagoId }),
  })
  const reciboJson = await reciboRes.json()
  if (!reciboJson.success) {
    console.error('✗ Recibo falló:', reciboJson.error)
    process.exit(1)
  }
  const r = reciboJson.data
  console.log('✓ Recibo generado:')
  console.log('   - cuota:', r.pago.cuota, 'de', r.totalCuotas)
  console.log('   - cuotasPendientes:', r.cuotasPendientes)
  console.log('   - esUltimaCuota:', r.esUltimaCuota)
  console.log('   - porcentajeAvance:', r.porcentajeAvance + '%')
  console.log('   - montoTotal:', r.pago.montoTotal)
  console.log('   - reciboHash:', r.reciboHash.slice(0, 24) + '...')

  // Test fidelizacion endpoint (should fail if not last cuota)
  console.log('\n--- Probando fidelización (debe rechazar si no es última cuota) ---')
  const fidRes = await fetch(`${BASE}/api/pagos/recibo/fidelizacion`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ accion: 'generar_plantillas', pagoId }),
  })
  const fidJson = await fidRes.json()
  console.log('   Status:', fidRes.status)
  console.log('   Success:', fidJson.success)
  if (fidJson.success) {
    console.log('   Plantillas:', fidJson.data.plantillas.length)
    console.log('   Cliente:', fidJson.data.cliente.nombre, '- Tel:', fidJson.data.cliente.telefono)
    console.log('   Primera plantilla:')
    console.log('     ', fidJson.data.plantillas[0].titulo)
    console.log('     ', fidJson.data.plantillas[0].mensaje.slice(0, 100) + '...')
  } else {
    console.log('   Error:', fidJson.error)
    if (fidJson.cuotasPendientes !== undefined) {
      console.log('   cuotasPendientes:', fidJson.cuotasPendientes)
    }
  }

  // Test public verification endpoint
  console.log('\n--- Probando verificación pública (sin auth) ---')
  const verifRes = await fetch(`${BASE}/api/pagos/recibo?verificar=${r.reciboHash}`)
  const verifJson = await verifRes.json()
  console.log('   Status:', verifRes.status, 'Success:', verifJson.success)
  if (verifJson.success) {
    console.log('   ✓ Recibo verificado públicamente')
    console.log('   Cliente:', verifJson.data.cliente, 'Monto:', verifJson.data.montoTotal)
  } else {
    console.log('   Error:', verifJson.error)
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
