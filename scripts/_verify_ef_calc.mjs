import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// Configuración actual del préstamo EF
// monto: 200,000, tasa mensual: 25%, 4 cuotas quincenales, fechaInicio: Aug 31
const calculo = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-31T17:00:00.000Z'),
});

console.log('=== Tabla SIN corrección (aritmética +15 días) ===');
calculo.tablaAmortizacion.forEach((c) => {
  console.log(`Cuota ${c.numero}: ${c.fechaVencimiento.toISOString().slice(0,10)} | monto: ${c.montoCuota} | capital: ${c.capital} | interés: ${c.interes}`);
});

console.log('\n=== Tabla CON corrección periodoCorte=15-30 ===');
const corregida = corregirFechasPorCorte(calculo.tablaAmortizacion, '15-30');
corregida.forEach((c) => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | monto: ${c.montoCuota} | capital: ${c.capital} | interés: ${c.interes}`);
});

console.log('\n=== Resumen ===');
console.log(`Monto cuota (todas): $${calculo.montoCuota.toLocaleString('es-CO')}`);
console.log(`Interés por cuota: $${(calculo.totalInteres / 4).toLocaleString('es-CO')}`);
console.log(`Capital por cuota: $${(200000 / 4).toLocaleString('es-CO')}`);
console.log(`Total interés: $${calculo.totalInteres.toLocaleString('es-CO')}`);
console.log(`Total a pagar: $${calculo.totalPagar.toLocaleString('es-CO')}`);

// Verificar también que el corte '16-01' sigue funcionando
console.log('\n=== Test adicional: corte 16-01 (debe seguir funcionando) ===');
const calc2 = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-15T17:00:00.000Z'), // fechaInicio del MC-CC-1020473278
});
const corr2 = corregirFechasPorCorte(calc2.tablaAmortizacion, '16-01');
corr2.forEach((c) => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f}`);
});
