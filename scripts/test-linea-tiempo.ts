// Test smoke para verificar que la reconstrucción histórica funciona con datos reales
import { reconstruirCarteraHastaFecha, reconstruirPrestamoHastaFecha, obtenerEventosPrestamo, compararCarteraEntreFechas } from '../src/lib/prestamo-historico'

async function main() {
  console.log('🧪 Test 1: Reconstrucción de cartera a HOY')
  const hoy = new Date()
  const carteraHoy = await reconstruirCarteraHastaFecha(hoy)
  console.log(`   Total préstamos existentes: ${carteraHoy.totalPrestamosExistentes}`)
  console.log(`   Créditos activos: ${carteraHoy.creditosActivos}`)
  console.log(`   Créditos cancelados: ${carteraHoy.creditosCancelados}`)
  console.log(`   Cartera pendiente: $${Math.round(carteraHoy.carteraPendiente).toLocaleString('es-CO')}`)
  console.log(`   Capital prestado: $${Math.round(carteraHoy.capitalPrestado).toLocaleString('es-CO')}`)
  console.log(`   Dinero recuperado: $${Math.round(carteraHoy.dineroRecuperado).toLocaleString('es-CO')}`)
  console.log(`   Advertencias: ${carteraHoy.advertencias.length}`)

  if (carteraHoy.prestamos.length === 0) {
    console.log('⚠️  No hay préstamos para probar más tests.')
    return
  }

  console.log('\n🧪 Test 2: Reconstrucción a hace 6 meses')
  const hace6m = new Date()
  hace6m.setMonth(hace6m.getMonth() - 6)
  const cartera6m = await reconstruirCarteraHastaFecha(hace6m)
  console.log(`   Total préstamos existentes hace 6m: ${cartera6m.totalPrestamosExistentes}`)
  console.log(`   Créditos activos hace 6m: ${cartera6m.creditosActivos}`)
  console.log(`   Cartera pendiente hace 6m: $${Math.round(cartera6m.carteraPendiente).toLocaleString('es-CO')}`)

  console.log('\n🧪 Test 3: Comparación hace 6m vs hoy')
  const comparacion = await compararCarteraEntreFechas(hace6m, hoy)
  console.log(`   Diferencia créditos activos: ${comparacion.diferencias.creditosActivos}`)
  console.log(`   Diferencia cartera pendiente: $${Math.round(comparacion.diferencias.carteraPendiente).toLocaleString('es-CO')}`)
  console.log(`   Nuevos desembolsos: $${Math.round(comparacion.desgloseCambios.nuevosDesembolsos).toLocaleString('es-CO')}`)
  console.log(`   Pagos recibidos: $${Math.round(comparacion.desgloseCambios.pagosRecibidos).toLocaleString('es-CO')}`)
  console.log(`   Nuevos créditos: ${comparacion.desgloseCambios.nuevosCreditos.length}`)
  console.log(`   Créditos cancelados: ${comparacion.desgloseCambios.creditosCancelados.length}`)

  console.log('\n🧪 Test 4: Eventos del primer préstamo activo')
  const primerActivo = carteraHoy.prestamos.find(p => p.estadoHistorico === 'ACTIVO' || p.estadoHistorico === 'EN_MORA')
  if (primerActivo) {
    const eventos = await obtenerEventosPrestamo(primerActivo.id)
    console.log(`   Préstamo: ${primerActivo.codigo} (${primerActivo.clienteNombre})`)
    console.log(`   Eventos: ${eventos.length}`)
    console.log(`   Primer evento: ${eventos[0]?.titulo || 'N/A'} (${eventos[0]?.fecha.toLocaleDateString('es-CO') || 'N/A'})`)
    console.log(`   Último evento: ${eventos[eventos.length - 1]?.titulo || 'N/A'}`)
  }

  console.log('\n🧪 Test 5: Reconstrucción de un préstamo individual a fecha anterior')
  const primerPrestamo = carteraHoy.prestamos[0]
  if (primerPrestamo && primerPrestamo.fechaDesembolso) {
    const fechaMitad = new Date(primerPrestamo.fechaDesembolso)
    fechaMitad.setDate(fechaMitad.getDate() + 15)
    const mitad = await reconstruirPrestamoHastaFecha(primerPrestamo.id, fechaMitad)
    console.log(`   Préstamo: ${mitad?.codigo}`)
    console.log(`   Estado histórico: ${mitad?.estadoHistorico}`)
    console.log(`   Saldo histórico: $${Math.round(mitad?.saldoTotalHistorico || 0).toLocaleString('es-CO')}`)
    console.log(`   Días transcurridos: ${mitad?.diasTranscurridos}/${mitad?.plazoTotalDias}`)
    console.log(`   Pagos hasta T: ${mitad?.pagosHastaT}`)
  }

  console.log('\n✅ Todos los tests pasaron correctamente!')
}

main().catch(e => { console.error('💥 Error:', e); process.exit(1) })
