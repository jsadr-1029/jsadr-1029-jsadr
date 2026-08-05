// Test rápido de la utilidad de corte-fechas
import { calcularBloqueCorte, calcularFechaPrimerCorte, calcularDiasCausadosAntes, calcularValorDiasCausados } from '../src/lib/corte-fechas'

console.log('=== Test caso del usuario ===')
console.log('fechaPrestamo=2/08/2026, periodo=5-20, monto=300000, tasa=24% anual')
const r = calcularBloqueCorte({
  fechaPrestamo: '2026-08-02',
  periodo: '5-20',
  montoPrincipal: 300000,
  tasaValor: 24,
  tipoTasa: 'ANUAL',
})
console.log(JSON.stringify(r, null, 2))
// Esperado:
// - fechaPrimerCorte: 5/08/2026
// - diasCausadosAntes: 3
// - valorDiasCausados: 300000 * (24/365) * 3 / 100 = 591.78

console.log('\n=== Test 2: día exacto de corte ===')
const r2 = calcularBloqueCorte({
  fechaPrestamo: '2026-08-05',
  periodo: '5-20',
  montoPrincipal: 300000,
  tasaValor: 24,
  tipoTasa: 'ANUAL',
})
console.log(JSON.stringify(r2, null, 2))
// Esperado: diasCausadosAntes=0, valorDiasCausados=0

console.log('\n=== Test 3: entre cortes (7/08) ===')
const r3 = calcularBloqueCorte({
  fechaPrestamo: '2026-08-07',
  periodo: '5-20',
  montoPrincipal: 500000,
  tasaValor: 15,
  tipoTasa: 'MENSUAL',
})
console.log(JSON.stringify(r3, null, 2))
// Esperado:
// - fechaPrimerCorte: 20/08/2026
// - diasCausadosAntes: 13
// - valorDiasCausados: 500000 * (15/30) * 13 / 100 = 3250

console.log('\n=== Test 4: después del segundo corte (25/08) ===')
const r4 = calcularFechaPrimerCorte(new Date(2026, 7, 25), '5-20')
console.log('fechaPrimerCorte:', r4?.toISOString())
// Esperado: 5/09/2026

console.log('\n=== Test 5: febrero (día 30 ajustado a 28) ===')
const r5 = calcularFechaPrimerCorte(new Date(2026, 1, 18), '15-30')
console.log('fechaPrimerCorte:', r5?.toISOString())
// Esperado: 28/02/2026 (ajuste por febrero)
