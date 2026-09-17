import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// Simular cálculo del estado de cuenta para DR
const calc = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 1800000,
  tasaMensualFija: 13.5,
  numeroCuotas: 2,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-31T17:00:00.000Z'), // fechaInicioAmortizacion
});

console.log('=== Tabla SIN corrección ===');
calc.tablaAmortizacion.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | $${c.montoCuota}`);
});

console.log('\n=== Tabla CON corrección 15-30 ===');
const corr = corregirFechasPorCorte(calc.tablaAmortizacion, '15-30');
corr.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | $${c.montoCuota}`);
});
