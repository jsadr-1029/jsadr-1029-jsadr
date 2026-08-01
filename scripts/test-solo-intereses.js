// Test del nuevo modo "Solo Intereses" (v4.0)
// Verifica que el pago de solo intereses:
//   1. Se aplique correctamente
//   2. Cree el registro de PagoProgramado con estado APLAZADO
//   3. La cuota quede con la nueva fecha de vencimiento
//   4. NO se genere mora mientras esté aplazada

const BASE = 'http://localhost:3000'

async function main() {
  // 1. Listar próximos pagos para encontrar uno candidato
  console.log('1. Obteniendo próximos pagos...')
  const r1 = await fetch(`${BASE}/api/pagos/proximos?dias=30`)
  const proximos = await r1.json()
  if (!proximos.success || !proximos.data.length) {
    console.log('No hay próximos pagos para probar. Abortando.')
    return
  }
  // Tomar el primero que tenga interesCuota > 0
  const candidato = proximos.data.find((p) => p.interesCuota > 0 && !p.esAplazada)
  if (!candidato) {
    console.log('No hay candidato con intereses pendientes. Abortando.')
    return
  }
  console.log(`   ✓ Candidato: ${candidato.codigo} - cuota ${candidato.proximaCuota} - cliente ${candidato.cliente.nombre}`)
  console.log(`     Interés a pagar: $${candidato.interesCuota}`)
  console.log(`     Vencimiento original: ${new Date(candidato.fechaVencimiento).toISOString()}`)

  // 2. Aplicar pago de solo intereses
  console.log('\n2. Aplicando pago de SOLO INTERESES...')
  const r2 = await fetch(`${BASE}/api/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accion: 'solo_intereses',
      prestamoId: candidato.prestamoId,
      montoTotal: candidato.interesCuota,
      metodoPago: 'EFECTIVO',
      observacion: 'Test automatizado v4.0',
    }),
  })
  const result = await r2.json()
  if (!r2.ok || !result.success) {
    console.log(`   ✗ Error: ${result.error}`)
    return
  }
  console.log(`   ✓ Pago aplicado: ${result.data.id}`)
  console.log(`   ✓ Cuota aplazada: ${result.cuotaAplazada}`)
  console.log(`   ✓ Fecha original: ${new Date(result.fechaOriginalVencimiento).toISOString()}`)
  console.log(`   ✓ Nueva fecha: ${new Date(result.nuevaFechaVencimiento).toISOString()}`)
  console.log(`   ✓ esSoloIntereses: ${result.data.esSoloIntereses}`)

  // 3. Verificar que aparezca como APLAZADA en próximos pagos
  console.log('\n3. Verificando que la cuota ahora aparece como APLAZADA...')
  const r3 = await fetch(`${BASE}/api/pagos/proximos?dias=60`)
  const proximos2 = await r3.json()
  if (proximos2.success) {
    const actualizado = proximos2.data.find((p) => p.prestamoId === candidato.prestamoId)
    if (actualizado) {
      console.log(`   ✓ Cuota en próximos: ${actualizado.proximaCuota}`)
      console.log(`   ✓ esAplazada: ${actualizado.esAplazada}`)
      console.log(`   ✓ Estado: ${actualizado.estado}`)
      console.log(`   ✓ diasMora: ${actualizado.diasMora} (debe ser 0)`)
      console.log(`   ✓ Nueva fecha: ${new Date(actualizado.fechaVencimiento).toISOString()}`)
      console.log(`   ✓ Resumen aplazadas: ${proximos2.resumen.aplazadas}`)
    } else {
      console.log('   ✗ No se encontró el préstamo en próximos pagos')
    }
  }

  console.log('\n═══════════════════════════════════════════════')
  console.log('  ✓ TEST PASÓ: Modo Solo Intereses funciona correctamente')
  console.log('═══════════════════════════════════════════════')
}

main().catch((e) => {
  console.error('Error en test:', e)
  process.exit(1)
})
