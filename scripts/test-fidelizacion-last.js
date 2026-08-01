// Test fidelización on the LAST cuota
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

  // List loans
  const aplicarRes = await fetch(`${BASE}/api/pagos/aplicar?q=`, { headers: authHeaders })
  const aplicarJson = await aplicarRes.json()
  // Find the same loan (should now be on cuota 2 of 2)
  const loan = aplicarJson.data.find(p => p.codigo === 'PREST-JA-1214731649-20260719-02')
  if (!loan) {
    console.log('Préstamo no encontrado en resultados. Probablemente ya está cancelado.')
    process.exit(0)
  }
  console.log('Préstamo:', loan.codigo, 'cuota', loan.proximaCuota, '/', loan.numeroCuotas)

  // Apply second (last) payment
  const applyRes = await fetch(`${BASE}/api/pagos`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      prestamoId: loan.id,
      numeroCuota: loan.proximaCuota,
      montoTotal: loan.montoTotalPendiente,
      metodoPago: 'EFECTIVO',
      referencia: 'E2E-LAST-' + Date.now(),
    }),
  })
  const applyJson = await applyRes.json()
  if (!applyJson.success) {
    console.error('✗ Aplicar pago falló:', applyJson.error)
    process.exit(1)
  }
  const pagoId = applyJson.data.id
  console.log('✓ Pago aplicado. pagoId:', pagoId)
  console.log('   Estado préstamo:', applyJson.prestamo?.estado)

  // Fetch receipt
  const reciboRes = await fetch(`${BASE}/api/pagos/recibo`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pagoId }),
  })
  const reciboJson = await reciboRes.json()
  console.log('\n✓ Recibo:')
  console.log('   cuota:', reciboJson.data.pago.cuota, 'de', reciboJson.data.totalCuotas)
  console.log('   cuotasPendientes:', reciboJson.data.cuotasPendientes)
  console.log('   esUltimaCuota:', reciboJson.data.esUltimaCuota)
  console.log('   porcentajeAvance:', reciboJson.data.porcentajeAvance + '%')

  // Now fidelización SHOULD work
  console.log('\n--- Fidelización (debe permitir) ---')
  const fidRes = await fetch(`${BASE}/api/pagos/recibo/fidelizacion`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ accion: 'generar_plantillas', pagoId }),
  })
  const fidJson = await fidRes.json()
  console.log('   Status:', fidRes.status, 'Success:', fidJson.success)
  if (fidJson.success) {
    console.log('   ✓ Plantillas disponibles:', fidJson.data.plantillas.length)
    fidJson.data.plantillas.forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.emoji} ${p.titulo}`)
    })
    console.log('\n   Primera plantilla (mensaje):')
    console.log('   ' + fidJson.data.plantillas[0].mensaje.split('\n').join('\n   '))
  } else {
    console.log('   ✗ Error:', fidJson.error)
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
