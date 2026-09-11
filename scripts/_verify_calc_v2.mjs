import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// Cálculo: 4 cuotas quincenales, monto $200,000, tasa 25% mensual
const calc = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-31T17:00:00.000Z'),  // fechaInicioAmortizacion
});

console.log('=== Cálculo TASA_FIJA para préstamo EF ===');
console.log(`Frecuencia: QUINCENAL`);
console.log(`Numero cuotas: ${calc.numeroCuotas}`);
console.log(`Monto cuota: $${calc.montoCuota.toLocaleString('es-CO')}`);
console.log(`Total interés: $${calc.totalInteres.toLocaleString('es-CO')}`);
console.log(`Total a pagar: $${calc.totalPagar.toLocaleString('es-CO')}`);
console.log(`Tasa aplicada: ${calc.tasaAplicada}`);
console.log('');

console.log('=== Tabla SIN corrección ===');
calc.tablaAmortizacion.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | $${c.montoCuota} (cap $${c.capital} + int $${c.interes})`);
});

console.log('\n=== Tabla CON corrección 15-30 ===');
const corr = corregirFechasPorCorte(calc.tablaAmortizacion, '15-30');
corr.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | $${c.montoCuota} (cap $${c.capital} + int $${c.interes})`);
});
