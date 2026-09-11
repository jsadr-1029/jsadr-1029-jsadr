import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// MC-CC-1020473278-20260826-01: fechaInicioAmortizacion = 2026-08-16
// Cuota 1 debería ser 2026-08-16 (mantenida), 2: 2026-09-01, 3: 2026-09-16, 4: 2026-10-01
const calc = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-16T12:00:00.000Z'),
});
const corr = corregirFechasPorCorte(calc.tablaAmortizacion, '16-01');
console.log('=== Test corte 16-01 con fechaInicio Aug 16 ===');
corr.forEach((c) => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f}`);
});

// Test corte 15-30 con fechaInicio Aug 31 (caso EF)
const calc2 = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-31T17:00:00.000Z'),
});
const corr2 = corregirFechasPorCorte(calc2.tablaAmortizacion, '15-30');
console.log('\n=== Test corte 15-30 con fechaInicio Aug 31 ===');
corr2.forEach((c) => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f}`);
});
